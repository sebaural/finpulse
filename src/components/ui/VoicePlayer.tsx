import { useSpeechReader } from '@/hooks/useSpeechReader';
import { NewsArticle } from '@/types';

interface VoicePlayerProps {
  speech: ReturnType<typeof useSpeechReader>;
  filteredArticles: NewsArticle[];
  selectableVoices: SpeechSynthesisVoice[];
  hasHydrated: boolean;
}

export function VoicePlayer({
  speech,
  filteredArticles,
  selectableVoices,
  hasHydrated,
}: VoicePlayerProps) {
  const currentArticle = filteredArticles.find((a) => a.id === speech.currentArticleId);

  return (
    <div className="voice-player">
      <div className="player-label">
        AI Voice Reader
        <div className={`wave-container ${speech.isPlaying ? 'speaking' : ''}`} aria-hidden="true">
          <div className="wave-bar" />
          <div className="wave-bar" />
          <div className="wave-bar" />
          <div className="wave-bar" />
          <div className="wave-bar" />
        </div>
      </div>

      <div className="player-now-reading">
        {currentArticle?.title ?? 'Select a story to read aloud'}
      </div>

      {speech.hasResolvedSupport && !speech.isSupported && (
        <div className="unsupported">
          Text-to-speech is not supported in this browser. Use a modern Chromium-based browser.
        </div>
      )}

      <div className="player-controls">
        <button className="ctrl-btn" onClick={speech.prev} title="Previous">
          Prev
        </button>
        <button className="ctrl-btn play-main" onClick={speech.togglePlayPause} title="Play/Pause">
          {speech.isPlaying ? 'Pause' : 'Play'}
        </button>
        <button className="ctrl-btn" onClick={speech.next} title="Next">
          Next
        </button>
        <button className="ctrl-btn" onClick={speech.stopReading} title="Stop">
          Stop
        </button>
        <select
          className="speed-select"
          value={speech.speechRate}
          onChange={(e) => speech.setSpeechRate(Number(e.target.value))}
        >
          <option value={0.8}>0.8x</option>
          <option value={1}>1x</option>
          <option value={1.2}>1.2x</option>
          <option value={1.5}>1.5x</option>
          <option value={2}>2x</option>
        </select>
        <select
          className="speed-select voice-select"
          value={hasHydrated ? speech.voice?.voiceURI ?? '' : ''}
          onChange={(event) => {
            const selected = selectableVoices.find((voice) => voice.voiceURI === event.target.value) ?? null;
            speech.setVoice(selected);
          }}
          disabled={!hasHydrated || !speech.isSupported || selectableVoices.length === 0}
          suppressHydrationWarning
          title="Voice"
        >
          {!hasHydrated ? (
            <option value="">Loading voices...</option>
          ) : selectableVoices.length === 0 ? (
            <option value="">No English/Russian voices</option>
          ) : (
            selectableVoices.map((voice) => (
              <option key={voice.voiceURI} value={voice.voiceURI}>
                {voice.name} ({voice.lang})
              </option>
            ))
          )}
        </select>
        <button
          className={`ctrl-btn ${speech.autoplay ? 'active' : ''}`}
          onClick={speech.toggleAutoplay}
          title="Auto-play all"
        >
          Auto
        </button>
      </div>

      <div className="progress-bar" aria-label="Playback progress">
        <div className="progress-fill" style={{ width: `${speech.progressPct}%` }} />
      </div>
    </div>
  );
}
