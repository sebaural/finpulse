import { describe, expect, it } from 'vitest';
import { pulseQualityIssues, storyAnchors } from '@/lib/pulse-quality';

const filler = (seed: string) =>
  `${seed} ` +
  'Canberra officials said the mid-year fiscal update would trim spending across several ' +
  'departments, with Treasury modelling pointing to slower growth and a wider deficit. ' +
  'Opposition figures questioned the timing, while business groups in Sydney and Melbourne ' +
  'urged the government to protect infrastructure commitments already announced this year.';

const source =
  'Chalmers warns of economic turmoil, plans budget cuts: Australian Treasurer Jim Chalmers ' +
  'says the Middle East conflict is pushing up inflation ahead of the budget update.';

// Shape of the published 2026-10-04 "australian-budget-cuts" Pulse article.
const brokenAustralianBudget = {
  topicAnalysis:
    'The Australian government is facing economic pressures due to global turmoil, and Treasurer ' +
    'Jim Chalmers is preparing to make budget cuts. This development matters for the economy beat ' +
    'as it highlights the challenges of managing public finances in a time of economic uncertainty. ' +
    'The decision to cut the budget will have significant implications for various sectors and ' +
    'services, and the blame game between the government and private sector adds to the complexity.',
  perspectives: [
    {
      title: 'Export-oriented US businesses',
      text: filler(
        'Export-oriented US businesses argue that the focus on the private sector is misplaced. ' +
          'This perspective is supported by the fact that the conflict has driven up inflation.',
      ),
    },
    { title: 'Fiscal conservatives', text: filler('Fiscal conservatives argue cuts are needed.') },
    { title: 'Labor unions', text: filler('Labor unions argue cuts hurt vulnerable households.') },
  ],
  macroNarrative1: filler('One camp sees restraint as overdue.'),
  macroNarrative2: filler('The other camp sees cuts as self-defeating.'),
};

const goodAustralianBudget = {
  ...brokenAustralianBudget,
  topicAnalysis: filler(
    'Australian Treasurer Jim Chalmers warned that the Middle East conflict is lifting inflation ' +
      'and said the coming budget update will include spending cuts.',
  ),
  perspectives: [
    { title: 'Treasury and the Albanese government', text: filler('The government argues restraint.') },
    { title: 'Coalition opposition', text: filler('The opposition argues for deeper service cuts.') },
    { title: 'Australian unions', text: filler('Unions argue cuts hurt vulnerable households.') },
  ],
};

describe('pulse quality gate', () => {
  it('rejects the copied-prompt Australian budget article', () => {
    const issues = pulseQualityIssues(brokenAustralianBudget, source);
    expect(issues.join('\n')).toMatch(/export-oriented/i);
    expect(issues.join('\n')).toMatch(/beat/);
    expect(issues.join('\n')).toMatch(/supported by the fact that/);
  });

  it('accepts a story-specific article', () => {
    expect(pulseQualityIssues(goodAustralianBudget, source)).toEqual([]);
  });

  it('rejects short sections and duplicate perspective titles', () => {
    const issues = pulseQualityIssues(
      {
        ...goodAustralianBudget,
        perspectives: [
          { title: 'Unions', text: 'Too short.' },
          { title: 'unions', text: filler('x') },
          { title: 'Business', text: filler('y') },
        ],
      },
      source,
    );
    expect(issues).toContain('perspective1 too short (2 words)');
    expect(issues).toContain('duplicate perspective titles');
  });

  it('rejects an analysis that names nothing from the sources', () => {
    const issues = pulseQualityIssues(
      { ...goodAustralianBudget, topicAnalysis: filler('A government faces pressure.').replace(/Canberra|Treasury|Sydney|Melbourne|Opposition/g, 'the') },
      source,
    );
    expect(issues).toContain('topicAnalysis names nothing from the source stories');
  });

  it('extracts proper nouns and numbers but not sentence-start words', () => {
    const anchors = storyAnchors('The Fed held rates at 4.25% as Powell spoke');
    expect(anchors.has('fed')).toBe(true);
    expect(anchors.has('powell')).toBe(true);
    expect(anchors.has('4.25%')).toBe(true);
    expect(anchors.has('the')).toBe(false);
  });
});
