import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock chrome before importing module
global.chrome = {
  runtime: {
    getURL: jest.fn()
  }
};

// Preserve URL constructor and only mock blob helpers
if (!global.URL) {
  global.URL = URL;
}
global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = jest.fn();

jest.unstable_mockModule('../src/shared/ext.js', () => ({
  getExt: jest.fn()
}));

const { getExt } = await import('../src/shared/ext.js');
const {
  sanitizeFilename,
  showDirectoryPicker,
  saveFileWithChromeAPI,
  saveFileWithFirefoxAPI,
  saveMarkdownFile
} = await import('../src/shared/file-handler.js');

describe('file-handler.js', () => {
  let mockChromeAPI;

  beforeEach(() => {
    mockChromeAPI = {
      storage: {
        sync: {
          get: jest.fn(),
          set: jest.fn()
        }
      },
      downloads: {
        download: jest.fn()
      },
      runtime: {
        getURL: jest.fn()
      }
    };
    
    // Mock window.showDirectoryPicker for Chrome
    Object.defineProperty(global, 'window', {
      value: {
        showDirectoryPicker: jest.fn()
      },
      writable: true
    });
  });

  describe('sanitizeFilename', () => {
    it('should replace invalid characters with underscores', () => {
      const result = sanitizeFilename('file<>:"/\\|?*name');
      expect(result).toBe('file_________name');
    });

    it('should collapse multiple spaces', () => {
      const result = sanitizeFilename('file   name');
      expect(result).toBe('file name');
    });

    it('should trim whitespace', () => {
      const result = sanitizeFilename('  file name  ');
      expect(result).toBe('file name');
    });

    it('should limit to 200 characters', () => {
      const longName = 'a'.repeat(250);
      const result = sanitizeFilename(longName);
      expect(result).toBe('a'.repeat(200));
    });

    it('should handle empty input', () => {
      const result = sanitizeFilename('');
      expect(result).toBe('');
    });

    it('should handle null/undefined input', () => {
      expect(sanitizeFilename(null)).toBe('');
      expect(sanitizeFilename(undefined)).toBe('');
    });
  });

  describe('showDirectoryPicker', () => {
    it('should call window.showDirectoryPicker when available', async () => {
      const mockHandle = { name: 'test-folder' };
      global.window.showDirectoryPicker.mockResolvedValue(mockHandle);
      
      const result = await showDirectoryPicker();
      
      expect(global.window.showDirectoryPicker).toHaveBeenCalled();
      expect(result).toBe(mockHandle);
    });

    it('should return null when picker is cancelled', async () => {
      global.window.showDirectoryPicker.mockRejectedValue(new Error('User cancelled'));
      
      const result = await showDirectoryPicker();
      
      expect(result).toBeNull();
    });

    it('should return null when showDirectoryPicker not available', async () => {
      delete global.window.showDirectoryPicker;
      
      const result = await showDirectoryPicker();
      
      expect(result).toBeNull();
    });
  });

  describe('saveFileWithChromeAPI', () => {
    it('should save file using Chrome File System Access API', async () => {
      const mockHandle = {
        getFileHandle: jest.fn().mockResolvedValue({
          createWritable: jest.fn().mockResolvedValue({
            write: jest.fn().mockResolvedValue(),
            close: jest.fn().mockResolvedValue()
          })
        })
      };
      
      await saveFileWithChromeAPI('test.md', 'content', mockHandle);
      
      expect(mockHandle.getFileHandle).toHaveBeenCalledWith('test.md', { create: true });
    });

    it('should handle file system errors', async () => {
      const mockHandle = {
        getFileHandle: jest.fn().mockRejectedValue(new Error('File not found'))
      };
      
      await expect(saveFileWithChromeAPI('test.md', 'content', mockHandle))
        .rejects.toThrow('File not found');
    });
  });

  describe('saveFileWithFirefoxAPI', () => {
    it('should call downloads API with correct parameters', async () => {
      const mockExt = {
        downloadsDownload: jest.fn().mockResolvedValue(123)
      };

      getExt.mockReturnValue(mockExt);
      
      await saveFileWithFirefoxAPI('test.md', 'content');
      
      expect(getExt).toHaveBeenCalled();
      expect(mockExt.downloadsDownload).toHaveBeenCalledWith({
        url: expect.stringContaining('blob:'),
        filename: 'test.md',
        saveAs: true
      });
    });

    it('should handle download errors', async () => {
      const mockExt = {
        downloadsDownload: jest.fn().mockRejectedValue(new Error('Download failed'))
      };
      
      getExt.mockReturnValue(mockExt);
      
      await expect(saveFileWithFirefoxAPI('test.md', 'content'))
        .rejects.toThrow('Download failed');
    });
  });

  describe('saveMarkdownFile', () => {
    it('should sanitize filename and add .md extension', async () => {
      const mockHandle = {
        getFileHandle: jest.fn().mockResolvedValue({
          createWritable: jest.fn().mockResolvedValue({
            write: jest.fn().mockResolvedValue(),
            close: jest.fn().mockResolvedValue()
          })
        })
      };
      
      global.window.showDirectoryPicker = jest.fn().mockResolvedValue(mockHandle);
      
      await saveMarkdownFile('test<>file', 'content');
      
      expect(mockHandle.getFileHandle).toHaveBeenCalledWith('test__file.md', { create: true });
    });

    it('should use Chrome API when directory picker available', async () => {
      const mockHandle = {
        getFileHandle: jest.fn().mockResolvedValue({
          createWritable: jest.fn().mockResolvedValue({
            write: jest.fn().mockResolvedValue(),
            close: jest.fn().mockResolvedValue()
          })
        })
      };
      
      global.window.showDirectoryPicker = jest.fn().mockResolvedValue(mockHandle);
      
      await saveMarkdownFile('test.md', 'content');
      
      expect(global.window.showDirectoryPicker).toHaveBeenCalled();
    });

    it('should use Firefox API when directory picker not available', async () => {
      delete global.window.showDirectoryPicker;
      
      const mockExt = {
        downloadsDownload: jest.fn().mockResolvedValue(123)
      };
      
      getExt.mockReturnValue(mockExt);
      
      await saveMarkdownFile('test.md', 'content');
      
      expect(mockExt.downloadsDownload).toHaveBeenCalledWith({
        url: expect.stringContaining('blob:'),
        filename: 'test.md',
        saveAs: true
      });
    });
  });
});
