// Content gate for RunPod-generated Pulse articles. The 8B model copies prompt
// examples verbatim ("export-oriented US businesses" landed in 43 unrelated
// articles) and pads sections with stock filler — the templated, thin output
// that got Pulse pages dropped from Google's index. Anything that trips this
// throws, so the QStash job fails and retries instead of publishing.

export interface PulseQualityInput {
  topicAnalysis: string;
  perspectives: { title: string; text: string }[];
  macroNarrative1: string;
  macroNarrative2: string;
}

// Phrases the old prompt used as examples, plus stock filler the 8B model
// falls back on when it has nothing story-specific to say.
const BANNED_PHRASES: RegExp[] = [
  /export-oriented/i,
  /house republican leadership/i,
  /eu finance ministries/i,
  /matters for the [\w\s-]{1,30} beat/i,
  /\b(?:for|on) (?:this|our) beat\b/i,
  /adds to the complexity/i,
  /this perspective is supported by the fact that/i,
  /\bhas significant implications for various sectors\b/i,
  /\bwill have significant implications for various\b/i,
];

const MIN_SECTION_WORDS = 45;

// Capitalized words that start sentences or are too generic to prove the
// analysis is about the source story.
const GENERIC_CAPITALIZED = new Set([
  'The', 'A', 'An', 'And', 'But', 'For', 'In', 'On', 'At', 'Of', 'To', 'As', 'By',
  'With', 'From', 'After', 'Before', 'Amid', 'Over', 'New', 'How', 'Why', 'What',
  'Who', 'When', 'Where', 'This', 'That', 'Its', 'His', 'Her', 'Their', 'Is', 'Are',
  'Was', 'Will', 'Says', 'Said', 'Could', 'Would', 'Should', 'May', 'Can', 'Not',
  'Up', 'Down', 'Out', 'Off', 'Into', 'About', 'Here', 'More', 'Most', 'Some',
]);

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

// Proper-noun-ish words (and numbers) from the source titles/snippets: at least
// one must reappear in the topic analysis, or it isn't about this story.
export function storyAnchors(sourceText: string): Set<string> {
  const anchors = new Set<string>();
  for (const m of sourceText.matchAll(/\b[A-Z][a-zA-Z'’-]{2,}\b/g)) {
    if (!GENERIC_CAPITALIZED.has(m[0])) anchors.add(m[0].toLowerCase());
  }
  for (const m of sourceText.matchAll(/\b\d[\d.,]*%?/g)) {
    if (m[0].replace(/[.,%]/g, '').length >= 2) anchors.add(m[0].toLowerCase());
  }
  return anchors;
}

export function pulseQualityIssues(out: PulseQualityInput, sourceText: string): string[] {
  const issues: string[] = [];
  const sections: [string, string][] = [
    ['topicAnalysis', out.topicAnalysis],
    ...out.perspectives.map((p, i) => [`perspective${i + 1}`, p.text] as [string, string]),
    ['macroNarrative1', out.macroNarrative1],
    ['macroNarrative2', out.macroNarrative2],
  ];

  const allText = [
    ...sections.map(([, text]) => text),
    ...out.perspectives.map((p) => p.title),
  ].join('\n');
  for (const re of BANNED_PHRASES) {
    const hit = allText.match(re);
    if (hit) issues.push(`banned phrase: "${hit[0]}"`);
  }

  for (const [name, text] of sections) {
    const words = wordCount(text);
    if (words < MIN_SECTION_WORDS) issues.push(`${name} too short (${words} words)`);
  }

  const titles = out.perspectives.map((p) => p.title.trim().toLowerCase());
  if (new Set(titles).size !== titles.length) issues.push('duplicate perspective titles');

  const anchors = storyAnchors(sourceText);
  if (anchors.size > 0) {
    const analysis = out.topicAnalysis.toLowerCase();
    const grounded = [...anchors].some((a) => analysis.includes(a));
    if (!grounded) issues.push('topicAnalysis names nothing from the source stories');
  }

  return issues;
}

export function assertPulseQuality(out: PulseQualityInput, sourceText: string): void {
  const issues = pulseQualityIssues(out, sourceText);
  if (issues.length) {
    throw new Error(`Pulse output failed quality gate: ${issues.join('; ')}`);
  }
}
