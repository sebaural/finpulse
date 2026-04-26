// ── Module-local NewsArticle ──────────────────────────────────────────────────
// Minimal interface of the fields this module actually consumes.
// Structurally compatible with the host app's full NewsArticle type so the
// consumer can pass its own NewsArticle[] without casting.

export interface NewsArticle {
  id:         string;
  source:     string;
  importance: 1 | 2 | 3;
  title:      string;
  summary:    string;
}

// ── Speech types ──────────────────────────────────────────────────────────────

export type InterruptPolicy = 'always' | 'critical' | 'never';

export type TraderProfile = 'scalper' | 'daytrader' | 'swing' | 'macro';

export type ReadMode = 'headline' | 'summary';

export interface VoiceSettings {
  /** Speech rate: 0.85 – 1.25 */
  rate:              number;
  /** Speech pitch: 0.9 – 1.1 */
  pitch:             number;
  /** Volume: 0.0 – 1.0 */
  volume:            number;
  /** Pause between auto-advanced articles, in seconds */
  gap:               number;
  /** SpeechSynthesisVoice.name of the selected voice */
  selectedVoiceName: string;
}

export interface SpeechRules {
  /** Skip importance=3 articles from the auto-play queue */
  skipLow:   boolean;
  /** Skip articles already spoken in this session */
  dedup:     boolean;
  /** Play a short beep before importance=1 (breaking) headlines */
  tone:      boolean;
  /** Allow interrupting current speech for importance=1 articles */
  interrupt: boolean;
}
