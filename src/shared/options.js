import { DEFAULT_TEMPLATE, DEFAULT_BEHAVIOR } from './utils.js';
import { getExt } from './ext.js';

export async function loadOptions() {
  const ext = getExt();
  const data = await ext.storageSyncGet(["template", "behavior"]);

  const templateElement = document.getElementById("template");
  const behaviorElement = document.getElementById("behavior");

  if (templateElement) {
    templateElement.value = data.template !== undefined ? data.template : DEFAULT_TEMPLATE;
  }

  if (behaviorElement) {
    behaviorElement.value = data.behavior !== undefined ? data.behavior : DEFAULT_BEHAVIOR;
  }
}

export async function saveOptions() {
  const ext = getExt();
  const templateElement = document.getElementById("template");
  const behaviorElement = document.getElementById("behavior");

  if (!templateElement || !behaviorElement) {
    return;
  }

  const template = templateElement.value.trim();
  const behavior = behaviorElement.value;

  if (!template) {
    alert("Template cannot be empty.");
    return;
  }

  await ext.storageSyncSet({ template, behavior });
  alert("Saved.");
}

export function initializeOptions() {
  document.getElementById("save").addEventListener("click", saveOptions);
  loadOptions();
}

if (typeof document !== 'undefined' && document.getElementById("save")) {
  initializeOptions();
}
