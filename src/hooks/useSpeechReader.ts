import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { NewsArticle } from '../types';

// ── Public types ─────────────────────────────────────────────────────────────

export type ReadMode = 'headline' | 'summary' | 'full';

// ── Text preprocessing ────────────────────────────────────────────────────────

const TICKER_MAP: Record<string, string> = {
  AAPL: 'Apple', NVDA: 'Nvidia', TSLA: 'Tesla', AMZN: 'Amazon',
  MSFT: 'Microsoft', GOOGL: 'Google', GOOG: 'Google', META: 'Meta',
  AMD: 'A M D', INTC: 'Intel', NFLX: 'Netflix', PYPL: 'PayPal',
  BABA: 'Alibaba', BTC: 'Bitcoin', ETH: 'Ethereum',
  'S&P 500': 'S and P five hundred', 'S&P': 'S and P',
  'EUR/USD': 'euro dollar', 'USD/JPY': 'dollar yen', 'GBP/USD': 'pound dollar',
  Fed: 'Federal Reserve', ECB: 'European Central Bank',
  BOJ: 'Bank of Japan', BOE: 'Bank of England', BOC: 'Bank of Canada',
  CPI: 'consumer price index', NFP: 'nonfarm payrolls',
  FOMC: 'Federal Open Market Committee', GDP: 'gross domestic product',
  EPS: 'earnings per share', ETF: 'E T F', IPO: 'I P O',
  OPEC: 'O PEC', WTI: 'West Texas crude',
};

function normalizeText(text: string): string {
  let t = text;
  for (const [ticker, spoken] of Object.entries(TICKER_MAP)) {
    const escaped = ticker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    t = t.replace(new RegExp(`\\b${escaped}\\b`, 'g'), spoken);
  }
  t = t.replace(/\$(\d+(?:\.\d+)?)\s?(?:trillion|tn)/gi, '$1 trillion dollars');
  t = t.replace(/\$(\d+(?:\.\d+)?)\s?(?:billion|bn)/gi, '$1 billion dollars');
  t = t.replace(/\$(\d+(?:\.\d+)?)\s?(?:million|mn|mln)/gi, '$1 million dollars');
  t = t.replace(/\$(\d+(?:\.\d+)?)/g, '$1 dollars');
  t = t.replace(/(\d+(?:\.\d+)?)%/g, '$1 percent');
  t = t.replace(/\bM\/M\b/gi, 'month over month');
  t = t.replace(/\bY\/Y\b/gi, 'year over year');
  t = t.replace(/\bQ\/Q\b/gi, 'quarter over quarter');
  t = t.replace(/\bvs\.?\s?Exp\.?/gi, 'versus expectations of');
  t = t.replace(/\bvs\b/gi, 'versus');
  t = t.replace(/\s&\s/g, ' and ');
  t = t.replace(/\[.*?\]/g, '').replace(/\(.*?\)/g, '');
  return t.replace(/\s+/g, ' ').trim();
}

