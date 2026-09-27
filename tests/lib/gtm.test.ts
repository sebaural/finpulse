import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendGTMEvent } from '@/lib/gtm';

// sendGTMEvent has no in-repo callers yet — it's the helper for pushing
// custom events to the GTM container loaded by components/GoogleTagManager.tsx.
describe('sendGTMEvent', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates window.dataLayer when GTM has not initialized it yet', () => {
    const fakeWindow = {} as Window;
    vi.stubGlobal('window', fakeWindow);

    sendGTMEvent({ event: 'search', query: 'tariffs' });

    expect(fakeWindow.dataLayer).toEqual([{ event: 'search', query: 'tariffs' }]);
  });

  it('appends to the existing dataLayer in order', () => {
    const gtmStart = { 'gtm.start': 1, event: 'gtm.js' };
    const fakeWindow = { dataLayer: [gtmStart] } as unknown as Window;
    vi.stubGlobal('window', fakeWindow);

    sendGTMEvent({ event: 'first' });
    sendGTMEvent({ event: 'second' });

    expect(fakeWindow.dataLayer).toEqual([gtmStart, { event: 'first' }, { event: 'second' }]);
  });

  it('is a no-op during server rendering (no window)', () => {
    expect(typeof window).toBe('undefined');
    expect(() => sendGTMEvent({ event: 'ignored' })).not.toThrow();
  });
});
