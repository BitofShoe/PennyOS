function parseMajorVersion(value = '') {
  const match = String(value || '').match(/(?:^|[/\s])v?(\d+)(?:\.|$)/);
  return match ? Number(match[1]) : null;
}

function expectedMajorFromRange(range = '') {
  const match = String(range || '').match(/>=\s*(\d+)/);
  return match ? Number(match[1]) : null;
}

function checkRuntimeEngines({
  packageJson = {},
  nodeVersion = process.version,
  npmVersion = '',
} = {}) {
  const nodeRange = String(packageJson?.engines?.node || '').trim();
  const npmRange = String(packageJson?.engines?.npm || '').trim();
  const expectedNode = expectedMajorFromRange(nodeRange);
  const expectedNpm = expectedMajorFromRange(npmRange);
  const actualNode = parseMajorVersion(nodeVersion);
  const actualNpm = parseMajorVersion(npmVersion);
  const failures = [];
  if (expectedNode && actualNode !== expectedNode) {
    failures.push(`Node.js ${expectedNode}.x is required by package.json (${nodeRange}); current runtime is ${nodeVersion || 'unknown'}.`);
  }
  if (expectedNpm && actualNpm !== expectedNpm) {
    failures.push(`npm ${expectedNpm}.x is required by package.json (${npmRange}); current runtime is ${npmVersion || 'unknown'}.`);
  }
  return {
    ok: failures.length === 0,
    failures,
    node: {
      expectedMajor: expectedNode,
      actualMajor: actualNode,
      version: nodeVersion || '',
      range: nodeRange,
    },
    npm: {
      expectedMajor: expectedNpm,
      actualMajor: actualNpm,
      version: npmVersion || '',
      range: npmRange,
    },
  };
}

module.exports = {
  checkRuntimeEngines,
  parseMajorVersion,
};
