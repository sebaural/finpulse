import { describe, expect, it } from 'vitest';

import { canonicalizeSlug, toSlug } from '@/lib/summary-pipeline';

describe('slug normalization', () => {
  it('normalizes percent-encoded unicode slugs', () => {
    expect(canonicalizeSlug('eu-sanctions-iran-israel-d%C3%A9tente')).toBe(
      'eu-sanctions-iran-israel-detente',
    );
  });

  it('normalizes direct unicode slugs', () => {
    expect(canonicalizeSlug('EU Sanctions Iran Israel détente')).toBe(
      'eu-sanctions-iran-israel-detente',
    );
  });

  it('keeps existing canonical slugs unchanged', () => {
    expect(canonicalizeSlug('eu-sanctions-iran-israel-detente')).toBe(
      'eu-sanctions-iran-israel-detente',
    );
  });

  it('makes toSlug use the same canonicalization path', () => {
    expect(toSlug('EU Sanctions Iran Israel détente')).toBe('eu-sanctions-iran-israel-detente');
  });
});
