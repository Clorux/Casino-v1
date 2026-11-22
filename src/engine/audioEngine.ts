/**
 * Zero-asset procedural Web Audio synthesizer for 100% offline casino sound design.
 * Supports pitch-shifted combo chimes, heartbeat tension sweeps, reel clicks,
 * Plinko marimba pegs, coin showers, and tiered Big/Super/Mega Win fanfares.
 */

class CasinoAudioEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private volume = 0.55;

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  setVolume(v: number) {
    this.volume = Math.min(1, Math.max(0, v));
  }

  getVolume(): number {
    return this.volume;
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    gainScale = 0.25,
    slideToFreq?: number,
    delay = 0
  ) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideToFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideToFreq), now + duration);
    }

    const peak = Math.max(0.001, this.volume * gainScale);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playClick() {
    this.playTone(620, 0.045, 'triangle', 0.14, 340);
  }

  playChipPlace() {
    this.playTone(1180, 0.05, 'sine', 0.16, 1520);
    this.playTone(1760, 0.04, 'triangle', 0.08, 1320, 0.02);
  }

  playReelTick(pitchOffset = 0) {
    this.playTone(220 + pitchOffset * 18, 0.035, 'square', 0.06, 140);
  }

  playReelStop(reelIndex: number, isScatter = false) {
    if (isScatter) {
      const base = 523.25 * Math.pow(2, (reelIndex * 2) / 12);
      this.playTone(base, 0.24, 'triangle', 0.28, base * 1.06);
      this.playTone(base * 1.5, 0.28, 'sine', 0.18, undefined, 0.03);
      return;
    }
    this.playTone(135 + reelIndex * 12, 0.09, 'triangle', 0.24, 65);
  }

  /**
   * Anticipation tease: rising filtered tension chord + heartbeat sub-thump.
   */
  playAnticipationTease() {
    this.playTone(58, 0.22, 'sine', 0.36, 42, 0);
    this.playTone(58, 0.22, 'sine', 0.36, 42, 0.26);
    this.playTone(260, 0.72, 'sawtooth', 0.11, 560, 0.04);
    this.playTone(390, 0.72, 'triangle', 0.09, 780, 0.04);
  }

  /**
   * Pitch-shifted ascending chime for cascading wins, consecutive mines gems, or combo streaks.
   */
  playComboChime(stepIndex: number) {
    const semitones = Math.min(18, stepIndex * 2);
    const freq = 440 * Math.pow(2, semitones / 12);
    this.playTone(freq, 0.19, 'triangle', 0.24);
    this.playTone(freq * 1.25, 0.22, 'sine', 0.16, undefined, 0.055);
  }

  playPlinkoPeg(row: number, totalRows: number) {
    const ratio = row / Math.max(1, totalRows);
    const freq = 340 + ratio * 540 + (Math.random() - 0.5) * 28;
    this.playTone(freq, 0.055, 'sine', 0.14);
  }

  playWheelTick(speedRatio = 1) {
    const freq = 480 + speedRatio * 340;
    this.playTone(freq, 0.03, 'triangle', 0.15, 220);
  }

  playCrashRise(multiplier: number) {
    const clamped = Math.min(20, Math.max(1, multiplier));
    const freq = 220 + Math.log2(clamped) * 145;
    this.playTone(freq, 0.08, 'sine', 0.08);
  }

  playBust() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    // Low thud + short noise burst
    this.playTone(110, 0.35, 'sawtooth', 0.26, 36);
    const bufferSize = Math.floor(ctx.sampleRate * 0.22);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 650;
    const gain = ctx.createGain();
    gain.gain.value = this.volume * 0.22;
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start();
  }

  playCardDeal() {
    this.playTone(720, 0.04, 'triangle', 0.12, 320);
  }

  playCoinTick() {
    this.playTone(1380 + Math.random() * 260, 0.04, 'sine', 0.09);
  }

  playWinFanfare(tier: 'WIN' | 'BIG' | 'SUPER' | 'MEGA') {
    const notes =
      tier === 'MEGA'
        ? [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98]
        : tier === 'SUPER'
        ? [523.25, 659.25, 783.99, 1046.5, 1318.5]
        : tier === 'BIG'
        ? [440, 554.37, 659.25, 880]
        : [523.25, 659.25, 783.99];

    notes.forEach((n, idx) => {
      this.playTone(n, 0.28 + idx * 0.03, 'triangle', 0.24, undefined, idx * 0.075);
      if (tier === 'SUPER' || tier === 'MEGA') {
        this.playTone(n * 0.5, 0.34, 'sine', 0.14, undefined, idx * 0.075);
      }
    });
  }
}

export const audioEngine = new CasinoAudioEngine();
