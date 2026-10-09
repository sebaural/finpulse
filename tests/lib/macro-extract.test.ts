import { describe, expect, it } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { extractJsonText } from '@/lib/macro-service';

type Block = Anthropic.Messages.ContentBlock;

const text = (t: string) => ({ type: 'text', text: t, citations: null }) as unknown as Block;
const search = [
  { type: 'server_tool_use', id: 'srv_1', name: 'web_search', input: { query: 'fed' } },
  { type: 'web_search_tool_result', tool_use_id: 'srv_1', content: [] },
] as unknown as Block[];

const article = {
  title: 'Macro',
  slug: 'macro-landscape-2026-10-09',
  publishedDate: '2026-10-09',
  body: '<p>Rates {steady}.</p>',
};
const json = JSON.stringify(article);

describe('extractJsonText', () => {
  it('joins a JSON answer split across several citation text blocks', () => {
    const content = [...search, text(json.slice(0, 20)), text(json.slice(20, 50)), text(json.slice(50))];
    expect(JSON.parse(extractJsonText(content))).toEqual(article);
  });

  it('skips a prose lead-in before the JSON', () => {
    const content = [...search, text('Based on my research, here is the entry:\n\n'), text(json)];
    expect(JSON.parse(extractJsonText(content))).toEqual(article);
  });

  it('strips markdown code fences', () => {
    const content = [...search, text('```json\n' + json + '\n```')];
    expect(JSON.parse(extractJsonText(content))).toEqual(article);
  });

  it('ignores a trailing commentary block after the JSON', () => {
    const content = [...search, text(json), text('\n\nLet me know if you need changes.')];
    expect(JSON.parse(extractJsonText(content))).toEqual(article);
  });

  it('ignores text emitted before the last web search', () => {
    const content = [text('{ "draft": true }'), ...search, text(json)];
    expect(JSON.parse(extractJsonText(content))).toEqual(article);
  });

  it('throws when the final answer holds no JSON object', () => {
    const content = [...search, text('I could not find enough information today.')];
    expect(() => extractJsonText(content)).toThrow('No JSON object found');
  });
});
