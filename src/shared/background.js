import {
  DEFAULT_TEMPLATE,
  DEFAULT_BEHAVIOR,
  normalizeUrl,
  renderTemplate,
  incrementName
} from './utils.js';
import { getExt } from './ext.js';
import { saveMarkdownFile } from './file-handler.js';
import {
  summarizeArticleAsMarkdown,
  DEFAULT_OPENAI_MODEL,
  DEFAULT_MAX_INPUT_CHARS
} from './openai-client.js';

// Temporary workaround: create the functions inline since import is failing
function extractBookmarksFromFolder(folderNode, folderMap = {}) {
  const bookmarks = [];
  
  if (!folderNode) return bookmarks;
  
  folderMap[folderNode.id] = folderNode;
  
  if (folderNode.children) {
    for (const child of folderNode.children) {
      if (child.url) {
        bookmarks.push({
          id: child.id,
          title: child.title,
          url: child.url,
          dateAdded: child.dateAdded,
          parentId: child.parentId || folderNode.id,
          index: child.index,
          folderPath: buildFolderPath(child, folderMap)
        });
      } else if (child.children) {
        const childBookmarks = extractBookmarksFromFolder(child, folderMap);
        bookmarks.push(...childBookmarks);
      }
    }
  }
  
  return bookmarks;
}

function buildFolderPath(bookmark, folderMap) {
  const path = [];
  let currentId = bookmark.parentId;
  const visited = new Set();
  
  while (currentId && folderMap[currentId] && !visited.has(currentId)) {
    visited.add(currentId);
    path.unshift(folderMap[currentId].title);
    currentId = folderMap[currentId].parentId;
  }
  
  return path.join(' > ');
}

