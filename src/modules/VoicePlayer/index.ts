/**
 * VoicePlayer module — public API
 *
 * Usage (host page):
 *
 *   import dynamic from 'next/dynamic';
 *   import { useSpeechReader } from '@/modules/VoicePlayer';
 *
 *   const VoicePlayer = dynamic(
 *     () => import('@/modules/VoicePlayer').then(m => ({ default: m.VoicePlayer })),
 *     { ssr: false },
 *   );
 *
 *   // In your component:
 *   const speech = useSpeechReader(articles);
 *   return <VoicePlayer speech={speech} />;
 *
 * The module's NewsArticle interface requires only:
 *   { id, source, importance (1|2|3), title, summary }
 * — a structural subset of most article types.
 */

// ── Primary component ─────────────────────────────────────────────────────────
export { VoicePlayer } from './components/VoicePlayer';

// ── Primary hook ──────────────────────────────────────────────────────────────
export { useSpeechReader } from './hooks/useSpeechReader';

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  NewsArticle,
  InterruptPolicy,
  TraderProfile,
  ReadMode,
  VoiceSettings,
  SpeechRules,
} from './types';
