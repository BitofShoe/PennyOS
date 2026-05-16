const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'output');
const STAMP = new Date().toISOString().replace(/[:.]/g, '-');
const OUTPUT_PATH = path.join(OUTPUT_DIR, `penny-next-cycle-${STAMP}.json`);
const SUMMARY_PATH = path.join(OUTPUT_DIR, `penny-next-cycle-${STAMP}.md`);
const MANUAL_CHECKLIST_PATH = path.join(ROOT_DIR, 'docs', 'penny-browser-manual-checklist.md');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function roundSeconds(ms) {
  return Math.round((Number(ms || 0) / 1000) * 100) / 100;
}

function npmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function buildNextCycleSteps() {
  return [
    { id: 'tests', label: 'Repo tests', command: npmCommand(), args: ['test'] },
    { id: 'runtime-fit', label: 'Runtime fit', command: npmCommand(), args: ['run', 'eval:runtime-fit'] },
    { id: 'probes', label: 'Probe eval', command: npmCommand(), args: ['run', 'eval:probes'] },
    { id: 'voice-redo', label: 'Voice redo QA', command: npmCommand(), args: ['run', 'qa:voice-redo'] },
    { id: 'memory-semantic', label: 'Memory semantic segment', command: npmCommand(), args: ['run', 'qa:memory:semantic'] },
    { id: 'memory-chapter', label: 'Memory chapter segment', command: npmCommand(), args: ['run', 'qa:memory:chapter'] },
    { id: 'memory-contradictions', label: 'Memory contradiction/premise segment', command: npmCommand(), args: ['run', 'qa:memory:contradictions'] },
    { id: 'memory-mixed', label: 'Memory mixed-drift segment', command: npmCommand(), args: ['run', 'qa:memory:mixed'] },
    { id: 'epistemic-compare', label: 'Epistemic compare', command: npmCommand(), args: ['run', 'eval:epistemic-compare'] },
    { id: 'browser-smoke', label: 'Browser smoke', command: npmCommand(), args: ['run', 'qa:browser:smoke'] },
  ];
}

function renderSummary(report = {}) {
  const lines = [
    '# Penny Next Cycle',
    '',
    `- Started: ${report.startedAt || ''}`,
    `- Finished: ${report.finishedAt || ''}`,
    `- Manual checklist: ${MANUAL_CHECKLIST_PATH}`,
    '',
    '## Steps',
  ];
  for (const step of report.steps || []) {
    lines.push(`- ${step.label}: ${step.ok ? 'passed' : 'failed'} (${step.seconds}s)`);
  }
  if (report.failedStep) {
    lines.push('');
    lines.push(`## Failed step`);
    lines.push(`- ${report.failedStep.label}: ${report.failedStep.error || 'Unknown error'}`);
  }
  return `${lines.join('\n')}\n`;
}

function runStep(step) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(step.command, step.args, {
      cwd: ROOT_DIR,
      stdio: 'inherit',
      windowsHide: true,
      env: process.env,
    });
    child.once('exit', (code, signal) => {
      resolve({
        ...step,
        ok: code === 0,
        exitCode: code,
        signal: signal || '',
        seconds: roundSeconds(Date.now() - started),
        error: code === 0 ? '' : `Exited with code ${code}${signal ? ` (${signal})` : ''}`,
      });
    });
  });
}

async function main() {
  ensureDir(OUTPUT_DIR);
  const report = {
    startedAt: new Date().toISOString(),
    manualChecklistPath: MANUAL_CHECKLIST_PATH,
    steps: [],
    releasePath: 'branch-then-pr',
  };

  for (const step of buildNextCycleSteps()) {
    const result = await runStep(step);
    report.steps.push(result);
    fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`);
    if (!result.ok) {
      report.failedStep = result;
      report.finishedAt = new Date().toISOString();
      fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`);
      fs.writeFileSync(SUMMARY_PATH, renderSummary(report));
      throw new Error(`Next-cycle runner stopped at ${result.label}: ${result.error}`);
    }
  }

  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(SUMMARY_PATH, renderSummary(report));
  console.log(`Saved Penny next-cycle report to ${OUTPUT_PATH}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error?.stack || error?.message || String(error));
    process.exitCode = 1;
  });
}

module.exports = {
  main,
  buildNextCycleSteps,
};
