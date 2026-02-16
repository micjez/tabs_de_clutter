function getExtensionAPI() {
  if (typeof globalThis !== 'undefined' && globalThis.browser) return globalThis.browser;
  if (typeof globalThis !== 'undefined' && globalThis.chrome) return globalThis.chrome;
  return undefined;
}

function promisifyChrome(fn, thisArg) {
  return (...args) => {
    try {
      const direct = fn.call(thisArg, ...args);
      if (direct && typeof direct.then === 'function') {
        return direct;
      }

      if (direct === undefined && typeof fn === 'function' && fn.length <= args.length) {
        return Promise.resolve(direct);
      }
    } catch {
    }

    return new Promise((resolve, reject) => {
      try {
        fn.call(thisArg, ...args, (result) => {
          const err = (typeof globalThis !== 'undefined' && globalThis.chrome && globalThis.chrome.runtime)
            ? globalThis.chrome.runtime.lastError
            : undefined;
          if (err) {
            reject(err);
            return;
          }
          resolve(result);
        });
      } catch (e) {
        reject(e);
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
    runtimeOnMessageAddListener
  };
}
