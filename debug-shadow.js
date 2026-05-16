const { exec } = require('child_process');
const util = require('util');
const path = require('path');
const execAsync = util.promisify(exec);

function shellQuote(value) {
  const str = String(value ?? '');
  if (process.platform === 'win32') return `"${str.replace(/"/g, '""')}"`;
  return `'${str.replace(/'/g, `'\\''`)}'`;
}

(async () => {
  const openclawBin = process.platform === 'win32'
    ? path.join(process.env.APPDATA || '', 'npm', 'openclaw.cmd')
    : 'openclaw';

  const prompt = 'Say exactly: bridge ok\n[MOOD:calm]';
  const command = [
    shellQuote(openclawBin),
    'agent',
    '--agent', 'main',
    '--json',
    '--session-id', shellQuote('penny-bridge-debug'),
    '--message', shellQuote(prompt),
    '--thinking', 'low'
  ].join(' ');

  console.log('COMMAND>>');
  console.log(command);

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: __dirname,
      timeout: 20000,
      windowsHide: true,
      maxBuffer: 4 * 1024 * 1024,
    });
    console.log('STDOUT>>');
    console.log(stdout || '');
    console.log('STDERR>>');
    console.log(stderr || '');
  } catch (err) {
    console.log('ERROR>>');
    console.log(err.message);
    console.log('STDOUT>>');
    console.log(err.stdout || '');
    console.log('STDERR>>');
    console.log(err.stderr || '');
    process.exitCode = 1;
  }
})();