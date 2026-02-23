import { getExt } from './ext.js';

export function sanitizeFilename(name) {
  if (!name) return '';
  return name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 200);
}

export async function showDirectoryPicker() {
  const ext = getExt();
  
  if (typeof window !== 'undefined' && window.showDirectoryPicker) {
    try {
      const dirHandle = await window.showDirectoryPicker();
      return dirHandle;
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Directory picker error:', error);
      }
      return null;
    }
  }
  
  return null;
}

export async function saveFileWithChromeAPI(filename, content, directoryHandle) {
  if (!directoryHandle) {
    throw new Error('No directory handle provided');
  }
  
  try {
    const fileHandle = await directoryHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
    return true;
  } catch (error) {
    console.error('Chrome file save error:', error);
    throw error;
  }
}

export async function saveFileWithFirefoxAPI(filename, content, defaultPath = null) {
  const ext = getExt();
  
  try {
    let url;
    let revokeUrl = null;

    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      const blob = new Blob([content], { type: 'text/markdown' });
      url = URL.createObjectURL(blob);
      revokeUrl = url;
    } else {
      // createObjectURL is not always available in extension worker contexts.
      const bytes = new TextEncoder().encode(String(content));
      let binary = '';
      for (const byte of bytes) {
        binary += String.fromCharCode(byte);
      }
      const encoded = btoa(binary);
      url = `data:text/markdown;charset=utf-8;base64,${encoded}`;
    }
    
    const downloadId = await ext.downloadsDownload({
      url: url,
      filename: defaultPath ? `${defaultPath}/${filename}` : filename,
      saveAs: true
    });
    
    if (revokeUrl && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(revokeUrl);
    }
    return downloadId;
  } catch (error) {
    console.error('Firefox download error:', error);
    throw error;
  }
}

export async function saveMarkdownFile(filename, content, defaultSaveLocation = null) {
  const ext = getExt();
  const baseName = sanitizeFilename(filename);
  const sanitizedFilename = baseName.toLowerCase().endsWith('.md')
    ? baseName
    : `${baseName}.md`;
  
  if (typeof window !== 'undefined' && window.showDirectoryPicker) {
    const directoryHandle = defaultSaveLocation || await showDirectoryPicker();
    if (directoryHandle) {
      return await saveFileWithChromeAPI(sanitizedFilename, content, directoryHandle);
    }
  }
  
  // For Firefox, always show save dialog when no default location is set
  return await saveFileWithFirefoxAPI(sanitizedFilename, content, defaultSaveLocation);
}

export function isChrome() {
  return typeof globalThis !== 'undefined' && globalThis.chrome && globalThis.chrome.runtime && globalThis.chrome.runtime.id;
}

export function isFirefox() {
  return typeof globalThis !== 'undefined' && globalThis.browser && globalThis.browser.runtime && globalThis.browser.runtime.id;
}
