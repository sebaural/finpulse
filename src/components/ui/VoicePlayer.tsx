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

  const statusLabel = speech.isMuted
    ? 'MUTED'
    : speech.isPlaying
    ? 'LIVE'
    : speech.isPaused
    ? 'PAUSED'
    : 'READY';

  const statusClass = speech.isMuted
    ? 'muted'
    : speech.isPlaying
    ? 'live'
    : speech.isPaused
    ? 'paused'
    : 'off';

  const muteRemaining = isClientReady && speech.muteUntil
    ? Math.max(0, Math.ceil((speech.muteUntil - Date.now()) / 60000))
    : 0;

  return (
    <div className="voice-player">
      {/* ── Label + status ── */}
      <div className="player-label">
        <span>AI Voice Reader</span>
        <span className={`vp-status-badge ${statusClass}`}>
          {statusLabel}{speech.isMuted && muteRemaining > 0 ? ` ${muteRemaining}m` : ''}
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
        <button className="ctrl-btn" onClick={speech.replayLast}       title="Replay last"
          disabled={!isClientReady || !speech.lastSpokenId}>↺</button>

        <select
          className="speed-select"
          value={speech.speechRate}
          onChange={(e) => speech.setSpeechRate(Number(e.target.value))}
          aria-label="Speed"
        >
          {[0.8, 1, 1.2, 1.5, 2].map((r) => (
            <option key={r} value={r}>{r}x</option>
          ))}
        </select>

        <select
          className="speed-select voice-select"
          value={speech.hasHydrated ? speech.voice?.voiceURI ?? '' : ''}
          onChange={(e) => {
            const v = speech.selectableVoices.find((x) => x.voiceURI === e.target.value) ?? null;
            speech.setVoice(v);
          }}
          disabled={!speech.hasHydrated || !speech.isSupported || speech.selectableVoices.length === 0}
          suppressHydrationWarning
          aria-label="Voice"
        >
          {!speech.hasHydrated ? (
            <option value="">Loading voices…</option>
          ) : speech.selectableVoices.length === 0 ? (
            <option value="">No voices available</option>
          ) : (
            speech.selectableVoices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>
            ))
          )}
        </select>
      </div>

      {/* ── Toggle row ── */}
      <div className="vp-toggle-row">
        <button
          className={`ctrl-btn${speech.autoplay ? ' active' : ''}`}
          onClick={speech.toggleAutoplay}
          title="Auto-advance queue"
        >
          Auto
        </button>
        <button
          className={`ctrl-btn vp-breaking-btn${speech.breakingOnly ? ' active' : ''}`}
          onClick={speech.toggleBreakingOnly}
          title="Breaking news only"
        >
          ⚡ Breaking
        </button>

        {speech.isMuted ? (
          <button className="ctrl-btn vp-mute-clear" onClick={speech.clearMute} title="Clear mute">
            Unmute
          </button>
        ) : (
          <>
            <button className="ctrl-btn vp-mute-btn" onClick={() => speech.muteFor(5)}  title="Mute 5 min">5m</button>
            <button className="ctrl-btn vp-mute-btn" onClick={() => speech.muteFor(15)} title="Mute 15 min">15m</button>
            <button className="ctrl-btn vp-mute-btn" onClick={() => speech.muteFor(60)} title="Mute 60 min">60m</button>
          </>
        )}
      </div>

      {/* ── Progress bar ── */}
      <div className="progress-bar" aria-label="Playback progress">
        <div className="progress-fill" style={{ width: `${speech.progressPct}%` }} />
      </div>

    </div>
  );
}

