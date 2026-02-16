import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock chrome before importing the module
global.chrome = {
  runtime: {
    onMessage: {
      addListener: jest.fn()
    }
  }
};

import {
  getSettings,
  getOtherBookmarksFolder,
  createFolderName,
  bookmarkCurrentWindowTabs,
  closeDuplicatesInCurrentWindow
} from '../src/shared/background.js';

describe('background.js', () => {
  let mockChromeAPI;

  beforeEach(() => {
    mockChromeAPI = {
      storage: {
        sync: {
          get: jest.fn(),
          set: jest.fn()
        }
      },
      bookmarks: {
        getTree: jest.fn(),
        getChildren: jest.fn(),
        create: jest.fn()
      },
      tabs: {
        query: jest.fn(),
        remove: jest.fn()
      },
      runtime: {
        onMessage: {
          addListener: jest.fn()
        }
      }
    };
  });

  describe('closeDuplicatesInCurrentWindow', () => {
    it('should remove duplicate tabs in current window', async () => {
      mockChromeAPI.tabs.query.mockResolvedValue([
        { id: 1, url: 'https://example.com', incognito: false },
        { id: 2, url: 'https://example.com/', incognito: false },
        { id: 3, url: 'https://other.com', incognito: false }
      ]);

      await closeDuplicatesInCurrentWindow(mockChromeAPI);

      expect(mockChromeAPI.tabs.remove).toHaveBeenCalledWith([2]);
    });

    it('should ignore chrome:// and incognito tabs', async () => {
      mockChromeAPI.tabs.query.mockResolvedValue([
        { id: 1, url: 'chrome://settings', incognito: false },
        { id: 2, url: 'https://example.com', incognito: true },
        { id: 3, url: 'https://example.com', incognito: false },
        { id: 4, url: 'https://example.com', incognito: false }
      ]);

      await closeDuplicatesInCurrentWindow(mockChromeAPI);

      expect(mockChromeAPI.tabs.remove).toHaveBeenCalledWith([4]);
    });

    it('should not call remove if no duplicates found', async () => {
      mockChromeAPI.tabs.query.mockResolvedValue([
        { id: 1, url: 'https://a.com', incognito: false },
        { id: 2, url: 'https://b.com', incognito: false }
      ]);

      await closeDuplicatesInCurrentWindow(mockChromeAPI);

      expect(mockChromeAPI.tabs.remove).not.toHaveBeenCalled();
    });
  });

  describe('getSettings', () => {
    it('should return default settings when storage is empty', async () => {
      mockChromeAPI.storage.sync.get.mockResolvedValue({});
      const settings = await getSettings(mockChromeAPI);
      
      expect(settings).toEqual({
        template: "follow_up_{YYYY}_{MM}_{DD}_{HH}_{mm}",
        behavior: "increment"
      });
    });

    it('should return stored settings', async () => {
      const storedSettings = {
        template: "custom_{YYYY}",
        behavior: "append"
      };
      mockChromeAPI.storage.sync.get.mockResolvedValue(storedSettings);
      const settings = await getSettings(mockChromeAPI);
      
      expect(settings).toEqual(storedSettings);
    });

    it('should return partial settings with defaults', async () => {
      mockChromeAPI.storage.sync.get.mockResolvedValue({
        template: "custom_{YYYY}"
      });
      const settings = await getSettings(mockChromeAPI);
      
      expect(settings).toEqual({
        template: "custom_{YYYY}",
        behavior: "increment"
      });
    });
  });

  describe('getOtherBookmarksFolder', () => {
    it('should find other bookmarks folder', async () => {
      const mockTree = [{
        children: [
          { title: 'Other Bookmarks' },
          { title: 'Bookmarks Bar' }
        ]
      }];
      mockChromeAPI.bookmarks.getTree.mockResolvedValue(mockTree);
      
      const folder = await getOtherBookmarksFolder(mockChromeAPI);
      
      expect(folder.title).toBe('Other Bookmarks');
    });

    it('should return undefined when no other folder', async () => {
      mockChromeAPI.bookmarks.getTree.mockResolvedValue([]);
      
      const folder = await getOtherBookmarksFolder(mockChromeAPI);
      
      expect(folder).toBeUndefined();
    });

    it('should find folder with "other" in name (case insensitive)', async () => {
      const mockTree = [{
        children: [
          { title: 'Bookmarks Bar' },
          { title: 'OTHER STUFF' }
        ]
      }];
      mockChromeAPI.bookmarks.getTree.mockResolvedValue(mockTree);
      
      const result = await getOtherBookmarksFolder(mockChromeAPI);
      expect(result.title).toBe('OTHER STUFF');
    });

    it('should return undefined when no other folder found', async () => {
      const mockTree = [{
        children: [
          { title: 'Bookmarks Bar' },
          { title: 'Mobile Bookmarks' }
        ]
      }];
      mockChromeAPI.bookmarks.getTree.mockResolvedValue(mockTree);
      
      const result = await getOtherBookmarksFolder(mockChromeAPI);
      expect(result).toBeUndefined();
    });

    it('should handle empty tree', async () => {
      mockChromeAPI.bookmarks.getTree.mockResolvedValue([]);
      
      const result = await getOtherBookmarksFolder(mockChromeAPI);
      expect(result).toBeUndefined();
    });

    it('should handle undefined root', async () => {
      mockChromeAPI.bookmarks.getTree.mockResolvedValue([undefined]);
      
      const result = await getOtherBookmarksFolder(mockChromeAPI);
      expect(result).toBeUndefined();
    });
  });

  describe('createFolderName', () => {
    it('should return base name when not exists', async () => {
      mockChromeAPI.bookmarks.getChildren.mockResolvedValue([]);
      
      const name = await createFolderName('parent', 'test', 'increment', mockChromeAPI);
      
      expect(name).toBe('test');
    });

    it('should increment name when exists', async () => {
      const existingChildren = [
        { title: 'test' },
        { title: 'test_1' },
        { title: 'test_2' }
      ];
      mockChromeAPI.bookmarks.getChildren.mockResolvedValue(existingChildren);
      
      const name = await createFolderName('parent', 'test', 'increment', mockChromeAPI);
      
      expect(name).toBe('test_3');
    });

    it('should return base name for append behavior', async () => {
      const existingChildren = [
        { title: 'test' },
        { title: 'test_1' }
      ];
      mockChromeAPI.bookmarks.getChildren.mockResolvedValue(existingChildren);
      
      const name = await createFolderName('parent', 'test', 'append', mockChromeAPI);
      
      expect(name).toBe('test');
    });
  });

  describe('bookmarkCurrentWindowTabs', () => {
    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date('2024-03-15T14:30:00'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return early when template renders empty', async () => {
      mockChromeAPI.storage.sync.get.mockResolvedValue({
        template: '', // Empty string should trigger early return
        behavior: 'increment'
      });
      
      // Clear all mock calls before running the test
      jest.clearAllMocks();
      
      await bookmarkCurrentWindowTabs(mockChromeAPI);
      
      // Check that getTree was not called (meaning getOtherBookmarksFolder was not called)
      expect(mockChromeAPI.bookmarks.getTree).not.toHaveBeenCalled();
      expect(mockChromeAPI.tabs.query).not.toHaveBeenCalled();
    });

    it('should return early when other folder not found', async () => {
      mockChromeAPI.storage.sync.get.mockResolvedValue({
        template: 'test_{YYYY}',
        behavior: 'increment'
      });
      mockChromeAPI.bookmarks.getTree.mockResolvedValue([{
        children: [{ title: 'Bookmarks Bar' }]
      }]);
      
      await bookmarkCurrentWindowTabs(mockChromeAPI);
      
      expect(mockChromeAPI.bookmarks.create).not.toHaveBeenCalled();
    });

    it('should create folder and bookmark tabs', async () => {
      const mockSettings = {
        template: 'test_{YYYY}',
        behavior: 'increment'
      };
      const mockOtherFolder = { id: 'other-id', title: 'Other Bookmarks' };
      const mockTabs = [
        { title: 'Test Tab', url: 'https://example.com', incognito: false },
        { title: 'Chrome Tab', url: 'chrome://settings', incognito: false }
      ];
      
      mockChromeAPI.storage.sync.get.mockResolvedValue(mockSettings);
      mockChromeAPI.bookmarks.getTree.mockResolvedValue([{
        children: [mockOtherFolder]
      }]);
      mockChromeAPI.bookmarks.getChildren.mockResolvedValue([]);
      mockChromeAPI.tabs.query.mockResolvedValue(mockTabs);
      mockChromeAPI.bookmarks.create.mockResolvedValue({ id: 'folder-id' });
      
      await bookmarkCurrentWindowTabs(mockChromeAPI);
      
      expect(mockChromeAPI.bookmarks.create).toHaveBeenCalledWith({
        parentId: 'other-id',
        title: 'test_2024'
      });
      expect(mockChromeAPI.bookmarks.create).toHaveBeenCalledWith({
        parentId: 'folder-id',
        title: 'Test Tab',
        url: 'https://example.com'
      });
    });

    it('should skip incognito tabs', async () => {
      const mockSettings = {
        template: 'test_{YYYY}',
        behavior: 'increment'
      };
      const mockOtherFolder = { id: 'other-id', title: 'Other Bookmarks' };
      const mockTabs = [
        { title: 'Normal Tab', url: 'https://example.com', incognito: false },
        { title: 'Incognito Tab', url: 'https://example.com/private', incognito: true }
      ];
      
      mockChromeAPI.storage.sync.get.mockResolvedValue(mockSettings);
      mockChromeAPI.bookmarks.getTree.mockResolvedValue([{
        children: [mockOtherFolder]
      }]);
      mockChromeAPI.bookmarks.getChildren.mockResolvedValue([]);
      mockChromeAPI.tabs.query.mockResolvedValue(mockTabs);
      mockChromeAPI.bookmarks.create.mockResolvedValue({ id: 'folder-id' });
      
      await bookmarkCurrentWindowTabs(mockChromeAPI);
      
      expect(mockChromeAPI.bookmarks.create).toHaveBeenCalledTimes(2); // folder + 1 tab
    });
  });
});
