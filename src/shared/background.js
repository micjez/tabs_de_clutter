import {
  DEFAULT_TEMPLATE,
  DEFAULT_BEHAVIOR,
  normalizeUrl,
  renderTemplate,
  incrementName
} from './utils.js';
import { getExt } from './ext.js';
import { saveMarkdownFile } from './file-handler.js';

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

// Temporary workaround: create file handler functions inline since import is failing
function sanitizeFilename(name) {
  return name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 200);
}

async function saveFileWithFirefoxAPI(filename, content) {
  const ext = getExt();
  
  try {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    
    const downloadId = await ext.downloadsDownload({
      url: url,
      filename: filename,
      saveAs: true // Always show save dialog
    });
    
    URL.revokeObjectURL(url);
    return downloadId;
  } catch (error) {
    // Don't show error for user cancellation
    if (error.name !== 'AbortError' && !error.message.includes('canceled')) {
      console.error('Firefox download error:', error);
      throw error;
    }
  }
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
