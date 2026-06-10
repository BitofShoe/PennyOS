const fs = require('node:fs');
const path = require('node:path');

const REQUIRED_SCHEMA = 'penny-skill-baseline.v1';
const ALLOWED_MEASUREMENT_MODES = new Set(['fixture-only', 'local-static', 'local-live-isolated']);
const ALLOWED_VERDICTS = new Set(['pass', 'fail', 'invalid', 'not-run']);
const ALLOWED_DECISIONS = new Set(['skill_helped', 'skill_hurt', 'neutral', 'inconclusive']);
const FORBIDDEN_GUARDRAIL_FLAGS = [
  'liveLmStudioTouched',
  'liveUserMemoryTouched',
  'promptTruthChanged',
  'toolEvidenceReceiptChanged',
  'runtimeVoiceChanged',
];

function makeFailure(filePath, code, message) {
  return {
    code,
    message: `${filePath}: ${message}`,
  };
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function verdictPassed(result) {
  return result && result.verdict === 'pass';
}

function validateVariant(filePath, failures, caseIndex, caseItem, key) {
  const variant = caseItem[key];
  if (!isObject(variant)) {
    failures.push(makeFailure(filePath, `case-missing:${key}`, `case ${caseIndex} is missing ${key} result`));
    return;
  }

  if (!ALLOWED_VERDICTS.has(variant.verdict)) {
    failures.push(makeFailure(
      filePath,
      `case-invalid:${key}.verdict`,
      `case ${caseIndex} ${key}.verdict must be one of ${Array.from(ALLOWED_VERDICTS).join(', ')}`,
    ));
  }

  for (const numberField of ['durationMs', 'eventCount']) {
    if (!(typeof variant[numberField] === 'number' || variant[numberField] === null)) {
      failures.push(makeFailure(
        filePath,
        `case-invalid:${key}.${numberField}`,
        `case ${caseIndex} ${key}.${numberField} must be a number or null`,
      ));
    }
  }

  if (variant.cleanupOk !== true) {
    failures.push(makeFailure(
      filePath,
      `case-invalid:${key}.cleanupOk`,
      `case ${caseIndex} ${key}.cleanupOk must be true`,
    ));
  }

  if (!variant.artifactPath && !variant.receiptPath) {
    failures.push(makeFailure(
      filePath,
      `case-invalid:${key}.artifactPath`,
      `case ${caseIndex} ${key} must include artifactPath or receiptPath`,
    ));
  }
}

function validateComparison(filePath, failures, caseIndex, caseItem) {
  if (!isObject(caseItem.comparison)) {
    failures.push(makeFailure(filePath, 'case-missing:comparison', `case ${caseIndex} is missing comparison`));
    return;
  }

  const decision = caseItem.comparison.decision;
  if (!ALLOWED_DECISIONS.has(decision)) {
    failures.push(makeFailure(
      filePath,
      'comparison-invalid:decision',
      `case ${caseIndex} comparison.decision must be one of ${Array.from(ALLOWED_DECISIONS).join(', ')}`,
    ));
    return;
  }

  const noSkillPassed = verdictPassed(caseItem.noSkill);
  const withSkillPassed = verdictPassed(caseItem.withSkill);

  if (decision === 'skill_helped' && !(withSkillPassed && !noSkillPassed)) {
    failures.push(makeFailure(
      filePath,
      'comparison-inconsistent:skill_helped',
      `case ${caseIndex} claims skill_helped without withSkill pass and noSkill fail`,
    ));
  }

  if (decision === 'skill_hurt' && !(noSkillPassed && !withSkillPassed)) {
    failures.push(makeFailure(
      filePath,
      'comparison-inconsistent:skill_hurt',
      `case ${caseIndex} claims skill_hurt without noSkill pass and withSkill fail`,
    ));
  }
}

function analyzeSkillBaselineArtifact(artifact, { filePath = '<artifact>' } = {}) {
  const failures = [];

  if (!isObject(artifact)) {
    return {
      ok: false,
      filePath,
      failures: [makeFailure(filePath, 'artifact-invalid:json-object', 'artifact must be a JSON object')],
    };
  }

  if (artifact.schema !== REQUIRED_SCHEMA) {
    failures.push(makeFailure(
      filePath,
      'artifact-invalid:schema',
      `schema must be ${REQUIRED_SCHEMA}`,
    ));
  }

  if (!ALLOWED_MEASUREMENT_MODES.has(artifact.measurementMode)) {
    failures.push(makeFailure(
      filePath,
      'artifact-invalid:measurementMode',
      `measurementMode must be one of ${Array.from(ALLOWED_MEASUREMENT_MODES).join(', ')}`,
    ));
  }

  if (!isObject(artifact.guardrails)) {
    failures.push(makeFailure(filePath, 'artifact-missing:guardrails', 'artifact must include guardrails'));
  } else {
    for (const flag of FORBIDDEN_GUARDRAIL_FLAGS) {
      if (artifact.guardrails[flag] !== false) {
        failures.push(makeFailure(
          filePath,
          `guardrail-live-side-effect:${flag}`,
          `guardrails.${flag} must be false`,
        ));
      }
    }
  }

  if (!Array.isArray(artifact.cases) || artifact.cases.length === 0) {
    failures.push(makeFailure(filePath, 'artifact-missing:cases', 'artifact must include at least one case'));
  } else {
    artifact.cases.forEach((caseItem, index) => {
      if (!isObject(caseItem)) {
        failures.push(makeFailure(filePath, 'case-invalid:object', `case ${index} must be an object`));
        return;
      }
      if (!caseItem.taskId) {
        failures.push(makeFailure(filePath, 'case-missing:taskId', `case ${index} is missing taskId`));
      }
      if (!caseItem.skillName) {
        failures.push(makeFailure(filePath, 'case-missing:skillName', `case ${index} is missing skillName`));
      }
      validateVariant(filePath, failures, index, caseItem, 'noSkill');
      validateVariant(filePath, failures, index, caseItem, 'withSkill');
      validateComparison(filePath, failures, index, caseItem);
    });
  }

  const limits = Array.isArray(artifact.limits) ? artifact.limits.join('\n') : '';
  if (!/does not prove live agent quality/i.test(limits)) {
    failures.push(makeFailure(
      filePath,
      'artifact-missing:live-quality-limit',
      'limits must state that the artifact does not prove live agent quality',
    ));
  }

  return {
    ok: failures.length === 0,
    filePath,
    failures,
  };
}

function checkSkillBaselineFile(filePath) {
  const resolved = path.resolve(filePath);
  const artifact = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  return analyzeSkillBaselineArtifact(artifact, { filePath });
}

function checkSkillBaselineFiles(filePaths) {
  return filePaths.map(checkSkillBaselineFile);
}

function main(argv = process.argv.slice(2)) {
  const filePaths = argv.filter((arg) => !arg.startsWith('-'));
  if (!filePaths.length) {
    console.error('Usage: node scripts/check-penny-skill-baselines.js <baseline.json> [more-baseline.json ...]');
    process.exit(2);
  }

  const results = checkSkillBaselineFiles(filePaths);
  const failures = results.flatMap((result) => result.failures);
  if (failures.length) {
    console.error(`Penny skill-baseline check failed (${failures.length} finding${failures.length === 1 ? '' : 's'}):`);
    for (const failure of failures) {
      console.error(`- ${failure.code}: ${failure.message}`);
    }
    process.exit(1);
  }

  console.log(`Penny skill-baseline check passed (${results.length} file${results.length === 1 ? '' : 's'}).`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`Penny skill-baseline check failed: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  ALLOWED_DECISIONS,
  ALLOWED_MEASUREMENT_MODES,
  ALLOWED_VERDICTS,
  FORBIDDEN_GUARDRAIL_FLAGS,
  REQUIRED_SCHEMA,
  analyzeSkillBaselineArtifact,
  checkSkillBaselineFile,
  checkSkillBaselineFiles,
};
