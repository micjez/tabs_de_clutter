import { describe, it, expect, jest } from '@jest/globals';
import { summarizeArticleAsMarkdown } from '../src/shared/openai-client.js';

describe('openai-client.js', () => {
  const article = {
    title: 'Example',
    url: 'https://example.com',
    capturedAt: '2026-02-22T00:00:00.000Z',
    content: 'Article body'
  };

  it('throws when api key is missing', async () => {
    await expect(summarizeArticleAsMarkdown({ apiKey: '', article, fetchImpl: jest.fn() }))
      .rejects
      .toThrow('OpenAI API key is missing. Set it in Preferences.');
  });

  it('calls chat completions and returns markdown', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        choices: [
          { message: { content: '# Summary\n- Point' } }
        ]
      })
    });

    const result = await summarizeArticleAsMarkdown({
      apiKey: 'sk-test',
      article,
      fetchImpl
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({ method: 'POST' })
    );
    expect(result).toBe('# Summary\n- Point');
  });

  it('throws error message from API response', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: jest.fn().mockResolvedValue({
        error: {
          message: 'Invalid API key'
        }
      })
    });

    await expect(summarizeArticleAsMarkdown({
      apiKey: 'bad-key',
      article,
      fetchImpl
    })).rejects.toThrow('Invalid API key');
  });
});
