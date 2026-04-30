import { VoiceSettingsModal } from './VoiceSettingsModal';
import { useSpeechReader } from '../hooks/useSpeechReader';
import type { ReadMode } from '../types';
import styles from '../VoicePlayer.module.css';

interface VoicePlayerProps {
  speech: ReturnType<typeof useSpeechReader>;
}

const MODE_LABELS: Record<ReadMode, string> = {
  headline: 'Headline',
  summary:  'Summary',
};

export function VoicePlayer({ speech }: VoicePlayerProps) {
  const isClientReady = speech.hasHydrated;

  const statusLabel = speech.isPlaying
    ? 'LIVE'
    : speech.isPaused
    ? 'PAUSED'
    : 'READY';

  const statusMod = speech.isPlaying
    ? styles.live
    : speech.isPaused
    ? styles.paused
    : styles.off;

  return (
    <>
      <div className={styles.voicePlayer}>

        {/* ── Label + status + wave + settings gear ── */}
        <div className={styles.playerLabel}>
          <span>Voice Reader</span>
          <span className={`${styles.vpStatusBadge} ${statusMod}`}>
            {statusLabel}
          </span>
          <div className={`${styles.waveContainer}${speech.isPlaying ? ` ${styles.speaking}` : ''}`} aria-hidden="true">
            <div className={styles.waveBar} />
            <div className={styles.waveBar} />
            <div className={styles.waveBar} />
            <div className={styles.waveBar} />
            <div className={styles.waveBar} />
          </div>
          <button
            className={`${styles.ctrlBtn} ${styles.vpSettingsBtn}`}
            onClick={speech.openSettings}
            title="Voice settings"
            aria-label="Open voice settings"
          >
            ⚙
          </button>
        </div>

        {/* ── Unsupported warning ── */}
        {speech.hasResolvedSupport && !speech.isSupported && (
          <div className={styles.unsupported}>
            Text-to-speech is not supported in this browser.
          </div>
        )}

        {/* ── Now reading ── */}
        {isClientReady && speech.currentArticleId && (
          <div className={styles.vpNowReading}>
            <span className={styles.vpNowLabel}>Now:</span>
            <span className={styles.vpNowTitle} title={speech.currentArticleTitle ?? undefined}>
              {speech.currentArticleTitle ?? '—'}
            </span>
          </div>
        )}

        {/* ── Up next ── */}
        {isClientReady && speech.nextArticle && (
          <div className={styles.vpNext}>
            <span className={styles.vpNowLabel}>Next:</span>
            <span className={styles.vpNextTitle} title={speech.nextArticle.title}>
              {speech.nextArticle.title}
            </span>
          </div>
        )}

        {/* ── Filter-mismatch notice ── */}
        {isClientReady && speech.statusMessage && (
          <div className={styles.vpStatusMsg} role="status" aria-live="polite">
            {speech.statusMessage}
          </div>
        )}

        {/* ── Controls wrapper (mode tabs + transport controls) ── */}
        <div className={styles.controlsWrapper}>


{/* ── Transport controls ── */}
        <div className={styles.playerControls}>
          <button className={styles.ctrlBtn} onClick={speech.prev}            title="Previous">◄</button>
          <button className={`${styles.ctrlBtn} ${styles.playMain}`}          onClick={speech.togglePlayPause} title="Play / Pause">
            {speech.isPlaying ? '❙❙' : '▶'}
          </button>
          <button className={styles.ctrlBtn} onClick={speech.next}            title="Next">►</button>
          <button className={styles.ctrlBtn} onClick={speech.stopReading}     title="Stop">■</button>
        </div>

        {/* ── Mode tabs ── */}
        <div className={styles.vpModeTabs} role="group" aria-label="Reading mode">
          {(['headline', 'summary'] as ReadMode[]).map(m => (
            <button
              key={m}
              className={`${styles.vpModeTab}${speech.mode === m ? ` ${styles.active}` : ''}`}
              onClick={() => speech.setMode(m)}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>

        </div>

        {/* ── Progress bar ── */}
        <div className={styles.progressBar} aria-label="Playback progress">
          <div className={styles.progressFill} style={{ width: `${speech.progressPct}%` }} />
        </div>

      </div>

      {/* ── Settings modal (portalled outside player box) ── */}
      <VoiceSettingsModal
        isOpen={speech.isSettingsOpen}
        onClose={speech.closeSettings}
        mode={speech.mode}
        setMode={speech.setMode}
        voiceSettings={speech.voiceSettings}
        setVoiceSettings={speech.setVoiceSettings}
        voices={speech.voices}
        rules={speech.rules}
        setRules={speech.setRules}
        interruptPolicy={speech.interruptPolicy}
        setInterruptPolicy={speech.setInterruptPolicy}
        setProfile={speech.setProfile}
      />
    </>
  );
}
