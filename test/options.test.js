import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { loadOptions, saveOptions } from '../src/shared/options.js';

describe('options.js', () => {
  let mockChrome;

  beforeEach(() => {
    document.body.innerHTML = `
      <input id="template" />
      <select id="behavior">
        <option value="increment">increment</option>
        <option value="append">append</option>
      </select>
    `;

    mockChrome = {
      storage: {
        sync: {
          get: jest.fn(),
          set: jest.fn()
        }
      }
    };

    global.chrome = mockChrome;
    global.alert = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete global.chrome;
    delete global.alert;
  });

  describe('loadOptions', () => {
    it('loads values from storage into the form', async () => {
      mockChrome.storage.sync.get.mockResolvedValue({
        template: 'custom_{YYYY}',
        behavior: 'append'
      });

      await loadOptions();

      expect(mockChrome.storage.sync.get).toHaveBeenCalledWith(['template', 'behavior']);
      expect(document.getElementById('template').value).toBe('custom_{YYYY}');
      expect(document.getElementById('behavior').value).toBe('append');
    });

    it('uses defaults when storage is empty', async () => {
      mockChrome.storage.sync.get.mockResolvedValue({});

      await loadOptions();

      expect(document.getElementById('template').value).toBe('follow_up_{YYYY}_{MM}_{DD}_{HH}_{mm}');
      expect(document.getElementById('behavior').value).toBe('increment');
    });

    it('uses defaults when storage is partial', async () => {
      mockChrome.storage.sync.get.mockResolvedValue({ template: 'only_template' });

      await loadOptions();

      expect(document.getElementById('template').value).toBe('only_template');
      expect(document.getElementById('behavior').value).toBe('increment');
    });
  });

  describe('saveOptions', () => {
    it('saves valid options', async () => {
      document.getElementById('template').value = 'custom_{YYYY}';
      document.getElementById('behavior').value = 'append';

      await saveOptions();

      expect(mockChrome.storage.sync.set).toHaveBeenCalledWith({
        template: 'custom_{YYYY}',
        behavior: 'append'
      });
      expect(global.alert).toHaveBeenCalledWith('Saved.');
    });

    it('trims template whitespace', async () => {
      document.getElementById('template').value = '  custom_{YYYY}  ';
      document.getElementById('behavior').value = 'append';

      await saveOptions();

      expect(mockChrome.storage.sync.set).toHaveBeenCalledWith({
        template: 'custom_{YYYY}',
        behavior: 'append'
      });
    });

    it('alerts when template is empty', async () => {
      document.getElementById('template').value = '   ';
      document.getElementById('behavior').value = 'append';

      await saveOptions();

      expect(global.alert).toHaveBeenCalledWith('Template cannot be empty.');
      expect(mockChrome.storage.sync.set).not.toHaveBeenCalled();
    });
  });
});
