import { useSpeechReader } from '@/hooks/useSpeechReader';
import type { ReadMode } from '@/hooks/useSpeechReader';

interface VoicePlayerProps {
  speech: ReturnType<typeof useSpeechReader>;
}

const MODE_LABELS: Record<ReadMode, string> = {
  headline: 'Headline',
  summary:  'Summary',
  full:     'Full',
};

export function VoicePlayer({ speech }: VoicePlayerProps) {
  const isClientReady = speech.hasHydrated;

  const statusLabel = speech.isPlaying
    ? 'LIVE'
    : speech.isPaused
    ? 'PAUSED'
    : 'READY';

  const statusClass = speech.isPlaying
    ? 'live'
    : speech.isPaused
    ? 'paused'
    : 'off';

  return (
    <div className="voice-player">
      {/* ── Label + status ── */}
      <div className="player-label">
        <span>AI Voice Reader</span>
        <span className={`vp-status-badge ${statusClass}`}>
          {statusLabel}
        </span>
        <div className={`wave-container ${speech.isPlaying ? 'speaking' : ''}`} aria-hidden="true">
          <div className="wave-bar" /><div className="wave-bar" />
          <div className="wave-bar" /><div className="wave-bar" />
          <div className="wave-bar" />
        </div>
      </div>

      {/* ── Unsupported warning ── */}
      {speech.hasResolvedSupport && !speech.isSupported && (
        <div className="unsupported">
          Text-to-speech is not supported in this browser.
        </div>
      )}

      {/* ── Now reading / up next ── */}
      {isClientReady && speech.currentArticleId && (
        <div className="vp-now-reading">
          <span className="vp-now-label">Now:</span>
          <span className="vp-now-title" title={speech.currentArticleTitle ?? undefined}>
            {speech.currentArticleTitle ?? '—'}
          </span>
        </div>
      )}
      {isClientReady && speech.nextArticle && (
        <div className="vp-next">
          <span className="vp-now-label">Next:</span>
          <span className="vp-next-title" title={speech.nextArticle.title}>
            {speech.nextArticle.title}
          </span>
        </div>
      )}

      {/* ── Mode tabs ── */}
      <div className="vp-mode-tabs" role="group" aria-label="Reading mode">
        {(['headline', 'summary', 'full'] as ReadMode[]).map((m) => (
          <button
            key={m}
            className={`vp-mode-tab${speech.mode === m ? ' active' : ''}`}
            onClick={() => speech.setMode(m)}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      {/* ── Transport controls ── */}
      <div className="player-controls">
        <button className="ctrl-btn" onClick={speech.prev}             title="Previous">◄</button>
        <button className="ctrl-btn play-main" onClick={speech.togglePlayPause} title="Play / Pause">
          {speech.isPlaying ? '❙❙' : '▶'}
        </button>
        <button className="ctrl-btn" onClick={speech.next}             title="Next">►</button>
        <button className="ctrl-btn" onClick={speech.stopReading}      title="Stop">■</button>
        <button
          className={`ctrl-btn${speech.autoplay ? ' active' : ''}`}
          onClick={speech.toggleAutoplay}
          title="Auto-advance queue"
        >
          Auto
        </button>
      </div>

      {/* ── Progress bar ── */}
      <div className="progress-bar" aria-label="Playback progress">
        <div className="progress-fill" style={{ width: `${speech.progressPct}%` }} />
      </div>

    </div>
  );
}

