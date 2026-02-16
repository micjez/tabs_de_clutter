import {
  DEFAULT_TEMPLATE,
  DEFAULT_BEHAVIOR,
  normalizeUrl,
  renderTemplate,
  incrementName
} from './utils.js';
import { getExt } from './ext.js';

function toChromeLikeAPI(api) {
  if (!api) return api;
  if (api.storage?.sync?.get && api.tabs?.query) return api;

  return {
    storage: {
      sync: {
        get: api.storageSyncGet,
        set: api.storageSyncSet
      }
    },
    tabs: {
      query: api.tabsQuery,
      remove: api.tabsRemove
    },
    bookmarks: {
      getTree: api.bookmarksGetTree,
      getChildren: api.bookmarksGetChildren,
      create: api.bookmarksCreate
    }
  };
}

function isInternalUrl(url) {
  const u = String(url ?? '');
  return u.startsWith('chrome://') || u.startsWith('about:') || u.startsWith('moz-extension://');
}

export async function getSettings(chromeAPI = chrome) {
  chromeAPI = toChromeLikeAPI(chromeAPI === chrome ? getExt() : chromeAPI);
  const data = await chromeAPI.storage.sync.get(["template", "behavior"]);
  return {
    template: data.template !== undefined ? data.template : DEFAULT_TEMPLATE,
    behavior: data.behavior !== undefined ? data.behavior : DEFAULT_BEHAVIOR
  };
}

export async function closeDuplicatesInCurrentWindow(chromeAPI = chrome) {
  chromeAPI = toChromeLikeAPI(chromeAPI === chrome ? getExt() : chromeAPI);
  const allTabs = await chromeAPI.tabs.query({ currentWindow: true });
  const tabs = (allTabs || []).filter(t => t && !t.incognito);

  const seen = new Set();
  const duplicateIds = [];

  for (const tab of tabs) {
    if (!tab || !tab.id || !tab.url) continue;
    if (isInternalUrl(tab.url)) continue;

    const normalized = normalizeUrl(tab.url);
    if (seen.has(normalized)) {
      duplicateIds.push(tab.id);
      continue;
    }
    seen.add(normalized);
  }

  if (duplicateIds.length > 0) {
    await chromeAPI.tabs.remove(duplicateIds);
  }
}

export async function getOtherBookmarksFolder(chromeAPI = chrome) {
  chromeAPI = toChromeLikeAPI(chromeAPI === chrome ? getExt() : chromeAPI);
  const tree = await chromeAPI.bookmarks.getTree();
  if (!tree || tree.length === 0) return undefined;
  const root = tree[0];
  if (!root || !root.children) return undefined;
  return root.children.find(node => node.title.toLowerCase().includes("other"));
}

export async function createFolderName(parentId, baseName, behavior, chromeAPI = chrome) {
  chromeAPI = toChromeLikeAPI(chromeAPI === chrome ? getExt() : chromeAPI);
  const children = await chromeAPI.bookmarks.getChildren(parentId);
  const existingNames = (children || []).map(c => c.title);

  if (!existingNames.includes(baseName)) return baseName;
  if (behavior === "append") return baseName;
  return incrementName(baseName, existingNames);
}

export async function bookmarkCurrentWindowTabs(chromeAPI = chrome) {
  chromeAPI = toChromeLikeAPI(chromeAPI === chrome ? getExt() : chromeAPI);
  const { template, behavior } = await getSettings(chromeAPI);
  const baseName = renderTemplate(template);
  if (!String(baseName || '').trim()) return;

  const other = await getOtherBookmarksFolder(chromeAPI);
  if (!other) return;

  const finalName = await createFolderName(other.id, baseName, behavior, chromeAPI);
  let folder;

  if (behavior === "append") {
    const children = await chromeAPI.bookmarks.getChildren(other.id);
    folder = (children || []).find(c => c && c.title === finalName);
  }

  if (!folder) {
    folder = await chromeAPI.bookmarks.create({ parentId: other.id, title: finalName });
  }

  const allTabs = await chromeAPI.tabs.query({ currentWindow: true });
  const tabs = (allTabs || []).filter(t => t && !t.incognito);

  const seen = new Set();
  const existing = await chromeAPI.bookmarks.getChildren(folder.id);
  (existing || []).forEach(b => b && b.url && seen.add(normalizeUrl(b.url)));

  for (const tab of tabs) {
    if (!tab || !tab.url || isInternalUrl(tab.url)) continue;

    const normalized = normalizeUrl(tab.url);
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    await chromeAPI.bookmarks.create({
      parentId: folder.id,
      title: tab.title,
      url: tab.url
    });
  }
}

const runtime = (typeof browser !== 'undefined' && browser.runtime)
  ? browser.runtime
  : ((typeof chrome !== 'undefined' && chrome.runtime) ? chrome.runtime : undefined);

if (runtime && runtime.onMessage) {
  runtime.onMessage.addListener((msg) => {
    if (msg?.action === 'bookmark_window') bookmarkCurrentWindowTabs();
    if (msg?.action === 'close_duplicates') closeDuplicatesInCurrentWindow();
  });
}
