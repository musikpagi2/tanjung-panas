// All sound is synthesised with WebAudio — no audio files. Engine hum follows
// speed, sirens wail when police are near, thuds mark collisions, chimes mark
// pickups, and a quiet chord-pad loop plays underneath.

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineOsc2 = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenOn = false;
    this.musicTimer = null;
    this.muted = false;
  }

  // Must be called from a user gesture (Enter / click).
  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);

    // Engine: two detuned saws through a lowpass.
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineOsc2 = this.ctx.createOscillator();
    this.engineOsc2.type = 'square';
    this.engineOsc2.frequency.value = 28;
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 420;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
    this.engineOsc2.start();

    // Siren: a sine that alternates 700 / 950 Hz.
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'sine';
    this.sirenOsc.frequency.value = 800;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
    this._sirenStep = 0;

    this._startMusic();
  }

  setEngine(speedNorm, driving) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const target = driving ? 0.05 + 0.10 * speedNorm : 0.0;
    this.engineGain.gain.setTargetAtTime(target, t, 0.08);
    const f = 55 + speedNorm * 165;
    this.engineOsc.frequency.setTargetAtTime(f, t, 0.1);
    this.engineOsc2.frequency.setTargetAtTime(f * 0.5, t, 0.1);
    this.engineFilter.frequency.setTargetAtTime(380 + speedNorm * 900, t, 0.1);
  }

  setSiren(on) {
    if (!this.ctx) return;
    this.sirenOn = on;
    this.sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, this.ctx.currentTime, 0.2);
  }

  // Called every frame: flips the siren tone twice a second.
  update(dt) {
    if (!this.ctx || !this.sirenOn) return;
    this._sirenStep += dt;
    if (this._sirenStep > 0.5) {
      this._sirenStep = 0;
      const hi = this.sirenOsc.frequency.value < 850;
      this.sirenOsc.frequency.setTargetAtTime(hi ? 950 : 700, this.ctx.currentTime, 0.05);
    }
  }

  thud(strength = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const dur = 0.16;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 300;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.5 * strength, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filt); filt.connect(g); g.connect(this.master);
    src.start(t);
  }

  chime() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [880, 1174.7, 1568].forEach((f, i) => {
      const o = this.ctx.createOscillator();
      o.type = 'sine'; o.frequency.value = f;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + i * 0.07);
      g.gain.exponentialRampToValueAtTime(0.16, t + i * 0.07 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.07 + 0.5);
      o.connect(g); g.connect(this.master);
      o.start(t + i * 0.07); o.stop(t + i * 0.07 + 0.55);
    });
  }

  honk() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'square'; o.frequency.value = 370;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.08, t);
    g.gain.setValueAtTime(0.08, t + 0.18);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.26);
  }

  // Slow sunset pad: Am – F – C – G, one chord every 4 seconds, very quiet.
  _startMusic() {
    const chords = [[220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7], [164.8, 196, 246.9]];
    let i = 0;
    const playChord = () => {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime + 0.05;
      for (const f of chords[i % chords.length]) {
        const o = this.ctx.createOscillator();
        o.type = 'triangle'; o.frequency.value = f;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.028, t + 1.2);
        g.gain.setValueAtTime(0.028, t + 3.0);
        g.gain.linearRampToValueAtTime(0.0001, t + 4.2);
        o.connect(g); g.connect(this.master);
        o.start(t); o.stop(t + 4.3);
      }
      i++;
    };
    playChord();
    this.musicTimer = setInterval(playChord, 4000);
  }
}
