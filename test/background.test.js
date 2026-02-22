import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock chrome before importing module
global.chrome = {
  runtime: {
    onMessage: {
      addListener: jest.fn()
    }
  }
};

// Preserve URL constructor and only mock blob helpers
if (!global.URL) {
  global.URL = URL;
}
global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = jest.fn();

jest.unstable_mockModule('../src/shared/file-handler.js', () => ({
  saveMarkdownFile: jest.fn().mockResolvedValue(true)
}));
jest.unstable_mockModule('../src/shared/openai-client.js', () => ({
  summarizeArticleAsMarkdown: jest.fn().mockResolvedValue('# Summary\n- A'),
  DEFAULT_OPENAI_MODEL: 'gpt-4.1-mini',
  DEFAULT_MAX_INPUT_CHARS: 20000
}));

const {
  getSettings,
  getAiNoteSettings,
  getOtherBookmarksFolder,
  createFolderName,
  bookmarkCurrentWindowTabs,
  closeDuplicatesInCurrentWindow,
  extractBookmarksFromFolder,
  buildFolderPath,
  generateMarkdownTable,
  saveBookmarkFolderAsNote,
  saveCurrentTabAsNote
} = await import('../src/shared/background.js');
const { summarizeArticleAsMarkdown } = await import('../src/shared/openai-client.js');
const { saveMarkdownFile } = await import('../src/shared/file-handler.js');

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
        remove: jest.fn(),
        executeScript: jest.fn()
      },
      scripting: {
        executeScript: jest.fn()
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
      const mockTabs = [
        { id: 1, url: 'https://example.com', incognito: false },
        { id: 2, url: 'https://example.com/', incognito: false },
        { id: 3, url: 'https://other.com', incognito: false }
      ];
      mockChromeAPI.tabs.query.mockResolvedValue(mockTabs);

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

  describe('getAiNoteSettings', () => {
    it('should return defaults when storage is empty', async () => {
      mockChromeAPI.storage.sync.get.mockResolvedValue({});

      const settings = await getAiNoteSettings(mockChromeAPI);

      expect(settings).toEqual({
        openaiApiKey: '',
        openaiModel: 'gpt-4.1-mini',
        summaryPromptOverride: '',
        maxInputChars: 20000
      });
    });

    it('should return stored AI settings', async () => {
      mockChromeAPI.storage.sync.get.mockResolvedValue({
        openaiApiKey: 'sk-test',
        openaiModel: 'gpt-custom',
        summaryPromptOverride: 'custom',
        maxInputChars: 9000
      });

      const settings = await getAiNoteSettings(mockChromeAPI);

      expect(settings).toEqual({
        openaiApiKey: 'sk-test',
        openaiModel: 'gpt-custom',
        summaryPromptOverride: 'custom',
        maxInputChars: 9000
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

  describe('buildFolderPath', () => {
    it('should build folder path from bookmark', () => {
      const bookmark = { parentId: 'grandchild' };
      const folderMap = {
        'root': { title: 'Root', parentId: null },
        'child': { title: 'Child', parentId: 'root' },
        'grandchild': { title: 'Grandchild', parentId: 'child' }
      };

      const result = buildFolderPath(bookmark, folderMap);

      expect(result).toBe('Root > Child > Grandchild');
    });

    it('should handle circular references', () => {
      const bookmark = { parentId: 'child' };
      const folderMap = {
        'child': { title: 'Child', parentId: 'child' } // Circular reference
      };

      const result = buildFolderPath(bookmark, folderMap);

      expect(result).toBe('Child'); // Should not infinite loop
    });

    it('should handle missing parent', () => {
      const bookmark = { parentId: 'missing' };
      const folderMap = {
        'child': { title: 'Child', parentId: null }
      };

      const result = buildFolderPath(bookmark, folderMap);

      expect(result).toBe('');
    });
  });

  describe('generateMarkdownTable', () => {
    it('should generate markdown table with bookmarks', () => {
      const bookmarks = [
        {
          title: 'Test Bookmark',
          url: 'https://example.com',
          dateAdded: 1642694400000, // 2022-01-20
          folderPath: 'Documents > Test'
        }
      ];

      const result = generateMarkdownTable(bookmarks);

      expect(result).toContain('# Bookmarks');
      expect(result).toContain('| Title | Date Added | Folder Path |');
      expect(result).toContain('| [Test Bookmark](https://example\\.com) |');
      expect(result).toContain('Documents \\> Test');
    });

    it('should handle empty bookmarks array', () => {
      const result = generateMarkdownTable([]);
      expect(result).toBe('# Bookmarks\n\nNo bookmarks found.');
    });

    it('should handle null/undefined input', () => {
      expect(generateMarkdownTable(null)).toBe('# Bookmarks\n\nNo bookmarks found.');
      expect(generateMarkdownTable(undefined)).toBe('# Bookmarks\n\nNo bookmarks found.');
    });

    it('should escape pipe characters in markdown', () => {
      const bookmarks = [
        {
          title: 'Test | Bookmark',
          url: 'https://example.com|path',
          folderPath: 'Documents | Test'
        }
      ];

      const result = generateMarkdownTable(bookmarks);

      expect(result).toContain('\\|'); // Should escape pipe characters
    });
  });

  describe('saveBookmarkFolderAsNote', () => {
    it('should save bookmark folder as note', async () => {
      const mockFolder = {
        id: 'folder1',
        title: 'Test Folder',
        children: [
          { id: 'b1', title: 'Bookmark 1', url: 'https://example1.com' }
        ]
      };
      const mockTree = [mockFolder];
      const mockSettings = { template: 'test', behavior: 'increment' };

      mockChromeAPI.storage.sync.get.mockResolvedValue(mockSettings);
      mockChromeAPI.bookmarks.getTree.mockResolvedValue(mockTree);

      await saveBookmarkFolderAsNote('folder1', mockChromeAPI);

      expect(mockChromeAPI.bookmarks.getTree).toHaveBeenCalled();
    });

    it('should handle folder not found', async () => {
      mockChromeAPI.bookmarks.getTree.mockResolvedValue([]);

      await saveBookmarkFolderAsNote('nonexistent', mockChromeAPI);

      // Should not throw error, just log and return
      expect(mockChromeAPI.bookmarks.getTree).toHaveBeenCalled();
    });

    it('should handle empty folder', async () => {
      const mockFolder = {
        id: 'folder1',
        title: 'Empty Folder',
        children: []
      };
      const mockTree = [mockFolder];
      const mockSettings = { template: 'test', behavior: 'increment' };

      mockChromeAPI.storage.sync.get.mockResolvedValue(mockSettings);
      mockChromeAPI.bookmarks.getTree.mockResolvedValue(mockTree);

      await saveBookmarkFolderAsNote('folder1', mockChromeAPI);

      expect(mockChromeAPI.bookmarks.getTree).toHaveBeenCalled();
    });
  });

  describe('saveCurrentTabAsNote', () => {
    it('should summarize active tab and save markdown', async () => {
      mockChromeAPI.storage.sync.get.mockResolvedValue({
        openaiApiKey: 'sk-test',
        openaiModel: 'gpt-4.1-mini',
        summaryPromptOverride: '',
        maxInputChars: 20000
      });
      mockChromeAPI.tabs.query.mockResolvedValue([{ id: 12, url: 'https://example.com' }]);
      mockChromeAPI.scripting.executeScript.mockResolvedValue([{
        result: {
          title: 'Example title',
          url: 'https://example.com',
          content: 'A long article body'
        }
      }]);

      await saveCurrentTabAsNote(mockChromeAPI);

      expect(summarizeArticleAsMarkdown).toHaveBeenCalledWith(expect.objectContaining({
        apiKey: 'sk-test',
        model: 'gpt-4.1-mini',
        article: expect.objectContaining({
          title: 'Example title',
          url: 'https://example.com',
          content: 'A long article body'
        })
      }));
      expect(saveMarkdownFile).toHaveBeenCalledWith(
        expect.stringContaining('Example title_'),
        expect.stringContaining('Source: https://example.com')
      );
    });

    it('should fail when api key is missing', async () => {
      mockChromeAPI.storage.sync.get.mockResolvedValue({});

      await expect(saveCurrentTabAsNote(mockChromeAPI))
        .rejects
        .toThrow('OpenAI API key is missing. Set it in Preferences.');
    });
  });
});
