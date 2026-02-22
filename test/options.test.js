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
      <input id="openaiApiKey" />
      <input id="openaiModel" />
      <textarea id="summaryPromptOverride"></textarea>
      <input id="maxInputChars" />
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
        behavior: 'append',
        openaiApiKey: 'sk-test',
        openaiModel: 'gpt-test',
        summaryPromptOverride: 'custom prompt',
        maxInputChars: 12345
      });

      await loadOptions();

      expect(mockChrome.storage.sync.get).toHaveBeenCalledWith([
        'template',
        'behavior',
        'openaiApiKey',
        'openaiModel',
        'summaryPromptOverride',
        'maxInputChars'
      ]);
      expect(document.getElementById('template').value).toBe('custom_{YYYY}');
      expect(document.getElementById('behavior').value).toBe('append');
      expect(document.getElementById('openaiApiKey').value).toBe('sk-test');
      expect(document.getElementById('openaiModel').value).toBe('gpt-test');
      expect(document.getElementById('summaryPromptOverride').value).toBe('custom prompt');
      expect(document.getElementById('maxInputChars').value).toBe('12345');
    });

    it('uses defaults when storage is empty', async () => {
      mockChrome.storage.sync.get.mockResolvedValue({});

      await loadOptions();

      expect(document.getElementById('template').value).toBe('follow_up_{YYYY}_{MM}_{DD}_{HH}_{mm}');
      expect(document.getElementById('behavior').value).toBe('increment');
      expect(document.getElementById('openaiApiKey').value).toBe('');
      expect(document.getElementById('openaiModel').value).toBe('gpt-4.1-mini');
      expect(document.getElementById('summaryPromptOverride').value).toBe('');
      expect(document.getElementById('maxInputChars').value).toBe('20000');
    });
  });

  describe('saveOptions', () => {
    it('saves valid options', async () => {
      document.getElementById('template').value = 'custom_{YYYY}';
      document.getElementById('behavior').value = 'append';
      document.getElementById('openaiApiKey').value = ' sk-abc ';
      document.getElementById('openaiModel').value = ' gpt-4.1-mini ';
      document.getElementById('summaryPromptOverride').value = '  prompt  ';
      document.getElementById('maxInputChars').value = '15000';

      await saveOptions();

      expect(mockChrome.storage.sync.set).toHaveBeenCalledWith({
        template: 'custom_{YYYY}',
        behavior: 'append',
        openaiApiKey: 'sk-abc',
        openaiModel: 'gpt-4.1-mini',
        summaryPromptOverride: 'prompt',
        maxInputChars: 15000
      });
      expect(global.alert).toHaveBeenCalledWith('Saved.');
    });

    it('alerts when template is empty', async () => {
      document.getElementById('template').value = '   ';
      document.getElementById('behavior').value = 'append';

      await saveOptions();

      expect(global.alert).toHaveBeenCalledWith('Template cannot be empty.');
      expect(mockChrome.storage.sync.set).not.toHaveBeenCalled();
    });

    it('falls back to default maxInputChars for invalid values', async () => {
      document.getElementById('template').value = 'custom_{YYYY}';
      document.getElementById('behavior').value = 'append';
      document.getElementById('maxInputChars').value = '-1';

      await saveOptions();

      expect(mockChrome.storage.sync.set).toHaveBeenCalledWith(expect.objectContaining({
        maxInputChars: 20000
      }));
    });
  });
});
