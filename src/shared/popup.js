import { getExt } from './ext.js';

export function setupPopup() {
  const dedupeBtn = document.getElementById('dedupeBtn');
  const bookmarkBtn = document.getElementById('bookmarkBtn');
  const saveAsNoteBtn = document.getElementById('saveAsNoteBtn');
  const saveUrlAsNoteBtn = document.getElementById('saveUrlAsNoteBtn');
  const preferencesBtn = document.getElementById('preferencesBtn');

  const ext = getExt();

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

  if (preferencesBtn) {
    preferencesBtn.addEventListener('click', () => {
      ext.runtimeOpenOptionsPage();
    });
  }
}

if (typeof document !== 'undefined' && document.getElementById('dedupeBtn')) {
  setupPopup();
}
