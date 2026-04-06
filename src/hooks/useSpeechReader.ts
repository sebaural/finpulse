import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NewsArticle } from '../types';

interface UseSpeechReaderState {
  hasResolvedSupport: boolean;
  isSupported: boolean;
  isPlaying: boolean;
  isPaused: boolean;
  autoplay: boolean;
  speechRate: number;
  voice: SpeechSynthesisVoice | null;
  currentArticleId: string | null;
  progressPct: number;
}

function hasSpeechSupport(win: Window): boolean {
  return 'speechSynthesis' in win && typeof SpeechSynthesisUtterance !== 'undefined';
}

export function useSpeechReader(articles: NewsArticle[]) {
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  const readByIdRef = useRef<(id: string) => void>(() => {});

  const [state, setState] = useState<UseSpeechReaderState>({
    hasResolvedSupport: false,
    isSupported: false,
    isPlaying: false,
    isPaused: false,
    autoplay: false,
    speechRate: 1,
    voice: null,
    currentArticleId: null,
    progressPct: 0,
  });

  const currentIndex = useMemo(
    () => articles.findIndex((a) => a.id === state.currentArticleId),
    [articles, state.currentArticleId],
  );

  const clearProgressTimer = useCallback(() => {
    if (progressTimerRef.current !== null) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let supportsSpeech = hasSpeechSupport(window);

    const assignPreferredVoice = () => {
      const allVoices = window.speechSynthesis.getVoices();

      const preferredVoice =
        allVoices.find((voice) => voice.name === 'Google UK English Female') ??
        allVoices.find((voice) => voice.lang.startsWith('en')) ??
        null;

      setState((prev) => {
        if (prev.voice?.voiceURI === preferredVoice?.voiceURI) {
          return prev;
        }

        return {
          ...prev,
          voice: preferredVoice,
        };
      });
    };

    if (supportsSpeech) {
      try {
        window.speechSynthesis.getVoices();
        assignPreferredVoice();
      } catch {
        supportsSpeech = false;
      }
    }

    const supportUpdateTimer = window.setTimeout(() => {
      setState((prev) => ({
        ...prev,
        hasResolvedSupport: true,
        isSupported: supportsSpeech,
      }));
    }, 0);

    if (!supportsSpeech) {
      return () => {
        window.clearTimeout(supportUpdateTimer);
      };
    }

    window.speechSynthesis.addEventListener('voiceschanged', assignPreferredVoice);

    return () => {
      window.clearTimeout(supportUpdateTimer);
      window.speechSynthesis.removeEventListener('voiceschanged', assignPreferredVoice);
      clearProgressTimer();
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore cleanup errors from unstable browser speech engines.
      }
    };
  }, [clearProgressTimer]);

  const setPlayingState = useCallback((isPlaying: boolean, isPaused = false) => {
    setState((prev) => ({ ...prev, isPlaying, isPaused }));
  }, []);

  const speakArticle = useCallback(
    (article: NewsArticle) => {
      if (typeof window === 'undefined' || !hasSpeechSupport(window)) return;

      clearProgressTimer();
      try {
        window.speechSynthesis.cancel();
      } catch {
        setState((prev) => ({ ...prev, hasResolvedSupport: true, isSupported: false }));
        return;
      }

      let utterance: SpeechSynthesisUtterance;
      try {
        utterance = new SpeechSynthesisUtterance(
          `${article.source} reports: ${article.title}. ${article.summary}`,
        );
      } catch {
        setState((prev) => ({ ...prev, hasResolvedSupport: true, isSupported: false }));
        return;
      }

      utterance.rate = state.speechRate;
      utterance.pitch = 1;
      utterance.lang = 'en-US';

      if (state.voice) {
        utterance.voice = state.voice;
      }

      utterance.onstart = () => {
        setState((prev) => ({ ...prev, isPlaying: true, isPaused: false, currentArticleId: article.id }));
      };

      utterance.onend = () => {
        clearProgressTimer();
        setState((prev) => ({ ...prev, isPlaying: false, isPaused: false, progressPct: 100 }));
        window.setTimeout(() => {
          setState((prev) => ({ ...prev, progressPct: 0 }));
        }, 500);

        if (state.autoplay && articles.length) {
          const idx = articles.findIndex((a) => a.id === article.id);
          const next = articles[(idx + 1) % articles.length];
          if (next) {
            window.setTimeout(() => {
              readByIdRef.current(next.id);
            }, 0);
          }
        }
      };

      utterance.onerror = () => {
        clearProgressTimer();
        setPlayingState(false, false);
      };

      const durationEstimate = Math.max(8, utterance.text.length / (utterance.rate * 14));
      progressTimerRef.current = window.setInterval(() => {
        setState((prev) => {
          if (!prev.isPlaying) return prev;
          return {
            ...prev,
            progressPct: Math.min(prev.progressPct + 100 / (durationEstimate * 10), 96),
          };
        });
      }, 100);

      utteranceRef.current = utterance;
      try {
        window.speechSynthesis.speak(utterance);
      } catch {
        clearProgressTimer();
        setState((prev) => ({ ...prev, hasResolvedSupport: true, isSupported: false, isPlaying: false }));
      }
    },
    [articles, clearProgressTimer, setPlayingState, state.autoplay, state.speechRate, state.voice],
  );

  const readById = useCallback(
    (id: string) => {
      const article = articles.find((a) => a.id === id);
      if (!article) return;
      setState((prev) => ({ ...prev, progressPct: 0 }));
      speakArticle(article);
    },
    [articles, speakArticle],
  );

  useEffect(() => {
    readByIdRef.current = readById;
  }, [readById]);

  const togglePlayPause = useCallback(() => {
    if (typeof window === 'undefined' || !hasSpeechSupport(window)) return;

    if (state.isPlaying) {
      try {
        window.speechSynthesis.pause();
      } catch {
        setState((prev) => ({ ...prev, hasResolvedSupport: true, isSupported: false, isPlaying: false }));
        return;
      }
      setPlayingState(false, true);
      return;
    }

    if (state.isPaused) {
      try {
        window.speechSynthesis.resume();
      } catch {
        setState((prev) => ({ ...prev, hasResolvedSupport: true, isSupported: false, isPaused: false }));
        return;
      }
      setPlayingState(true, false);
      return;
    }

    if (state.currentArticleId) {
      readById(state.currentArticleId);
      return;
    }

    if (articles[0]) {
      readById(articles[0].id);
    }
  }, [articles, readById, setPlayingState, state.currentArticleId, state.isPaused, state.isPlaying]);

  const stopReading = useCallback(() => {
    if (typeof window === 'undefined' || !hasSpeechSupport(window)) return;
    clearProgressTimer();
    try {
      window.speechSynthesis.cancel();
    } catch {
      setState((prev) => ({ ...prev, hasResolvedSupport: true, isSupported: false }));
    }
    setState((prev) => ({ ...prev, isPlaying: false, isPaused: false, progressPct: 0 }));
  }, [clearProgressTimer]);

  const jumpRelative = useCallback(
    (step: number) => {
      if (!articles.length) return;
      const safeCurrent = currentIndex >= 0 ? currentIndex : 0;
      const nextIndex = (safeCurrent + step + articles.length) % articles.length;
      const next = articles[nextIndex];
      if (next) readById(next.id);
    },
    [articles, currentIndex, readById],
  );

  return {
    ...state,
    readById,
    togglePlayPause,
    stopReading,
    next: () => jumpRelative(1),
    prev: () => jumpRelative(-1),
    setVoice: (voice: SpeechSynthesisVoice | null) => setState((prev) => ({ ...prev, voice })),
    setSpeechRate: (rate: number) => setState((prev) => ({ ...prev, speechRate: rate })),
    toggleAutoplay: () => setState((prev) => ({ ...prev, autoplay: !prev.autoplay })),
  };
}
