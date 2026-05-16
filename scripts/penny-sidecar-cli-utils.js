const fs = require('node:fs');
const path = require('node:path');

function parseArgs(argv = process.argv.slice(2)) {
  const flags = new Set();
  const values = {};
  const positionals = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      positionals.push(arg);
      continue;
    }
    const eq = arg.indexOf('=');
    if (eq !== -1) {
      const key = arg.slice(2, eq);
      values[key] = arg.slice(eq + 1);
      flags.add(key);
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      values[key] = next;
      flags.add(key);
      i += 1;
    } else {
      flags.add(key);
      values[key] = true;
    }
  }
  return { flags, values, positionals };
}

function hasFlag(args, name) {
  return args.flags.has(name);
}

function argValue(args, name, fallback = '') {
  const value = args.values[name];
  if (value === true || value === undefined || value === null) return fallback;
  return String(value);
}

function writeFileIfRequested(filePath, content) {
  if (!filePath) return false;
  const resolved = path.resolve(process.cwd(), filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, content, 'utf8');
  return true;
}

function readJsonFile(filePath) {
  const resolved = path.resolve(process.cwd(), filePath);
  return JSON.parse(fs.readFileSync(resolved, 'utf8'));
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function printText(value) {
  process.stdout.write(String(value || ''));
  if (!String(value || '').endsWith('\n')) process.stdout.write('\n');
}

function detectCommand(command) {
  try {
    const { execFileSync } = require('node:child_process');
    const output = execFileSync('bash', ['-lc', `command -v ${JSON.stringify(command)}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return output.trim();
  } catch (_err) {
    return '';
  }
}

module.exports = {
  parseArgs,
  hasFlag,
  argValue,
  writeFileIfRequested,
  readJsonFile,
  printJson,
  printText,
  detectCommand,
};
