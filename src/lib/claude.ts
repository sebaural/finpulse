import Anthropic from '@anthropic-ai/sdk';
import type { XBriefing, XPosterSection } from '@/types';

const SECTION_VOICE: Record<XPosterSection, string> = {
  markets:
    'You are a financial markets social media editor. Focus on macro signals, asset moves, and economic policy.',
  geopolitics:
    'You are a geopolitical risk analyst and social media editor. Focus on power dynamics, conflict risk, and policy shifts.',
  tech:
    'You are a technology industry analyst and social media editor. Focus on breakthroughs, industry trends, and strategic implications.',
};

const SYSTEM_RULES =
  '- Maximum 240 characters (the URL will be appended separately)\n' +
  '- Lead with the single most important insight\n' +
  '- 1–2 emojis max — only if they add signal\n' +
  '- No hashtags\n' +
  '- Professional but punchy tone\n' +
  '- Return ONLY the tweet text, nothing else';

async function callClaude(briefing: XBriefing, bodyText: string): Promise<string> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY is not set');

  const client = new Anthropic({ apiKey: anthropicKey });

  const systemPrompt = `${SECTION_VOICE[briefing.section]}\n\nRules:\n${SYSTEM_RULES}`;
  const userPrompt =
    `Article title: ${briefing.title}\nDate: ${briefing.date}\n\n${bodyText}`;

  const response = await client.messages.create({
    model:      'claude-opus-4-6',
    max_tokens: 256,
    system:     systemPrompt,
    messages:   [{ role: 'user', content: userPrompt }],
  });

  const block = response.content[0];
  if (block.type !== 'text') throw new Error('Unexpected Claude response type');
  return block.text.trim();
}

export async function generateTweet(briefing: XBriefing): Promise<string> {
  const MAX_TWEET = 280;
  const urlPart   = `\n${briefing.url}`;
  const textBudget = MAX_TWEET - urlPart.length;

  let tweetText = await callClaude(briefing, briefing.bodyText);

  if (`${tweetText}${urlPart}`.length > MAX_TWEET) {
    // Retry once with truncated bodyText
    const truncated = briefing.bodyText.slice(0, 1500);
    tweetText       = await callClaude(briefing, truncated);
  }

  // Hard-truncate as final safety net — guarantees ≤ 280 chars regardless of model output
  if (tweetText.length > textBudget) {
    tweetText = tweetText.slice(0, textBudget - 1) + '…';
  }

  return `${tweetText}${urlPart}`;
}