function generateMarkdownTable(bookmarks) {
  if (!bookmarks || bookmarks.length === 0) {
    return '# Bookmarks\n\nNo bookmarks found.';
  }

  let table = '# Bookmarks\n\n';
  table += '| Title | Date Added | Folder Path |\n';
  table += '|-------|------------|-------------|\n';

  for (const bookmark of bookmarks) {
    const title = bookmark.title || 'Untitled';
    const url = bookmark.url || '';
    const dateAdded = bookmark.dateAdded ? new Date(bookmark.dateAdded).toLocaleString() : '';
    const folderPath = bookmark.folderPath || '';

    const escapedTitle = title.replace(/[\\\`*{}[\]()#+\-.!_>~|]/g, '\\$&');
    const escapedUrl = url.replace(/[\\\`*{}[\]()#+\-.!_>~|]/g, '\\$&');
    const escapedFolder = folderPath.replace(/[\\\`*{}[\]()#+\-.!_>~|]/g, '\\$&');

    table += `| [${escapedTitle}](${escapedUrl}) | ${dateAdded} | ${escapedFolder} |\n`;
  }

  return table;
}

export { extractBookmarksFromFolder, buildFolderPath, generateMarkdownTable };

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
    },
    contextMenus: {
      removeAll: api.contextMenusRemoveAll,
      create: api.contextMenusCreate
    }
  };
}

function isInternalUrl(url) {
  const u = String(url ?? '');
  return u.startsWith('chrome://') || u.startsWith('about:') || u.startsWith('moz-extension://');
}

function getNativeAPI(api) {
  if (api) return api;
  if (typeof browser !== 'undefined') return browser;
  if (typeof chrome !== 'undefined') return chrome;
  return undefined;
}

export async function getAiNoteSettings(chromeAPI = chrome) {
  chromeAPI = toChromeLikeAPI(chromeAPI === chrome ? getExt() : chromeAPI);
  const data = (await chromeAPI.storage.sync.get([
    'openaiApiKey',
    'openaiModel',
    'summaryPromptOverride',
    'maxInputChars'
  ])) || {};

  const parsedMax = Number(data.maxInputChars);
  return {
    openaiApiKey: data.openaiApiKey !== undefined ? data.openaiApiKey : '',
    openaiModel: data.openaiModel !== undefined ? data.openaiModel : DEFAULT_OPENAI_MODEL,
    summaryPromptOverride: data.summaryPromptOverride !== undefined ? data.summaryPromptOverride : '',
    maxInputChars: Number.isFinite(parsedMax) && parsedMax > 0
      ? Math.floor(parsedMax)
      : DEFAULT_MAX_INPUT_CHARS
  };
}

export async function getSettings(chromeAPI = chrome) {
  chromeAPI = toChromeLikeAPI(chromeAPI === chrome ? getExt() : chromeAPI);
  const data = (await chromeAPI.storage.sync.get(["template", "behavior"])) || {};
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

export async function saveBookmarkFolderAsNote(folderId, chromeAPI = chrome) {
  chromeAPI = toChromeLikeAPI(chromeAPI === chrome ? getExt() : chromeAPI);
  
  try {
    const settings = await getSettings(chromeAPI);
    const tree = await chromeAPI.bookmarks.getTree();
    
    const folderNode = findFolderById(tree, folderId);
    if (!folderNode) {
      console.error('Folder not found:', folderId);
      return;
    }
    
    const bookmarks = extractBookmarksFromFolder(folderNode);
    if (bookmarks.length === 0) {
      console.log('No bookmarks found in folder:', folderNode.title);
      return;
    }
    
    const markdownContent = generateMarkdownTable(bookmarks);
    
    await saveMarkdownFile(folderNode.title, markdownContent);
    console.log('Saved bookmark folder as note:', folderNode.title);
  } catch (error) {
    console.error('Error saving bookmark folder as note:', error);
  }
}

function extractReadableContentInPage() {
  const clean = (value) => String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const candidates = [];
  const selectors = ['article', 'main', '[role="main"]'];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element && element.innerText) {
      candidates.push(element.innerText);
    }
  }

  if (document.body && document.body.innerText) {
    candidates.push(document.body.innerText);
  }

  const content = candidates
    .map(clean)
    .sort((a, b) => b.length - a.length)[0] || '';

  return {
    title: document.title || 'untitled',
    url: location.href,
    content
  };
}

export async function extractActiveTabContent(nativeAPI) {
  const tabs = await nativeAPI.tabs.query({ active: true, currentWindow: true });
  const activeTab = (tabs || [])[0];

  if (!activeTab || !activeTab.id) {
    throw new Error('No active tab available.');
  }

  if (isInternalUrl(activeTab.url)) {
    throw new Error('This page cannot be summarized.');
  }

  if (nativeAPI.scripting && nativeAPI.scripting.executeScript) {
    const results = await nativeAPI.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: extractReadableContentInPage
    });
    return results?.[0]?.result;
  }

  if (nativeAPI.tabs && nativeAPI.tabs.executeScript) {
    const code = `(${extractReadableContentInPage.toString()})()`;
    const results = await nativeAPI.tabs.executeScript(activeTab.id, { code });
    return Array.isArray(results) ? results[0] : results;
  }

  throw new Error('Script injection API is not available.');
}

function buildNoteFilename(title) {
  const cleaned = String(title || 'note')
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 120);

  const date = new Date().toISOString().slice(0, 10);
  return `${cleaned || 'note'}_${date}`;
}

export async function saveCurrentTabAsNote(chromeAPI = chrome, fetchImpl = globalThis.fetch) {
  const settingsAPI = toChromeLikeAPI(chromeAPI === chrome ? getExt() : chromeAPI);
  const nativeAPI = getNativeAPI(chromeAPI === chrome ? undefined : chromeAPI);
  const settings = await getAiNoteSettings(settingsAPI);

  if (!settings.openaiApiKey) {
    throw new Error('OpenAI API key is missing. Set it in Preferences.');
  }

  const extracted = await extractActiveTabContent(nativeAPI);
  if (!extracted || !String(extracted.content || '').trim()) {
    throw new Error('Could not extract readable content from this page.');
  }

  const capturedAt = new Date().toISOString();
  const content = String(extracted.content).slice(0, settings.maxInputChars);
  const article = {
    title: extracted.title || 'Untitled',
    url: extracted.url || '',
    capturedAt,
    content
  };

  const markdown = await summarizeArticleAsMarkdown({
    apiKey: settings.openaiApiKey,
    model: settings.openaiModel,
    promptOverride: settings.summaryPromptOverride,
    article,
    fetchImpl
  });

  const finalMarkdown = [
    markdown.trim(),
    '',
    '---',
    `Source: ${article.url}`,
    `Captured: ${article.capturedAt}`
  ].join('\n');

  await saveMarkdownFile(buildNoteFilename(article.title), finalMarkdown);
}

function findFolderById(tree, folderId) {
  for (const node of tree) {
    if (node.id === folderId && !node.url) {
      return node;
    }
    if (node.children) {
      const found = findFolderById(node.children, folderId);
      if (found) return found;
    }
  }
  return null;
}

export async function createContextMenus(chromeAPI = chrome) {
  chromeAPI = toChromeLikeAPI(chromeAPI === chrome ? getExt() : chromeAPI);
  
  try {
    await chromeAPI.contextMenus.removeAll();
    
    chromeAPI.contextMenus.create({
      id: 'save-as-note',
      title: 'Save as note',
      contexts: ['bookmark'],
      documentUrlPatterns: []
    });
  } catch (error) {
    console.error('Error creating context menus:', error);
  }
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
    if (msg?.action === 'save_current_tab_as_note') {
      saveCurrentTabAsNote().catch((error) => {
        console.error('Error saving current tab as note:', error);
      });
    }
  });
}

if (runtime && runtime.onInstalled) {
  runtime.onInstalled.addListener(() => {
    createContextMenus();
  });
}

// Register context menu click handler for both Chrome and Firefox
if (typeof browser !== 'undefined' && browser.contextMenus && browser.contextMenus.onClicked) {
  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'save-as-note') {
      saveBookmarkFolderAsNote(info.bookmarkId);
    }
  });
} else if (typeof chrome !== 'undefined' && chrome.contextMenus && chrome.contextMenus.onClicked) {
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'save-as-note') {
      saveBookmarkFolderAsNote(info.bookmarkId);
    }
  });
}
