function getExtensionAPI() {
  if (typeof globalThis !== 'undefined' && globalThis.browser) return globalThis.browser;
  if (typeof globalThis !== 'undefined' && globalThis.chrome) return globalThis.chrome;
  return undefined;
}

function normalizeExtensionError(err) {
  if (!err) return new Error('Unknown extension API error');
  if (err instanceof Error) return err;

  const maybeMessage = typeof err === 'object' && err !== null && 'message' in err
    ? err.message
    : undefined;
  const message = typeof maybeMessage === 'string'
    ? maybeMessage
    : String(err);

  const normalized = new Error(message);
  if (typeof err === 'object' && err !== null) {
    normalized.cause = err;
  }
  return normalized;
}

function promisifyChrome(fn, thisArg) {
  return (...args) => {
    return new Promise((resolve, reject) => {
      const expectsCallback = typeof fn === 'function' && fn.length > args.length;

      if (!expectsCallback) {
        try {
          const direct = fn.call(thisArg, ...args);
          if (direct && typeof direct.then === 'function') {
            direct.then(resolve).catch((error) => {
              reject(normalizeExtensionError(error));
            });
            return;
          }
          resolve(direct);
        } catch (e) {
          reject(normalizeExtensionError(e));
        }
        return;
      }

      try {
        const maybePromise = fn.call(thisArg, ...args, (result) => {
          const err = (typeof globalThis !== 'undefined' && globalThis.chrome && globalThis.chrome.runtime)
            ? globalThis.chrome.runtime.lastError
            : undefined;
          if (err) {
            reject(normalizeExtensionError(err));
            return;
          }
          resolve(result);
        });

        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise.then(resolve).catch((error) => {
            reject(normalizeExtensionError(error));
          });
        }
      } catch (e) {
        reject(normalizeExtensionError(e));
      }
    });
  };
}

export function getExt() {
  const api = getExtensionAPI();
  if (!api) throw new Error('No extension API found (neither `browser` nor `chrome`).');

  const isBrowser = api === globalThis.browser;

  const missing = (name) => () => {
    throw new Error(`Extension API not available: ${name}`);
  };

  const hasStorageSync = !!(api.storage && api.storage.sync);
  const hasTabs = !!api.tabs;
  const hasBookmarks = !!api.bookmarks;
  const hasRuntime = !!api.runtime;

  const storageSyncGet = hasStorageSync
    ? (isBrowser
      ? (keys) => api.storage.sync.get(keys)
      : promisifyChrome(api.storage.sync.get, api.storage.sync))
    : missing('storage.sync.get');

  const storageSyncSet = hasStorageSync
    ? (isBrowser
      ? (items) => api.storage.sync.set(items)
      : promisifyChrome(api.storage.sync.set, api.storage.sync))
    : missing('storage.sync.set');

  const tabsQuery = hasTabs
    ? (isBrowser
      ? (queryInfo) => api.tabs.query(queryInfo)
      : promisifyChrome(api.tabs.query, api.tabs))
    : missing('tabs.query');

  const tabsRemove = hasTabs
    ? (isBrowser
      ? (tabIds) => api.tabs.remove(tabIds)
      : promisifyChrome(api.tabs.remove, api.tabs))
    : missing('tabs.remove');

  const bookmarksGetTree = hasBookmarks
    ? (isBrowser
      ? () => api.bookmarks.getTree()
      : promisifyChrome(api.bookmarks.getTree, api.bookmarks))
    : missing('bookmarks.getTree');

  const bookmarksGetChildren = hasBookmarks
    ? (isBrowser
      ? (id) => api.bookmarks.getChildren(id)
      : promisifyChrome(api.bookmarks.getChildren, api.bookmarks))
    : missing('bookmarks.getChildren');

  const bookmarksCreate = hasBookmarks
    ? (isBrowser
      ? (bookmark) => api.bookmarks.create(bookmark)
      : promisifyChrome(api.bookmarks.create, api.bookmarks))
    : missing('bookmarks.create');

  const runtimeSendMessage = (message) => {
    if (!hasRuntime) return Promise.reject(new Error('Extension API not available: runtime.sendMessage'));
    if (isBrowser) return api.runtime.sendMessage(message);
    api.runtime.sendMessage(message);
    return Promise.resolve();
  };

  const runtimeOpenOptionsPage = () => {
    if (!hasRuntime) return Promise.reject(new Error('Extension API not available: runtime.openOptionsPage'));
    if (isBrowser) return api.runtime.openOptionsPage();
    api.runtime.openOptionsPage();
    return Promise.resolve();
  };

  const runtimeOnMessageAddListener = hasRuntime
    ? (handler) => api.runtime.onMessage.addListener(handler)
    : missing('runtime.onMessage.addListener');

  const hasContextMenus = api && api.contextMenus;
  const contextMenusRemoveAll = hasContextMenus
    ? (isBrowser
      ? () => api.contextMenus.removeAll()
      : promisifyChrome(api.contextMenus.removeAll, api.contextMenus))
    : missing('contextMenus.removeAll');

  const contextMenusCreate = hasContextMenus
    ? (isBrowser
      ? (createProperties) => api.contextMenus.create(createProperties)
      : promisifyChrome(api.contextMenus.create, api.contextMenus))
    : missing('contextMenus.create');

  const hasDownloads = api && api.downloads;
  const downloadsDownload = hasDownloads
    ? (isBrowser
      ? (downloadItem) => api.downloads.download(downloadItem)
      : promisifyChrome(api.downloads.download, api.downloads))
    : missing('downloads.download');

  return {
    storageSyncGet,
    storageSyncSet,
    tabsQuery,
    tabsRemove,
    bookmarksGetTree,
    bookmarksGetChildren,
    bookmarksCreate,
    runtimeSendMessage,
    runtimeOpenOptionsPage,
    runtimeOnMessageAddListener,
    contextMenusRemoveAll,
    contextMenusCreate,
    downloadsDownload
  };
}
