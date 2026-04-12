const fs = require('fs');
const path = require('path');

const USER_HOME = process.env.USERPROFILE || process.env.HOME || '';
const APPDATA = process.env.APPDATA || '';
const PENNY_PRESET_IDENTIFIER = '@local:penny';
const SETTINGS_PATH = path.join(APPDATA, 'LM Studio', 'settings.json');
const CONVERSATION_CONFIG_PATH = path.join(USER_HOME, '.lmstudio', '.internal', 'conversation-config.json');
const CONVERSATIONS_DIR = path.join(USER_HOME, '.lmstudio', 'conversations');
const MODEL_DEFAULT_CONFIGS = [
  path.join(USER_HOME, '.lmstudio', '.internal', 'user-concrete-model-default-config', 'google', 'gemma-4-31b.json'),
  path.join(USER_HOME, '.lmstudio', '.internal', 'user-concrete-model-default-config', 'unsloth', 'gemma-4-31B-it-GGUF', 'gemma-4-31B-it-Q6_K.gguf.json'),
  path.join(USER_HOME, '.lmstudio', '.internal', 'user-concrete-model-default-config', 'unsloth', 'gemma-4-31B-it-GGUF', 'gemma-4-31B-it-Q4_K_S.gguf.json'),
  path.join(USER_HOME, '.lmstudio', '.internal', 'user-concrete-model-default-config', 'HauhauCS', 'Gemma-4-E4B-Uncensored-HauhauCS-Aggressive', 'Gemma-4-E4B-Uncensored-HauhauCS-Aggressive-Q8_K_P.gguf.json'),
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function patchSettings() {
  if (!fs.existsSync(SETTINGS_PATH)) return null;
  const settings = readJson(SETTINGS_PATH);
  settings.developer = settings.developer || {};
  settings.developer.experimentalLoadPresets = true;
  writeJson(SETTINGS_PATH, settings);
  return SETTINGS_PATH;
}

function patchSelectedConversation() {
  if (!fs.existsSync(CONVERSATION_CONFIG_PATH)) return null;
  const config = readJson(CONVERSATION_CONFIG_PATH);
  const selectedConversation = String(config.selectedConversation || '').trim();
  if (!selectedConversation) return null;
  const conversationPath = path.join(CONVERSATIONS_DIR, selectedConversation);
  if (!fs.existsSync(conversationPath)) return null;
  const conversation = readJson(conversationPath);
  conversation.preset = PENNY_PRESET_IDENTIFIER;
  writeJson(conversationPath, conversation);
  return conversationPath;
}

function patchModelDefaults() {
  const touched = [];
  for (const filePath of MODEL_DEFAULT_CONFIGS) {
    if (!fs.existsSync(filePath)) continue;
    const config = readJson(filePath);
    config.preset = PENNY_PRESET_IDENTIFIER;
    config.operation = config.operation || { fields: [] };
    config.load = config.load || { fields: [] };
    writeJson(filePath, config);
    touched.push(filePath);
  }
  return touched;
}

function main() {
  const touched = [];
  const settings = patchSettings();
  if (settings) touched.push(settings);
  const conversation = patchSelectedConversation();
  if (conversation) touched.push(conversation);
  touched.push(...patchModelDefaults());

  if (!touched.length) {
    console.log('No LM Studio preset targets were found to patch.');
    return;
  }

  console.log('Reasserted Penny preset in these LM Studio files:');
  for (const filePath of touched) {
    console.log(`- ${filePath}`);
  }
  console.log('Note: LM Studio UI/default state should prefer Penny now, but raw API calls still rely on Penny server prompts.');
}

main();
