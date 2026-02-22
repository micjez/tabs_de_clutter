import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { 
  DEFAULT_TEMPLATE, 
  DEFAULT_BEHAVIOR, 
  normalizeUrl, 
  renderTemplate, 
  incrementName,
  sanitizeFilename,
  isValidBookmark,
  sortBookmarksByDate
} from '../src/shared/utils.js';

describe('utils.js', () => {
  describe('Constants', () => {
    it('should have correct default template', () => {
      expect(DEFAULT_TEMPLATE).toBe("follow_up_{YYYY}_{MM}_{DD}_{HH}_{mm}");
    });

    it('should have correct default behavior', () => {
      expect(DEFAULT_BEHAVIOR).toBe("increment");
    });
  });

  describe('normalizeUrl', () => {
    it('should normalize valid URLs', () => {
      expect(normalizeUrl('https://example.com/path')).toBe('example.com/path');
      expect(normalizeUrl('https://EXAMPLE.COM/PATH')).toBe('example.com/path');
      expect(normalizeUrl('https://example.com/path/')).toBe('example.com/path');
    });

    it('should handle URLs with query parameters', () => {
      expect(normalizeUrl('https://example.com/path?param=value')).toBe('example.com/path');
    });

    it('should handle invalid URLs gracefully', () => {
      expect(normalizeUrl('not-a-url')).toBe('not-a-url');
      expect(normalizeUrl('')).toBe('');
    });

    it('should handle URLs with different protocols', () => {
      expect(normalizeUrl('http://example.com/path')).toBe('example.com/path');
      expect(normalizeUrl('ftp://example.com/path')).toBe('example.com/path');
    });
  });

  describe('renderTemplate', () => {
    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date('2024-03-15T14:30:00'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should render template with all placeholders', () => {
      const template = "test_{YYYY}_{MM}_{DD}_{HH}_{mm}";
      expect(renderTemplate(template)).toBe("test_2024_03_15_14_30");
    });

    it('should render template with partial placeholders', () => {
      const template = "backup_{YYYY}_{MM}";
      expect(renderTemplate(template)).toBe("backup_2024_03");
    });

    it('should handle empty template', () => {
      expect(renderTemplate('')).toBe('');
    });

    it('should handle template without placeholders', () => {
      expect(renderTemplate('static_name')).toBe('static_name');
    });

    it('should handle single digit minutes/hours with padding', () => {
      jest.setSystemTime(new Date('2024-03-15T09:05:00'));
      const template = "test_{YYYY}_{MM}_{DD}_{HH}_{mm}";
      expect(renderTemplate(template)).toBe("test_2024_03_15_09_05");
    });
  });

  describe('incrementName', () => {
    it('should return base name when not in existing names', () => {
      expect(incrementName('test', ['other', 'names'])).toBe('test');
    });

    it('should increment when base name exists', () => {
      expect(incrementName('test', ['test', 'other'])).toBe('test_1');
    });

    it('should find next available number', () => {
      const existing = ['test', 'test_1', 'test_2', 'test_3'];
      expect(incrementName('test', existing)).toBe('test_4');
    });

    it('should handle gaps in numbering', () => {
      const existing = ['test', 'test_1', 'test_3'];
      expect(incrementName('test', existing)).toBe('test_2');
    });

    it('should handle empty existing names', () => {
      expect(incrementName('test', [])).toBe('test');
    });

    it('should handle base name with underscores', () => {
      const existing = ['test_name', 'test_name_1'];
      expect(incrementName('test_name', existing)).toBe('test_name_2');
    });
  });

  describe('sanitizeFilename', () => {
    it('should replace invalid characters with underscores', () => {
      expect(sanitizeFilename('file<>:"/\\|?*name')).toBe('file_________name');
    });

    it('should collapse multiple spaces into single space', () => {
      expect(sanitizeFilename('file   with    spaces')).toBe('file with spaces');
    });

    it('should trim leading and trailing whitespace', () => {
      expect(sanitizeFilename('  filename  ')).toBe('filename');
    });

    it('should limit filename length to 200 characters', () => {
      const longName = 'a'.repeat(250);
      expect(sanitizeFilename(longName)).toBe('a'.repeat(200));
    });

    it('should handle empty string', () => {
      expect(sanitizeFilename('')).toBe('');
    });

    it('should handle normal filenames', () => {
      expect(sanitizeFilename('normal-file_name.txt')).toBe('normal-file_name.txt');
    });
  });

  describe('isValidBookmark', () => {
    it('should validate valid bookmark', () => {
      const bookmark = {
        id: '123',
        title: 'Test Site',
        url: 'https://example.com'
      };
      expect(isValidBookmark(bookmark)).toBe(true);
    });

    it('should reject bookmark without id', () => {
      const bookmark = {
        title: 'Test Site',
        url: 'https://example.com'
      };
      expect(isValidBookmark(bookmark)).toBe(false);
    });

    it('should reject bookmark without title', () => {
      const bookmark = {
        id: '123',
        url: 'https://example.com'
      };
      expect(isValidBookmark(bookmark)).toBe(false);
    });

    it('should reject bookmark without url', () => {
      const bookmark = {
        id: '123',
        title: 'Test Site'
      };
      expect(isValidBookmark(bookmark)).toBe(false);
    });

    it('should reject bookmark with empty url', () => {
      const bookmark = {
        id: '123',
        title: 'Test Site',
        url: ''
      };
      expect(isValidBookmark(bookmark)).toBe(false);
    });

    it('should reject null/undefined bookmark', () => {
      expect(isValidBookmark(null)).toBe(false);
      expect(isValidBookmark(undefined)).toBe(false);
    });

    it('should handle non-string properties', () => {
      const bookmark = {
        id: 123,
        title: null,
        url: undefined
      };
      expect(isValidBookmark(bookmark)).toBe(false);
    });
  });

  describe('sortBookmarksByDate', () => {
    it('should sort bookmarks by dateAdded in descending order', () => {
      const bookmarks = [
        { dateAdded: 1000, title: 'Oldest' },
        { dateAdded: 3000, title: 'Newest' },
        { dateAdded: 2000, title: 'Middle' }
      ];

      const sorted = sortBookmarksByDate(bookmarks);

      expect(sorted).toEqual([
        { dateAdded: 3000, title: 'Newest' },
        { dateAdded: 2000, title: 'Middle' },
        { dateAdded: 1000, title: 'Oldest' }
      ]);
    });

    it('should handle missing dateAdded (treated as 0)', () => {
      const bookmarks = [
        { dateAdded: 1000, title: 'Has Date' },
        { title: 'No Date' },
        { dateAdded: undefined, title: 'Undefined Date' }
      ];

      const sorted = sortBookmarksByDate(bookmarks);

      expect(sorted[0]).toEqual({ dateAdded: 1000, title: 'Has Date' });
      expect(sorted[1]).toEqual({ title: 'No Date' });
      expect(sorted[2]).toEqual({ dateAdded: undefined, title: 'Undefined Date' });
    });

    it('should handle empty array', () => {
      const sorted = sortBookmarksByDate([]);
      expect(sorted).toEqual([]);
    });

    it('should not modify original array', () => {
      const bookmarks = [
        { dateAdded: 1000, title: 'First' },
        { dateAdded: 2000, title: 'Second' }
      ];
      const original = [...bookmarks];

      sortBookmarksByDate(bookmarks);

      expect(bookmarks).toEqual(original);
    });

    it('should handle same dates (maintains relative order)', () => {
      const bookmarks = [
        { dateAdded: 1000, title: 'First' },
        { dateAdded: 1000, title: 'Second' },
        { dateAdded: 1000, title: 'Third' }
      ];

      const sorted = sortBookmarksByDate(bookmarks);

      expect(sorted).toEqual(bookmarks);
    });
  });
});
