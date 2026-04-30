import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { NewsArticle } from '../types';
import { playBeep, unlockAudio } from '../lib/audioUtils';
import type { InterruptPolicy, SpeechRules, TraderProfile, VoiceSettings } from '../types/speech';

// ── Public types ──────────────────────────────────────────────────────────────

export type ReadMode = 'headline' | 'summary';
export type { InterruptPolicy, SpeechRules, TraderProfile, VoiceSettings };

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  rate:              0.92,
  pitch:             1.0,
  volume:            0.95,
  gap:               1.5,
  selectedVoiceName: '',
};

const DEFAULT_RULES: SpeechRules = {
  skipLow:   true,
  dedup:     true,
  tone:      true,
  interrupt: true,
};

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

/** Returns the top en-US voice and top en-GB voice available in the browser */
function loadPreferredVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  const all = window.speechSynthesis.getVoices();
  if (all.length === 0) return [];

  const norm     = (lang: string) => lang.toLowerCase().replace('_', '-');
  const usVoices = all.filter(v => norm(v.lang).startsWith('en-us'));
  const gbVoices = all.filter(v => norm(v.lang).startsWith('en-gb'));

  const PREFERRED = [
    'Google UK English Male', 'Google UK English Female', 'Google US English',
    'Microsoft David', 'Microsoft Zira', 'Microsoft Mark',
    'Alex', 'Samantha', 'Daniel', 'Karen', 'Moira', 'Fiona',
  ];
  const byPref = (a: SpeechSynthesisVoice, b: SpeechSynthesisVoice) => {
    const ai = PREFERRED.findIndex(p => a.name.includes(p.split(' ').pop()!));
    const bi = PREFERRED.findIndex(p => b.name.includes(p.split(' ').pop()!));
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  };
  const pickTop = (voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null =>
    voices.length ? ([...voices].sort(byPref)[0] ?? null) : null;

  const usTop = pickTop(usVoices);
  const gbTop = pickTop(gbVoices);
  return [usTop, gbTop].filter((v): v is SpeechSynthesisVoice => v !== null);
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

// ── Hook state interface ──────────────────────────────────────────────────────

interface SpeechState {
  // TTS support
  hasResolvedSupport:  boolean;
  isSupported:         boolean;
  // Playback
  isPlaying:           boolean;
  isPaused:            boolean;
  autoplay:            boolean;
  voice:               SpeechSynthesisVoice | null;
  currentArticleId:    string | null;
  currentArticleTitle: string | null;
  progressPct:         number;
  mode:                ReadMode;
  // Voice settings
  voiceSettings:       VoiceSettings;
  voices:              SpeechSynthesisVoice[];
  // Intelligence
  interruptPolicy:     InterruptPolicy;
  rules:               SpeechRules;
  // Modal
  isSettingsOpen:      boolean;
  // Transient UI feedback
  statusMessage:       string | null;
}

// ── Main hook ─────────────────────────────────────────────────────────────────

export function useSpeechReader(articles: NewsArticle[], filterKey?: string) {
  // ── Refs (mutable state that does not drive renders) ──────────────────────
  const utteranceRef       = useRef<SpeechSynthesisUtterance | null>(null);
  const progressTimerRef   = useRef<number | null>(null);
  const gapTimerRef        = useRef<number | null>(null);
  const readByIdRef        = useRef<(id: string) => void>(() => {});
  const articlesRef        = useRef(articles);
  const autoplayRef        = useRef(false);
  const spokenIdsRef       = useRef<Set<string>>(new Set());
  const lastSpokenRef      = useRef<NewsArticle | null>(null);
  const voiceSettingsRef   = useRef<VoiceSettings>(DEFAULT_VOICE_SETTINGS);
  const rulesRef           = useRef<SpeechRules>(DEFAULT_RULES);
  const interruptPolicyRef = useRef<InterruptPolicy>('critical');
  const isPlayingRef       = useRef(false);
  const isPausedRef        = useRef(false);
  const modeRef            = useRef<ReadMode>('headline');
  const filterKeyRef       = useRef<string | undefined>(undefined);

  const hasHydrated = useSyncExternalStore(subscribeToHydration, getHydrationSnapshot, () => false);

  const [state, setState] = useState<SpeechState>({
    hasResolvedSupport:  false,
    isSupported:         false,
    isPlaying:           false,
    isPaused:            false,
    autoplay:            false,
    voice:               null,
    currentArticleId:    null,
    currentArticleTitle: null,
    progressPct:         0,
    mode:                'headline',
    voiceSettings:       DEFAULT_VOICE_SETTINGS,
    voices:              [],
    interruptPolicy:     'critical',
    rules:               DEFAULT_RULES,
    isSettingsOpen:      false,
    statusMessage:       null,
  });

  // ── Keep refs in sync with state ──────────────────────────────────────────
  useEffect(() => { articlesRef.current        = articles; },               [articles]);
  useEffect(() => { autoplayRef.current        = state.autoplay; },         [state.autoplay]);
  useEffect(() => { voiceSettingsRef.current   = state.voiceSettings; },    [state.voiceSettings]);
  useEffect(() => { rulesRef.current           = state.rules; },            [state.rules]);
  useEffect(() => { interruptPolicyRef.current = state.interruptPolicy; },  [state.interruptPolicy]);
  useEffect(() => { isPlayingRef.current       = state.isPlaying; },        [state.isPlaying]);
  useEffect(() => { isPausedRef.current        = state.isPaused; },         [state.isPaused]);
  useEffect(() => { modeRef.current            = state.mode; },             [state.mode]);
  useEffect(() => { markHydrated(); }, []);

  // ── React to filter changes during active playback ────────────────────────
  useEffect(() => {
    const prevKey = filterKeyRef.current;
    filterKeyRef.current = filterKey;

    // Skip initial mount and no-op changes.
    if (prevKey === undefined || prevKey === filterKey) return;
    // Only act when the player is engaged (playing or paused).
    if (!isPlayingRef.current && !isPausedRef.current) return;

    // Cancel any pending gap-advance timer first.
    if (gapTimerRef.current !== null) {
      window.clearTimeout(gapTimerRef.current);
      gapTimerRef.current = null;
    }

    // articlesRef.current is already updated by the [articles] effect above
    // (effects run in declaration order within the same flush).
    const first = articlesRef.current[0];

    if (isPlayingRef.current) {
      // Actively playing: set autoplay=false BEFORE cancel so the stale onend
      // callback sees the flag and skips advancing the old queue.
      autoplayRef.current  = false;
      isPlayingRef.current = false;
      try { window.speechSynthesis.cancel(); } catch { /* ignore */ }

      if (!first) {
        if (progressTimerRef.current !== null) {
          window.clearInterval(progressTimerRef.current);
          progressTimerRef.current = null;
        }
        setState(prev => ({
          ...prev,
          isPlaying: false, isPaused: false, progressPct: 0,
          statusMessage: 'No articles match the current filters.',
        }));
        window.setTimeout(() => setState(prev => ({ ...prev, statusMessage: null })), 3000);
        return;
      }

      // Re-enable autoplay and start from the new first article.
      window.setTimeout(() => {
        autoplayRef.current = true;
        readByIdRef.current(first.id);
      }, 150);
    } else {
      // Paused: stop cleanly so the next ▶ press starts fresh from the new list.
      try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
      setState(prev => ({ ...prev, isPlaying: false, isPaused: false, progressPct: 0, autoplay: false }));
    }
  }, [filterKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Voice loading ─────────────────────────────────────────────────────────

  const updateVoices = useCallback(() => {
    const restricted = loadPreferredVoices();
    if (restricted.length === 0) return;
    setState(prev => {
      const hasSelected = restricted.some(v => v.name === prev.voiceSettings.selectedVoiceName);
      const defaultName = hasSelected
        ? prev.voiceSettings.selectedVoiceName
        : (restricted[0]?.name ?? '');
      const voice = restricted.find(v => v.name === defaultName) ?? restricted[0] ?? null;
      return {
        ...prev,
        voices:        restricted,
        voice,
        voiceSettings: { ...prev.voiceSettings, selectedVoiceName: defaultName },
      };
    });
  }, []);

  const currentIndex = useMemo(
    () => articles.findIndex((a) => a.id === state.currentArticleId),
    [articles, state.currentArticleId],
  );

  const queuedArticles = useMemo(() => {
    if (!state.rules.dedup) return articles;
    return articles.filter(a => !spokenIdsRef.current.has(a.id));
  }, [articles, state.rules.dedup]);

  const nextArticle = useMemo(() => {
    if (!state.autoplay || !state.currentArticleId) return null;
    const idx  = queuedArticles.findIndex(a => a.id === state.currentArticleId);
    if (idx < 0) return queuedArticles[0] ?? null;
    const next = queuedArticles[(idx + 1) % queuedArticles.length];
    return next?.id !== state.currentArticleId ? (next ?? null) : null;
  }, [queuedArticles, state.autoplay, state.currentArticleId]);

  // ── Browser init ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let supported = hasSpeechSupport(window);

    if (supported) {
      try { updateVoices(); }
      catch { supported = false; }
    }

    const timer = window.setTimeout(() => {
      setState(prev => ({ ...prev, hasResolvedSupport: true, isSupported: supported }));
    }, 0);

    if (!supported) return () => window.clearTimeout(timer);

    window.speechSynthesis.addEventListener('voiceschanged', updateVoices);

    // Unlock Web Audio API on first user gesture
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { passive: true, once: true });
    window.addEventListener('keydown',     unlock, { passive: true, once: true });

    return () => {
      window.clearTimeout(timer);
      window.speechSynthesis.removeEventListener('voiceschanged', updateVoices);
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown',     unlock);
      if (progressTimerRef.current !== null) window.clearInterval(progressTimerRef.current);
      if (gapTimerRef.current      !== null) window.clearTimeout(gapTimerRef.current);
      try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
    };
  }, [updateVoices]);

  // ── Progress timer helper ─────────────────────────────────────────────────

  const clearProgressTimer = useCallback(() => {
    if (progressTimerRef.current !== null) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  // ── Core speak() — uses refs so callbacks never go stale ─────────────────

  const speakArticle = useCallback(
    (article: NewsArticle) => {
      if (typeof window === 'undefined' || !hasSpeechSupport(window)) return;

      clearProgressTimer();
      if (gapTimerRef.current !== null) {
        window.clearTimeout(gapTimerRef.current);
        gapTimerRef.current = null;
      }

      try { window.speechSynthesis.cancel(); }
      catch {
        setState(prev => ({ ...prev, hasResolvedSupport: true, isSupported: false }));
        return;
      }

      const text = buildSpeechText(article, modeRef.current);
      const vs   = voiceSettingsRef.current;

      // Alert beep before breaking headlines
      if (article.importance === 1 && rulesRef.current.tone) {
        playBeep(1200, 0.08, 0.25);
        window.setTimeout(() => playBeep(900, 0.08, 0.2), 100);
      }

      let utterance: SpeechSynthesisUtterance;
      try { utterance = new SpeechSynthesisUtterance(text); }
      catch {
        setState(prev => ({ ...prev, hasResolvedSupport: true, isSupported: false }));
        return;
      }

      utterance.rate   = vs.rate;
      utterance.pitch  = vs.pitch;
      utterance.volume = vs.volume;
      utterance.lang   = 'en-US';

      // Re-query the live voices list to avoid stale object references
      const allVoices = window.speechSynthesis.getVoices();
      const voice     = allVoices.find(v => v.name === vs.selectedVoiceName) ?? null;
      if (voice) utterance.voice = voice;

      utterance.onstart = () => {
        isPlayingRef.current = true;
        spokenIdsRef.current.add(article.id);
        lastSpokenRef.current = article;
        setState(prev => ({
          ...prev,
          isPlaying:           true,
          isPaused:            false,
          currentArticleId:    article.id,
          currentArticleTitle: article.title,
        }));
      };

      utterance.onend = () => {
        isPlayingRef.current = false;
        clearProgressTimer();
        setState(prev => ({ ...prev, isPlaying: false, isPaused: false, progressPct: 100 }));
        window.setTimeout(() => setState(prev => ({ ...prev, progressPct: 0 })), 500);

        if (!autoplayRef.current) return;

        // Build next-up queue from feed order. Filtering by importance is the
        // responsibility of filteredArticles in the host — not the queue rules.
        const queue = rulesRef.current.dedup
          ? articlesRef.current.filter(a => !spokenIdsRef.current.has(a.id))
          : articlesRef.current;

        const idx  = queue.findIndex(a => a.id === article.id);
        const next = queue.length > 0 ? queue[(idx + 1) % queue.length] : null;

        if (next && next.id !== article.id) {
          const gapMs = voiceSettingsRef.current.gap * 1000;
          gapTimerRef.current = window.setTimeout(() => {
            if (autoplayRef.current && !isPlayingRef.current) {
              readByIdRef.current(next.id);
            }
          }, gapMs);
        }
      };

      utterance.onerror = () => {
        isPlayingRef.current = false;
        clearProgressTimer();
        setState(prev => ({ ...prev, isPlaying: false, isPaused: false }));
      };

      const duration = Math.max(8, text.length / (vs.rate * 14));
      progressTimerRef.current = window.setInterval(() => {
        setState(prev => {
          if (!prev.isPlaying) return prev;
          return { ...prev, progressPct: Math.min(prev.progressPct + 100 / (duration * 10), 96) };
        });
      }, 100);

      utteranceRef.current = utterance;
      try { window.speechSynthesis.speak(utterance); }
      catch {
        clearProgressTimer();
        setState(prev => ({
          ...prev, hasResolvedSupport: true, isSupported: false, isPlaying: false,
        }));
      }
    },
    [clearProgressTimer],
  );

  // ── Public actions ────────────────────────────────────────────────────────

  const readById = useCallback(
    (id: string) => {
      if (typeof window === 'undefined') return;
      const article = articlesRef.current.find(a => a.id === id);
      if (!article) return;
      setState(prev => ({ ...prev, progressPct: 0 }));
      speakArticle(article);
    },
    [speakArticle],
  );

  useEffect(() => { readByIdRef.current = readById; }, [readById]);

  const togglePlayPause = useCallback(() => {
    if (typeof window === 'undefined' || !hasSpeechSupport(window)) return;
    if (state.isPlaying) {
      autoplayRef.current  = false;
      isPlayingRef.current = false;
      try { window.speechSynthesis.pause(); } catch { return; }
      setState(prev => ({ ...prev, isPlaying: false, isPaused: true, autoplay: false }));
      return;
    }
    if (state.isPaused) {
      try { window.speechSynthesis.resume(); } catch { return; }
      // iOS Safari: pause() silently ends the utterance; resume() does nothing.
      // speaking is false → restart immediately.
      if (!window.speechSynthesis.speaking && state.currentArticleId) {
        autoplayRef.current = true;
        setState(prev => ({ ...prev, autoplay: true, isPaused: false }));
        readById(state.currentArticleId);
        return;
      }
      // Android Chrome: speaking gets stuck as true even when the utterance was
      // silently killed (screen lock / background). resume() does nothing and
      // onstart never fires. Detect by checking isPlayingRef after 250 ms —
      // on desktop onstart fires within one frame so this is a no-op there.
      if (state.currentArticleId) {
        const articleId = state.currentArticleId;
        window.setTimeout(() => {
          if (!isPlayingRef.current && autoplayRef.current) {
            try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
            readByIdRef.current(articleId);
          }
        }, 250);
      }
      autoplayRef.current = true;
      setState(prev => ({ ...prev, isPlaying: true, isPaused: false, autoplay: true }));
      return;
    }
    if (state.currentArticleId) {
      autoplayRef.current = true;
      setState(prev => ({ ...prev, autoplay: true }));
      readById(state.currentArticleId);
      return;
    }
    // Use the pre-filtered, pre-sorted list from the host (articlesRef.current) so
    // the active UI filters determine which article plays first — not the queue's
    // importance re-sort, which would ignore the priority-filter ordering.
    const first = articlesRef.current[0];
    if (!first) {
      setState(prev => ({ ...prev, statusMessage: 'No articles match the current filters.' }));
      window.setTimeout(() => setState(prev => ({ ...prev, statusMessage: null })), 3000);
      return;
    }
    autoplayRef.current = true;
    setState(prev => ({ ...prev, autoplay: true }));
    readById(first.id);
  }, [readById, state.currentArticleId, state.isPaused, state.isPlaying]);

  const stopReading = useCallback(() => {
    if (typeof window === 'undefined' || !hasSpeechSupport(window)) return;
    autoplayRef.current  = false;
    isPlayingRef.current = false;
    clearProgressTimer();
    if (gapTimerRef.current !== null) {
      window.clearTimeout(gapTimerRef.current);
      gapTimerRef.current = null;
    }
    try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
    setState(prev => ({ ...prev, isPlaying: false, isPaused: false, progressPct: 0, autoplay: false }));
  }, [clearProgressTimer]);

  const replayLast = useCallback(() => {
    const last = lastSpokenRef.current;
    if (!last) return;
    setState(prev => ({ ...prev, progressPct: 0 }));
    speakArticle(last);
  }, [speakArticle]);

  const jumpRelative = useCallback(
    (step: number) => {
      if (!articles.length) return;
      const safe = currentIndex >= 0 ? currentIndex : 0;
      const next = articles[(safe + step + articles.length) % articles.length];
      if (next) readById(next.id);
    },
    [articles, currentIndex, readById],
  );

  // ── Voice & intelligence settings ─────────────────────────────────────────

  const setVoiceSettings = useCallback((patch: Partial<VoiceSettings>) => {
    setState(prev => {
      const next  = { ...prev.voiceSettings, ...patch };
      voiceSettingsRef.current = next;
      const voice = prev.voices.find(v => v.name === next.selectedVoiceName) ?? prev.voice;
      return { ...prev, voiceSettings: next, voice };
    });
  }, []);

  const setInterruptPolicy = useCallback((policy: InterruptPolicy) => {
    interruptPolicyRef.current = policy;
    setState(prev => ({ ...prev, interruptPolicy: policy }));
  }, []);

  const setRules = useCallback((patch: Partial<SpeechRules>) => {
    setState(prev => {
      const next = { ...prev.rules, ...patch };
      rulesRef.current = next;
      return { ...prev, rules: next };
    });
  }, []);

  const setMode = useCallback((mode: ReadMode) => {
    modeRef.current = mode;
    setState(prev => ({ ...prev, mode }));
  }, []);



  // ── Trader profiles ───────────────────────────────────────────────────────

  const setProfile = useCallback((profile: TraderProfile) => {
    type Preset = {
      rate:            number;
      mode:            ReadMode;
      rules:           Partial<SpeechRules>;
      interruptPolicy: InterruptPolicy;
    };
    const presets: Record<TraderProfile, Preset> = {
      scalper:   { rate: 1.1,  mode: 'headline', rules: { skipLow: true,  interrupt: true  }, interruptPolicy: 'always'   },
      daytrader: { rate: 0.92, mode: 'summary',  rules: { skipLow: true,  interrupt: true  }, interruptPolicy: 'critical' },
      swing:     { rate: 0.85, mode: 'summary',  rules: { skipLow: true,  interrupt: false }, interruptPolicy: 'critical' },
      macro:     { rate: 0.85, mode: 'summary',  rules: { skipLow: false, interrupt: false }, interruptPolicy: 'never'    },
    };
    const p = presets[profile];
    modeRef.current            = p.mode;
    interruptPolicyRef.current = p.interruptPolicy;
    setState(prev => {
      const nextRules = { ...prev.rules, ...p.rules };
      const nextVS    = { ...prev.voiceSettings, rate: p.rate };
      rulesRef.current         = nextRules;
      voiceSettingsRef.current = nextVS;
      return {
        ...prev,
        mode:            p.mode,
        voiceSettings:   nextVS,
        rules:           nextRules,
        interruptPolicy: p.interruptPolicy,
        isSettingsOpen:  false,
      };
    });
  }, []);

  // ── Modal ─────────────────────────────────────────────────────────────────

  const openSettings  = useCallback(() => setState(prev => ({ ...prev, isSettingsOpen: true })),  []);
  const closeSettings = useCallback(() => setState(prev => ({ ...prev, isSettingsOpen: false })), []);

  // ── Return ────────────────────────────────────────────────────────────────

  return {
    ...state,
    hasHydrated,
    nextArticle,
    // Playback
    readById,
    togglePlayPause,
    stopReading,
    replayLast,
    next:           () => jumpRelative(1),
    prev:           () => jumpRelative(-1),
    // Settings
    setMode,
    setVoiceSettings,
    setInterruptPolicy,
    setRules,
    setProfile,
    openSettings,
    closeSettings,
  };
}
