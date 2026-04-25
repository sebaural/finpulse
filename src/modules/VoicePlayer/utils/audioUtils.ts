// ── Singleton AudioContext ─────────────────────────────────────────────────────
// Browsers require a user gesture before AudioContext can run.
// One shared instance is kept and resume()d after the first interaction.

let _ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (_ctx) return _ctx;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  _ctx = new Ctor();
  return _ctx;
}

/**
 * Call this from any user-gesture handler (click / keydown / touchstart).
 * It resumes the shared AudioContext so subsequent playBeep() calls work.
 */
export function unlockAudio(): void {
  try {
    const ctx = getCtx();
    if (ctx && ctx.state === 'suspended') void ctx.resume();
  } catch { /* ignore */ }
}

/**
 * Plays a short alert beep using the Web Audio API.
 * Silently no-ops if AudioContext is unavailable or still blocked.
 */
export function playBeep(freq = 880, dur = 0.12, vol = 0.3): void {
  if (typeof window === 'undefined') return;
  try {
    const ctx = getCtx();
    if (!ctx) return;

    const doPlay = () => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    };

    if (ctx.state === 'suspended') {
      void ctx.resume().then(doPlay);
    } else {
      doPlay();
    }
  } catch {
    // AudioContext blocked or unavailable — ignore
  }
}
