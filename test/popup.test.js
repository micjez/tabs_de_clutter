import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { setupPopup } from '../src/shared/popup.js';

describe('popup.js', () => {
  let mockChrome;

  beforeEach(() => {
    document.body.innerHTML = `
      <button id="dedupeBtn">dedupe</button>
      <button id="bookmarkBtn">bookmark</button>
      <button id="saveAsNoteBtn">save as note</button>
      <button id="preferencesBtn">prefs</button>
    `;

    mockChrome = {
      runtime: {
        sendMessage: jest.fn(),
        openOptionsPage: jest.fn()
      }
    };

    global.chrome = mockChrome;

    Object.defineProperty(window, 'close', {
      value: jest.fn(),
      configurable: true
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete global.chrome;
  });

  it('wires listeners and triggers close_duplicates on dedupe click', () => {
    setupPopup();
    document.getElementById('dedupeBtn').click();

    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({ action: 'close_duplicates' });
    expect(window.close).toHaveBeenCalled();
  });

  it('wires listeners and triggers bookmark_window on bookmark click', () => {
    setupPopup();
    document.getElementById('bookmarkBtn').click();

    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({ action: 'bookmark_window' });
    expect(window.close).toHaveBeenCalled();
  });

  it('wires listeners and triggers save_current_tab_as_note on save note click', () => {
    setupPopup();
    document.getElementById('saveAsNoteBtn').click();

    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({ action: 'save_current_tab_as_note' });
    expect(window.close).toHaveBeenCalled();
  });

  it('wires listener and opens options page on preferences click', () => {
    setupPopup();
    document.getElementById('preferencesBtn').click();

    expect(mockChrome.runtime.openOptionsPage).toHaveBeenCalled();
  });

  it('handles missing elements gracefully', () => {
    document.body.innerHTML = '';
    expect(() => setupPopup()).not.toThrow();
  });

  it('handles partial missing elements gracefully', () => {
    document.body.innerHTML = `<button id="dedupeBtn">dedupe</button>`;
    expect(() => setupPopup()).not.toThrow();
    document.getElementById('dedupeBtn').click();
    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({ action: 'close_duplicates' });
  });
});
