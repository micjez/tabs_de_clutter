import { DEFAULT_TEMPLATE, DEFAULT_BEHAVIOR } from './utils.js';
import { getExt } from './ext.js';
import { DEFAULT_OPENAI_MODEL, DEFAULT_MAX_INPUT_CHARS } from './openai-client.js';

export async function loadOptions() {
  const ext = getExt();
  const data = await ext.storageSyncGet([
    'template',
    'behavior',
    'openaiApiKey',
    'openaiModel',
    'summaryPromptOverride',
    'maxInputChars'
  ]);

  const templateElement = document.getElementById('template');
  const behaviorElement = document.getElementById('behavior');
  const apiKeyElement = document.getElementById('openaiApiKey');
  const modelElement = document.getElementById('openaiModel');
  const promptElement = document.getElementById('summaryPromptOverride');
  const maxInputCharsElement = document.getElementById('maxInputChars');

  if (templateElement) {
    templateElement.value = data.template !== undefined ? data.template : DEFAULT_TEMPLATE;
  }

  if (behaviorElement) {
    behaviorElement.value = data.behavior !== undefined ? data.behavior : DEFAULT_BEHAVIOR;
  }

  if (apiKeyElement) {
    apiKeyElement.value = data.openaiApiKey !== undefined ? data.openaiApiKey : '';
  }

  if (modelElement) {
    modelElement.value = data.openaiModel !== undefined ? data.openaiModel : DEFAULT_OPENAI_MODEL;
  }

  if (promptElement) {
    promptElement.value = data.summaryPromptOverride !== undefined ? data.summaryPromptOverride : '';
  }

  if (maxInputCharsElement) {
    const value = Number(data.maxInputChars);
    maxInputCharsElement.value = Number.isFinite(value) && value > 0
      ? String(Math.floor(value))
      : String(DEFAULT_MAX_INPUT_CHARS);
  }
}

export async function saveOptions() {
  const ext = getExt();
  const templateElement = document.getElementById('template');
  const behaviorElement = document.getElementById('behavior');
  const apiKeyElement = document.getElementById('openaiApiKey');
  const modelElement = document.getElementById('openaiModel');
  const promptElement = document.getElementById('summaryPromptOverride');
  const maxInputCharsElement = document.getElementById('maxInputChars');

  if (!templateElement || !behaviorElement) {
    return;
  }

  const template = templateElement.value.trim();
  const behavior = behaviorElement.value;
  const openaiApiKey = apiKeyElement ? apiKeyElement.value.trim() : '';
  const openaiModel = modelElement ? modelElement.value.trim() : DEFAULT_OPENAI_MODEL;
  const summaryPromptOverride = promptElement ? promptElement.value.trim() : '';
  const parsedMax = Number(maxInputCharsElement ? maxInputCharsElement.value : DEFAULT_MAX_INPUT_CHARS);
  const maxInputChars = Number.isFinite(parsedMax) && parsedMax > 0
    ? Math.floor(parsedMax)
    : DEFAULT_MAX_INPUT_CHARS;

  if (!template) {
    alert('Template cannot be empty.');
    return;
  }

  await ext.storageSyncSet({
    template,
    behavior,
    openaiApiKey,
    openaiModel,
    summaryPromptOverride,
    maxInputChars
  });
  alert('Saved.');
}

export function initializeOptions() {
  document.getElementById('save').addEventListener('click', saveOptions);
  loadOptions();
}

if (typeof document !== 'undefined' && document.getElementById('save')) {
  initializeOptions();
}
