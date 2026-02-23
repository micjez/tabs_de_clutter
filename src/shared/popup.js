import { getExt } from './ext.js';

function collectBookmarkFolders(nodes, path = [], result = []) {
  for (const node of nodes || []) {
    if (!node || node.url) continue;

    const rawTitle = String(node.title || '').trim();
    const title = rawTitle || 'Untitled';
    const isRoot = node.id === '0' || rawTitle === '';

    const nextPath = isRoot ? path : [...path, title];
    if (!isRoot && node.id) {
      result.push({
        id: node.id,
        label: nextPath.join(' > ')
      });
    }

    if (Array.isArray(node.children) && node.children.length > 0) {
      collectBookmarkFolders(node.children, nextPath, result);
    }
  }

  return result;
}

async function loadBookmarkFolderOptions(ext, folderSelect, hintElement) {
  if (!folderSelect || !ext.bookmarksGetTree) return;

  try {
    const tree = await ext.bookmarksGetTree();
    const folders = collectBookmarkFolders(tree);

    if (folders.length === 0) {
      if (hintElement) hintElement.textContent = 'No bookmark folders found.';
      return;
    }

    for (const folder of folders) {
      const option = document.createElement('option');
      option.value = folder.id;
      option.textContent = folder.label;
      folderSelect.appendChild(option);
    }
  } catch (error) {
    if (hintElement) hintElement.textContent = 'Unable to load bookmark folders.';
    console.error('Failed to load bookmark folders:', error);
  }
}

export function setupPopup() {
  const dedupeBtn = document.getElementById('dedupeBtn');
  const bookmarkBtn = document.getElementById('bookmarkBtn');
  const saveAsNoteBtn = document.getElementById('saveAsNoteBtn');
  const saveUrlAsNoteBtn = document.getElementById('saveUrlAsNoteBtn');
  const bookmarkFolderSelect = document.getElementById('bookmarkFolderSelect');
  const exportFolderBtn = document.getElementById('exportFolderBtn');
  const bookmarkExportHint = document.getElementById('bookmarkExportHint');
  const preferencesBtn = document.getElementById('preferencesBtn');

  const ext = getExt();
  loadBookmarkFolderOptions(ext, bookmarkFolderSelect, bookmarkExportHint);

  if (dedupeBtn) {
    dedupeBtn.addEventListener('click', () => {
      ext.runtimeSendMessage({ action: 'close_duplicates' });
      window.close();
    });
  }

  if (bookmarkBtn) {
    bookmarkBtn.addEventListener('click', () => {
      ext.runtimeSendMessage({ action: 'bookmark_window' });
      window.close();
    });
  }

  if (saveAsNoteBtn) {
    saveAsNoteBtn.addEventListener('click', () => {
      ext.runtimeSendMessage({ action: 'save_current_tab_as_note' });
      window.close();
    });
  }

  if (saveUrlAsNoteBtn) {
    saveUrlAsNoteBtn.addEventListener('click', () => {
      ext.runtimeSendMessage({ action: 'save_current_tab_url_as_note' });
      window.close();
    });
  }

  if (exportFolderBtn && bookmarkFolderSelect) {
    exportFolderBtn.addEventListener('click', () => {
      const folderId = bookmarkFolderSelect.value;
      if (!folderId) {
        if (bookmarkExportHint) bookmarkExportHint.textContent = 'Please select a folder first.';
        return;
      }
      ext.runtimeSendMessage({
        action: 'save_bookmark_folder_as_note',
        folderId
      });
      window.close();
    });
  }

  if (preferencesBtn) {
    preferencesBtn.addEventListener('click', () => {
      ext.runtimeOpenOptionsPage();
    });
  }
}

if (typeof document !== 'undefined' && document.getElementById('dedupeBtn')) {
  setupPopup();
}
