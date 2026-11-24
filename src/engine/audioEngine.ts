/**
 * Studio-Grade Procedural Web Audio DSP & Spatial SFX Synthesizer (100% Offline)
 *
 * Researched AAA Casino Sound Design Architecture:
 * - Master DynamicsCompressorNode + Master Gain bus to glue dense layers without clipping.
 * - Procedural Stereo Coin Shower using inharmonic metallic bell ratios (1.0x / 1.42x / 2.76x),
 *   resonant bandpass filtering (Q=5.5), and StereoPannerNode spatial dispersion.
 * - Filtered Harmonic Anticipation Riser (sawtooth + triangle sweep opening a lowpass filter
 *   from 300Hz -> 5200Hz modulated by an accelerating 4Hz -> 24Hz tremolo LFO).
 * - Mechanical Vault Lock Tumbler & Seismic Vault Crack impact SFX.
 * - Tactile filtered white-noise paper snap layered onto card deals.
 */

class CasinoAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private muted = false;
  private volume = 0.62;

  private ensureContext(): { ctx: AudioContext; bus: AudioNode } | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();

      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-16, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(18, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(6, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.004, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.18, this.ctx.currentTime);

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);

      this.compressor.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return { ctx: this.ctx, bus: this.compressor ?? this.ctx.destination };
  }

  setMuted(muted: boolean) {
    this.muted = muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  setVolume(v: number) {
    this.volume = Math.min(1, Math.max(0, v));
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.02);
    }
  }

  getVolume(): number {
    return this.volume;
  }

  private connectWithPan(
    ctx: AudioContext,
    node: AudioNode,
    bus: AudioNode,
    pan = 0
  ) {
    if (typeof ctx.createStereoPanner === 'function' && Math.abs(pan) > 0.01) {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), ctx.currentTime);
      node.connect(panner);
      panner.connect(bus);
    } else {
      node.connect(bus);
    }
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    gainScale = 0.25,
    slideToFreq?: number,
    delay = 0,
    pan = 0
  ) {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, bus } = audio;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideToFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideToFreq), now + duration);
    }

    const peak = Math.max(0.001, gainScale);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    this.connectWithPan(ctx, gain, bus, pan);
    osc.start(now);
    osc.stop(now + duration + 0.03);
  }

  private playNoiseBurst(
    duration: number,
    filterType: BiquadFilterType,
    filterFreq: number,
    gainScale: number,
    delay = 0,
    pan = 0
  ) {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, bus } = audio;

    const now = ctx.currentTime + delay;
    const sampleCount = Math.max(64, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / sampleCount, 1.4);
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFreq, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(Math.max(0.0001, gainScale), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    src.connect(filter);
    filter.connect(gain);
    this.connectWithPan(ctx, gain, bus, pan);
    src.start(now);
  }

  playClick() {
    this.playTone(640, 0.045, 'triangle', 0.16, 340);
  }

  playChipPlace() {
    // Ceramic casino chip clack + high harmonic ping
    this.playNoiseBurst(0.025, 'highpass', 2400, 0.14);
    this.playTone(1240, 0.055, 'sine', 0.18, 1580);
    this.playTone(1860, 0.045, 'triangle', 0.1, 1360, 0.018);
  }

  playReelTick(pitchOffset = 0) {
    this.playTone(230 + pitchOffset * 18, 0.035, 'square', 0.07, 140);
  }

  playReelStop(reelIndex: number, isScatter = false) {
    const pan = (reelIndex - 2) * 0.35; // stereo spread across the 5 reels
    if (isScatter) {
      const base = 523.25 * Math.pow(2, (reelIndex * 2) / 12);
      this.playTone(base, 0.28, 'triangle', 0.32, base * 1.06, 0, pan);
      this.playTone(base * 1.5, 0.32, 'sine', 0.2, undefined, 0.03, pan);
      this.playTone(base * 2.0, 0.22, 'sine', 0.12, undefined, 0.06, pan);
      return;
    }
    this.playTone(140 + reelIndex * 12, 0.095, 'triangle', 0.28, 62, 0, pan);
    this.playNoiseBurst(0.03, 'lowpass', 720, 0.12, 0, pan);
  }

  /**
   * Filtered Harmonic Anticipation Riser with accelerating tremolo LFO + double heartbeat sub-thump.
   */
  playHarmonicRiser(duration = 0.95) {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, bus } = audio;
    const now = ctx.currentTime;

    // Double sub-bass heartbeat
    this.playTone(62, 0.22, 'sine', 0.44, 40, 0);
    this.playTone(66, 0.22, 'sine', 0.48, 42, Math.min(0.28, duration * 0.35));

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.008, now);
    gain.gain.exponentialRampToValueAtTime(0.26, now + duration * 0.82);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(175, now);
    osc.frequency.exponentialRampToValueAtTime(980, now + duration);

    const harmonic = ctx.createOscillator();
    harmonic.type = 'triangle';
    harmonic.frequency.setValueAtTime(262, now);
    harmonic.frequency.exponentialRampToValueAtTime(1470, now + duration);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.setValueAtTime(3.2, now);
    filter.frequency.setValueAtTime(320, now);
    filter.frequency.exponentialRampToValueAtTime(4800, now + duration);

    // Accelerating tremolo LFO
    const lfo = ctx.createOscillator();
    lfo.frequency.setValueAtTime(4.5, now);
    lfo.frequency.linearRampToValueAtTime(22, now + duration);
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(0.09, now);

    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);

    osc.connect(filter);
    harmonic.connect(filter);
    filter.connect(gain);
    gain.connect(bus);

    osc.start(now);
    harmonic.start(now);
    lfo.start(now);
    osc.stop(now + duration + 0.03);
    harmonic.stop(now + duration + 0.03);
    lfo.stop(now + duration + 0.03);
  }

  /**
   * Backward-compatible alias used by Slots & Keno anticipation frames.
   */
  playAnticipationTease() {
    this.playHarmonicRiser(0.85);
  }

  /**
   * Procedural Stereo Metallic Coin Shower (inharmonic bell ratios + bandpass filter + stereo pan).
   */
  playCoinShower(coinCount = 16) {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, bus } = audio;
    const baseTime = ctx.currentTime;

    const count = Math.max(3, Math.min(36, coinCount));
    for (let i = 0; i < count; i++) {
      const time = baseTime + i * 0.055 + Math.random() * 0.035;
      const baseFreq = 2150 + Math.random() * 1450;
      const pan = (Math.random() * 2 - 1) * 0.85;

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc1.type = 'square';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(baseFreq, time);
      osc2.frequency.setValueAtTime(baseFreq * 1.42, time); // metallic inharmonic bell ratio

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(baseFreq * 1.15, time);
      filter.Q.setValueAtTime(5.5, time);

      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.linearRampToValueAtTime(0.16, time + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.14);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      this.connectWithPan(ctx, gain, bus, pan);

      osc1.start(time);
      osc2.start(time);
      osc1.stop(time + 0.16);
      osc2.stop(time + 0.16);
    }
  }

  /**
   * Heavy brass vault tumbler lock slam for Sovereign Hold & Win orbs.
   */
  playVaultTumbler(stepIndex = 0) {
    const pan = ((stepIndex % 5) - 2) * 0.35;
    const semitones = Math.min(18, stepIndex * 2);
    const shimmer = 523.25 * Math.pow(2, semitones / 12);
    // Mechanical bolt thud + metallic brass ring
    this.playTone(115, 0.11, 'triangle', 0.38, 48, 0, pan);
    this.playNoiseBurst(0.032, 'bandpass', 1850, 0.18, 0, pan);
    this.playTone(shimmer, 0.24, 'sine', 0.22, shimmer * 1.03, 0.02, pan);
    this.playTone(shimmer * 1.5, 0.22, 'triangle', 0.12, undefined, 0.04, pan);
  }

  /**
   * Collector Energy Surge — shimmering ascending chord when Emerald Collector absorbs the board.
   */
  playCollectorSurge() {
    const notes = [392, 493.88, 587.33, 783.99, 1174.66];
    notes.forEach((f, idx) => {
      const pan = -0.6 + idx * 0.3;
      this.playTone(f, 0.32, 'triangle', 0.24, f * 1.08, idx * 0.045, pan);
      this.playTone(f * 2, 0.26, 'sine', 0.11, undefined, idx * 0.045 + 0.02, pan);
    });
    this.playCoinShower(10);
  }

  /**
   * Pitch-shifted ascending chime for cascading wins, consecutive mines gems, or combo streaks.
   */
  playComboChime(stepIndex: number) {
    const semitones = Math.min(18, stepIndex * 2);
    const freq = 440 * Math.pow(2, semitones / 12);
    const pan = ((stepIndex % 5) - 2) * 0.25;
    this.playTone(freq, 0.2, 'triangle', 0.26, undefined, 0, pan);
    this.playTone(freq * 1.25, 0.24, 'sine', 0.18, undefined, 0.05, pan);
  }

  playPlinkoPeg(row: number, totalRows: number) {
    const ratio = row / Math.max(1, totalRows);
    const freq = 340 + ratio * 540 + (Math.random() - 0.5) * 28;
    const pan = (Math.random() - 0.5) * 0.65;
    this.playTone(freq, 0.055, 'sine', 0.16, undefined, 0, pan);
  }

  playWheelTick(speedRatio = 1) {
    const freq = 480 + speedRatio * 340;
    this.playTone(freq, 0.032, 'triangle', 0.17, 220);
  }

  playCrashRise(multiplier: number) {
    const clamped = Math.min(20, Math.max(1, multiplier));
    const freq = 220 + Math.log2(clamped) * 145;
    this.playTone(freq, 0.08, 'sine', 0.09);
  }

  playBust() {
    this.playTone(112, 0.36, 'sawtooth', 0.3, 34);
    this.playNoiseBurst(0.24, 'lowpass', 620, 0.26);
  }

  playCardDeal() {
    // Crisp paper flick transient + tonal snap
    this.playNoiseBurst(0.022, 'highpass', 3200, 0.14);
    this.playTone(740, 0.04, 'triangle', 0.12, 310);
  }

  playCoinTick() {
    const pan = (Math.random() - 0.5) * 0.7;
    this.playTone(1480 + Math.random() * 420, 0.045, 'sine', 0.1, undefined, 0, pan);
  }

  playWinFanfare(tier: 'WIN' | 'BIG' | 'SUPER' | 'MEGA' | 'JACKPOT') {
    if (tier === 'JACKPOT') {
      // Seismic sub-bass impact drop + stereo royal brass fanfare + 24-coin metallic shower
      this.playTone(96, 0.62, 'sine', 0.5, 32, 0);
      this.playNoiseBurst(0.16, 'lowpass', 900, 0.22, 0);
      const fanfare = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98, 2093.0];
      fanfare.forEach((n, idx) => {
        const pan = -0.6 + (idx / (fanfare.length - 1)) * 1.2;
        this.playTone(n, 0.45 + idx * 0.04, 'triangle', 0.3, undefined, idx * 0.068, pan);
        this.playTone(n * 0.5, 0.5, 'sawtooth', 0.11, undefined, idx * 0.068, -pan * 0.5);
      });
      this.playCoinShower(24);
      return;
    }

    const notes =
      tier === 'MEGA'
        ? [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98]
        : tier === 'SUPER'
        ? [523.25, 659.25, 783.99, 1046.5, 1318.5]
        : tier === 'BIG'
        ? [440, 554.37, 659.25, 880]
        : [523.25, 659.25, 783.99];

    notes.forEach((n, idx) => {
      const pan = -0.45 + (idx / Math.max(1, notes.length - 1)) * 0.9;
      this.playTone(n, 0.3 + idx * 0.03, 'triangle', 0.26, undefined, idx * 0.072, pan);
      if (tier === 'SUPER' || tier === 'MEGA') {
        this.playTone(n * 0.5, 0.36, 'sine', 0.16, undefined, idx * 0.072, -pan * 0.4);
      }
    });

    if (tier === 'MEGA') {
      this.playTone(86, 0.42, 'sine', 0.38, 38, 0);
      this.playCoinShower(18);
    } else if (tier === 'SUPER') {
      this.playCoinShower(12);
    } else if (tier === 'BIG') {
      this.playCoinShower(7);
    }
  }

  /**
   * Dark metallic radar sonar ping + tense minor-second brass drone when House Mind locks onto a pattern.
   */
  playPredatorLock() {
    this.playTone(98, 0.55, 'sawtooth', 0.24, 65, 0, -0.35);
    this.playTone(103.83, 0.55, 'sawtooth', 0.22, 69, 0.04, 0.35); // tense minor-second dissonance
    this.playTone(1320, 0.22, 'sine', 0.18, 1280, 0.02, 0);
    this.playNoiseBurst(0.08, 'bandpass', 1400, 0.15, 0.04);
  }

  /**
   * Crisp heavy safe-door mechanical vault latch + triumphant major-9th chord when player Cashes Out.
   */
  playCashOutVault() {
    // Heavy double vault bolt click
    this.playTone(145, 0.09, 'triangle', 0.36, 58, 0, -0.2);
    this.playNoiseBurst(0.035, 'bandpass', 2100, 0.2, 0, -0.2);
    this.playTone(190, 0.11, 'triangle', 0.34, 72, 0.11, 0.2);
    this.playNoiseBurst(0.035, 'bandpass', 2400, 0.18, 0.11, 0.2);
    // Warm major-9th escape chime
    const notes = [392.0, 493.88, 587.33, 739.99, 880.0];
    notes.forEach((f, idx) => {
      const pan = -0.5 + idx * 0.25;
      this.playTone(f, 0.38, 'triangle', 0.22, undefined, 0.2 + idx * 0.06, pan);
    });
    this.playCoinShower(12);
  }

  /**
   * Agonizing descending dissonant near-miss sting (just 1 symbol/tile/pocket shy).
   */
  playNearMissSting() {
    this.playTone(587.33, 0.28, 'triangle', 0.22, 520, 0, -0.25);
    this.playTone(554.37, 0.32, 'sine', 0.18, 466, 0.05, 0.25);
    this.playNoiseBurst(0.11, 'lowpass', 950, 0.14, 0.02);
  }

  /**
   * Seductive warm shimmer chord when House Mind releases an Anti-Quit Lifeline tease.
   */
  playLifelinePulse() {
    const notes = [349.23, 440.0, 523.25, 659.25];
    notes.forEach((f, idx) => {
      this.playTone(f, 0.45, 'sine', 0.2, f * 1.015, idx * 0.07, -0.45 + idx * 0.3);
    });
  }

  /**
   * Metallic embossed brass coin flick + harmonic air-spin whistle for Obsidian Coin Flip.
   */
  playCoinFlipSpin() {
    this.playNoiseBurst(0.03, 'highpass', 3600, 0.16);
    this.playTone(2480, 0.22, 'sine', 0.2, 3120, 0, -0.2);
    this.playTone(3540, 0.18, 'triangle', 0.14, 2920, 0.05, 0.2);
    this.playTone(2860, 0.16, 'sine', 0.12, 3380, 0.14, -0.1);
  }

  /**
   * Crisp ivory-lock toggle click when locking/unlocking HOLD cards in Royal Video Poker.
   */
  playPokerHold(held: boolean) {
    if (held) {
      this.playTone(880, 0.065, 'triangle', 0.2, 1180);
      this.playNoiseBurst(0.018, 'bandpass', 2600, 0.1);
    } else {
      this.playTone(540, 0.055, 'triangle', 0.14, 380);
    }
  }

  /**
   * Majestic ascending harp-brass flourish when landing Flush / Full House / Royal Flush in Video Poker.
   */
  playRoyalHandFanfare(isTopTier = false) {
    const chord = isTopTier
      ? [523.25, 659.25, 783.99, 987.77, 1318.5, 1567.98, 2093.0]
      : [440.0, 554.37, 659.25, 880.0, 1108.73];
    chord.forEach((f, idx) => {
      const pan = -0.55 + (idx / Math.max(1, chord.length - 1)) * 1.1;
      this.playTone(f, 0.36, 'triangle', 0.24, undefined, idx * 0.055, pan);
      this.playTone(f * 1.5, 0.24, 'sine', 0.1, undefined, idx * 0.055 + 0.02, -pan * 0.4);
    });
    this.playCoinShower(isTopTier ? 20 : 10);
  }
}

export const audioEngine = new CasinoAudioEngine();