function buildSpeechText(article: NewsArticle, mode: ReadMode): string {
  const title = normalizeText(article.title);
  const summary = normalizeText(article.summary);
  const breaking = article.importance === 1 ? 'Breaking. ' : '';
  if (mode === 'headline') return `${breaking}${title}`;
  if (mode === 'summary') return `${breaking}${title}. ${summary}`;
  return `${breaking}${article.source} reports: ${title}. ${summary}`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hasSpeechSupport(win: Window): boolean {
  return 'speechSynthesis' in win && typeof SpeechSynthesisUtterance !== 'undefined';
}

function pickPreferredVoice(all: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const byVoiceUri = all.find((v) => v.voiceURI === 'en-US-NYC');
  if (byVoiceUri) return byVoiceUri;

  const normalized = all.map((voice) => ({
    voice,
    name: voice.name.toLowerCase(),
    uri: voice.voiceURI.toLowerCase(),
    lang: voice.lang.toLowerCase(),
  }));

  const exactRequested = normalized.find(({ name, uri, lang }) =>
    (name.includes('english') || lang === 'en-us') &&
    (name.includes('america') || name.includes('american') || uri.includes('en-us')) &&
    (name.includes('new york city') || name.includes('nyc') || uri.includes('nyc')) &&
    (name.includes('female4') || uri.includes('female4')),
  );
  if (exactRequested) return exactRequested.voice;

  const enUsNycFemale = normalized.find(({ name, uri, lang }) =>
    (lang === 'en-us' || uri.includes('en-us')) &&
    (name.includes('new york city') || name.includes('nyc') || uri.includes('nyc')) &&
    (name.includes('female') || uri.includes('female')),
  );
  if (enUsNycFemale) return enUsNycFemale.voice;

  const enUsFemale = normalized.find(({ name, uri, lang }) =>
    (lang === 'en-us' || uri.includes('en-us')) &&
    (name.includes('female') || uri.includes('female')),
  );
  if (enUsFemale) return enUsFemale.voice;

  const anyEnUs = all.find((v) => v.lang === 'en-US');
  if (anyEnUs) return anyEnUs;

  return all.find((v) => v.lang.startsWith('en')) ?? null;
}

const hydrationListeners = new Set<() => void>();
let hasHydratedSnapshot = false;

function subscribeToHydration(listener: () => void) {
  hydrationListeners.add(listener);
  return () => hydrationListeners.delete(listener);
}

function getHydrationSnapshot() {
  return hasHydratedSnapshot;
}

function markHydrated() {
  if (hasHydratedSnapshot) return;
  hasHydratedSnapshot = true;
  hydrationListeners.forEach((listener) => listener());
}

// ── Hook state ────────────────────────────────────────────────────────────────

interface SpeechState {
  hasResolvedSupport: boolean;
  isSupported: boolean;
  isPlaying: boolean;
  isPaused: boolean;
  autoplay: boolean;
  voice: SpeechSynthesisVoice | null;
  currentArticleId: string | null;
  progressPct: number;
  mode: ReadMode;
  currentArticleTitle: string | null;
}

// ── Main hook ─────────────────────────────────────────────────────────────────

export function useSpeechReader(articles: NewsArticle[]) {
  const utteranceRef     = useRef<SpeechSynthesisUtterance | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  const readByIdRef      = useRef<(id: string) => void>(() => {});
  const articlesRef      = useRef(articles);
  const autoplayRef      = useRef(false);
  const spokenIdsRef     = useRef<Set<string>>(new Set());

  const hasHydrated = useSyncExternalStore(subscribeToHydration, getHydrationSnapshot, () => false);

  const [state, setState] = useState<SpeechState>({
    hasResolvedSupport: false,
    isSupported: false,
    isPlaying: false,
    isPaused: false,
    autoplay: false,
    voice: null,
    currentArticleId: null,
    progressPct: 0,
    mode: 'headline',
    currentArticleTitle: null,
  });

  // Keep refs in sync
  useEffect(() => { articlesRef.current = articles; }, [articles]);
  useEffect(() => { autoplayRef.current = state.autoplay; }, [state.autoplay]);
  useEffect(() => { markHydrated(); }, []);

  const currentIndex = useMemo(
    () => articles.findIndex((a) => a.id === state.currentArticleId),
    [articles, state.currentArticleId],
  );

  const queuedArticles = useMemo(
    () => [...articles].sort((a, b) => a.importance - b.importance),
    [articles],
  );

  const nextArticle = useMemo(() => {
    if (!state.autoplay || !state.currentArticleId) return null;
    const idx = queuedArticles.findIndex((a) => a.id === state.currentArticleId);
    if (idx < 0) return queuedArticles[0] ?? null;
    const next = queuedArticles[(idx + 1) % queuedArticles.length];
    return next?.id !== state.currentArticleId ? next ?? null : null;
  }, [queuedArticles, state.autoplay, state.currentArticleId]);

  // ── Browser init ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let supported = hasSpeechSupport(window);

    const assignVoice = () => {
      const all = window.speechSynthesis.getVoices();
      const preferred = pickPreferredVoice(all);
      setState((prev) => {
        if (prev.voice?.voiceURI === preferred?.voiceURI) return prev;
        return { ...prev, voice: preferred };
      });
    };

    if (supported) {
      try { window.speechSynthesis.getVoices(); assignVoice(); }
      catch { supported = false; }
    }

    const timer = window.setTimeout(() => {
      setState((prev) => ({ ...prev, hasResolvedSupport: true, isSupported: supported }));
    }, 0);

    if (!supported) return () => window.clearTimeout(timer);

    window.speechSynthesis.addEventListener('voiceschanged', assignVoice);
    return () => {
      window.clearTimeout(timer);
      window.speechSynthesis.removeEventListener('voiceschanged', assignVoice);
      if (progressTimerRef.current !== null) window.clearInterval(progressTimerRef.current);
      try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
    };
  }, []);

  // ── Progress timer ────────────────────────────────────────────────────────

  const clearProgressTimer = useCallback(() => {
    if (progressTimerRef.current !== null) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  // ── Core speak ────────────────────────────────────────────────────────────

  const speakArticle = useCallback(
    (article: NewsArticle) => {
      if (typeof window === 'undefined' || !hasSpeechSupport(window)) return;

      clearProgressTimer();
      try { window.speechSynthesis.cancel(); }
      catch {
        setState((prev) => ({ ...prev, hasResolvedSupport: true, isSupported: false }));
        return;
      }

      const text = buildSpeechText(article, state.mode);

      let utterance: SpeechSynthesisUtterance;
      try { utterance = new SpeechSynthesisUtterance(text); }
      catch {
        setState((prev) => ({ ...prev, hasResolvedSupport: true, isSupported: false }));
        return;
      }

      utterance.rate  = 1;
      utterance.pitch = 1;
      utterance.lang  = 'en-US';
      if (state.voice) utterance.voice = state.voice;

      utterance.onstart = () => {
        spokenIdsRef.current.add(article.id);
        setState((prev) => ({
          ...prev,
          isPlaying: true,
          isPaused: false,
          currentArticleId: article.id,
          currentArticleTitle: article.title,
        }));
      };

      utterance.onend = () => {
        clearProgressTimer();
        setState((prev) => ({ ...prev, isPlaying: false, isPaused: false, progressPct: 100 }));
        window.setTimeout(() => setState((prev) => ({ ...prev, progressPct: 0 })), 500);

        if (autoplayRef.current) {
          const sorted = [...articlesRef.current].sort((a, b) => a.importance - b.importance);
          const idx = sorted.findIndex((a) => a.id === article.id);
          const next = sorted.length > 0 ? sorted[(idx + 1) % sorted.length] : null;
          if (next && next.id !== article.id) {
            window.setTimeout(() => readByIdRef.current(next.id), 300);
          }
        }
      };

      utterance.onerror = () => {
        clearProgressTimer();
        setState((prev) => ({ ...prev, isPlaying: false, isPaused: false }));
      };

      const duration = Math.max(8, text.length / (utterance.rate * 14));
      progressTimerRef.current = window.setInterval(() => {
        setState((prev) => {
          if (!prev.isPlaying) return prev;
          return { ...prev, progressPct: Math.min(prev.progressPct + 100 / (duration * 10), 96) };
        });
      }, 100);

      utteranceRef.current = utterance;
      try { window.speechSynthesis.speak(utterance); }
      catch {
        clearProgressTimer();
        setState((prev) => ({ ...prev, hasResolvedSupport: true, isSupported: false, isPlaying: false }));
      }
    },
    [clearProgressTimer, state.mode, state.voice],
  );

  // ── Public actions ────────────────────────────────────────────────────────

  const readById = useCallback(
    (id: string) => {
      const article = articles.find((a) => a.id === id);
      if (!article) return;
      setState((prev) => ({ ...prev, progressPct: 0 }));
      speakArticle(article);
    },
    [articles, speakArticle],
  );

  useEffect(() => { readByIdRef.current = readById; }, [readById]);

  const togglePlayPause = useCallback(() => {
    if (typeof window === 'undefined' || !hasSpeechSupport(window)) return;
    if (state.isPlaying) {
      try { window.speechSynthesis.pause(); } catch { return; }
      setState((prev) => ({ ...prev, isPlaying: false, isPaused: true }));
      return;
    }
    if (state.isPaused) {
      try { window.speechSynthesis.resume(); } catch { return; }
      setState((prev) => ({ ...prev, isPlaying: true, isPaused: false }));
      return;
    }
    if (state.currentArticleId) { readById(state.currentArticleId); return; }
    const first = queuedArticles[0];
    if (first) readById(first.id);
  }, [queuedArticles, readById, state.currentArticleId, state.isPaused, state.isPlaying]);

  const stopReading = useCallback(() => {
    if (typeof window === 'undefined' || !hasSpeechSupport(window)) return;
    clearProgressTimer();
    try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
    setState((prev) => ({ ...prev, isPlaying: false, isPaused: false, progressPct: 0 }));
  }, [clearProgressTimer]);

  const jumpRelative = useCallback(
    (step: number) => {
      if (!articles.length) return;
      const safe = currentIndex >= 0 ? currentIndex : 0;
      const next = articles[(safe + step + articles.length) % articles.length];
      if (next) readById(next.id);
    },
    [articles, currentIndex, readById],
  );

  return {
    ...state,
    hasHydrated,
    nextArticle,
    readById,
    togglePlayPause,
    stopReading,
    next: () => jumpRelative(1),
    prev: () => jumpRelative(-1),
    setMode:             (mode: ReadMode) =>
                           setState((prev) => ({ ...prev, mode })),
    toggleAutoplay:      () => setState((prev) => ({ ...prev, autoplay: !prev.autoplay })),
  };
}
