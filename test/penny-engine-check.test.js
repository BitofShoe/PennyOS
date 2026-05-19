const test = require('node:test');
const assert = require('node:assert/strict');

const {
  checkRuntimeEngines,
  parseMajorVersion,
  readNpmVersion,
} = require('../lib/penny-engine-check');

const packageJson = {
  engines: {
    node: '>=24 <25',
    npm: '>=11 <12',
  },
};

test('parseMajorVersion reads node and npm version strings', () => {
  assert.equal(parseMajorVersion('v24.15.0'), 24);
  assert.equal(parseMajorVersion('11.12.1'), 11);
  assert.equal(parseMajorVersion('npm/11.12.1 node/v24.15.0'), 11);
  assert.equal(parseMajorVersion(''), null);
});

test('checkRuntimeEngines accepts the release-supported Node and npm majors', () => {
  const result = checkRuntimeEngines({
    packageJson,
    nodeVersion: 'v24.15.0',
    npmVersion: '11.12.1',
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.failures, []);
});

test('checkRuntimeEngines rejects older Node and npm majors', () => {
  const result = checkRuntimeEngines({
    packageJson,
    nodeVersion: 'v22.16.0',
    npmVersion: '10.9.2',
  });

  assert.equal(result.ok, false);
  assert.equal(result.failures.length, 2);
  assert.match(result.failures.join('\n'), /Node\.js 24\.x/);
  assert.match(result.failures.join('\n'), /npm 11\.x/);
});

test('readNpmVersion falls back through cmd.exe when Windows cannot exec npm.cmd directly', () => {
  const calls = [];
  const version = readNpmVersion({
    env: {},
    platform: 'win32',
    comSpec: 'cmd.exe',
    execFileSync: (file, args) => {
      calls.push([file, args]);
      if (file === 'npm.cmd') throw new Error('cannot exec cmd shim directly');
      if (file === 'cmd.exe') return '11.9.0\r\n';
      throw new Error(`unexpected executable ${file}`);
    },
  });

  assert.equal(version, '11.9.0');
  assert.deepEqual(calls, [
    ['npm.cmd', ['--version']],
    ['cmd.exe', ['/d', '/s', '/c', 'npm.cmd --version']],
  ]);
});
