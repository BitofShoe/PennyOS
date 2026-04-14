const {
  createAutomationApi,
} = require('./penny-lmstudio-prepare');

async function runPresetRepair() {
  const automationApi = createAutomationApi();
  return automationApi.ensurePresetWiring();
}

async function main() {
  const report = await runPresetRepair();
  const touched = report.repairedPaths || [];

  if (!touched.length) {
    console.log('LM Studio Penny preset wiring was already up to date, or no writable targets were found.');
  } else {
    console.log('Reasserted Penny preset in these LM Studio files:');
    for (const filePath of touched) {
      console.log(`- ${filePath}`);
    }
  }

  for (const warning of report.missingTargets || []) {
    console.log(`- WARN: ${warning}`);
  }
  if (report.selectedConversation?.needsRepair) {
    console.log('- WARN: Selected LM Studio conversation is not fully wired to the Penny preset.');
  }
  if (report.settings?.needsRepair) {
    console.log('- WARN: LM Studio settings still do not report experimental preset loading as enabled.');
  }
  console.log('Note: LM Studio owns the preset itself; Penny only verifies and reasserts the local wiring.');
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error?.stack || error?.message || String(error));
    process.exitCode = 1;
  });
}

module.exports = {
  runPresetRepair,
};
