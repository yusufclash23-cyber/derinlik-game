/**
 * Procedural audio (Web Audio API). No external assets => no licensing issues.
 * Ambience, mining, crystal resonance, water drips, creature sounds, footsteps,
 * discovery fanfare, boss music and extraction cues, with separate music/SFX volume.
 */
type Wave = OscillatorType;

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicG!: GainNode;
  private sfxG!: GainNode;
  private ambG!: GainNode;
  private bossG!: GainNode;
  private echo!: DelayNode;
  private noiseBuf!: AudioBuffer;
  private timers: ReturnType<typeof setInterval>[] = [];
  private nodes: (OscillatorNode | AudioBufferSourceNode)[] = [];
  private biome = 0;
  private musicVol = 0.6;
  private sfxVol = 0.8;

  init() {
    if (this.ctx || typeof window === "undefined") return;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(ctx.destination);
    this.musicG = ctx.createGain(); this.musicG.connect(this.master);
    this.sfxG = ctx.createGain(); this.sfxG.connect(this.master);
    this.ambG = ctx.createGain(); this.ambG.gain.value = 0; this.ambG.connect(this.musicG);
    this.bossG = ctx.createGain(); this.bossG.gain.value = 0; this.bossG.connect(this.musicG);
    // cave echo (cheap reverb-like feedback delay)
    this.echo = ctx.createDelay(1); this.echo.delayTime.value = 0.23;
    const fb = ctx.createGain(); fb.gain.value = 0.38;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1800;
    this.echo.connect(lp); lp.connect(fb); fb.connect(this.echo); lp.connect(this.sfxG);
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolumes();
  }
  resume() { this.init(); if (this.ctx?.state === "suspended") void this.ctx.resume(); }
  setVolumes(music: number, sfx: number) { this.musicVol = music; this.sfxVol = sfx; this.applyVolumes(); }
  private applyVolumes() {
    if (!this.ctx) return;
    this.musicG.gain.value = this.musicVol;
    this.sfxG.gain.value = this.sfxVol;
  }

  private tone(f: number, dur: number, type: Wave = "sine", vol = 0.2, slide?: number, delay = 0, echo = false) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.sfxG); if (echo) g.connect(this.echo);
    o.start(t); o.stop(t + dur + 0.05);
  }
  private noise(dur: number, freq: number, vol = 0.2, type: BiquadFilterType = "bandpass", sweep?: number, delay = 0) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfxG);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  play(name: string, rarity = 0) {
    if (!this.ctx) return;
    switch (name) {
      case "mine": this.noise(0.09, 900 + Math.random() * 500, 0.35); this.tone(180 + Math.random() * 60, 0.08, "square", 0.12, 90); break;
      case "crystal": this.tone(1320, 0.7, "sine", 0.12, undefined, 0, true); this.tone(1760 + rarity * 120, 0.9, "sine", 0.08, undefined, 0.05, true); break;
      case "break": this.noise(0.35, 500, 0.5, "lowpass", 120); this.tone(110, 0.3, "triangle", 0.25, 50); break;
      case "pickup": this.tone(660, 0.12, "triangle", 0.2, 990); this.tone(990, 0.15, "triangle", 0.15, 1320, 0.08); break;
      case "hit": this.noise(0.12, 600, 0.4); this.tone(160, 0.12, "sawtooth", 0.2, 80); break;
      case "hurt": this.tone(140, 0.25, "sawtooth", 0.3, 60); this.noise(0.15, 300, 0.3, "lowpass"); break;
      case "swing": this.noise(0.18, 600, 0.22, "highpass", 3000); break;
      case "dodge": this.noise(0.22, 400, 0.25, "bandpass", 1600); break;
      case "shield": this.tone(300, 0.5, "sine", 0.2, 700, 0, true); this.tone(450, 0.5, "triangle", 0.1, 900); break;
      case "flare": this.noise(0.6, 500, 0.35, "bandpass", 2500); this.tone(800, 0.5, "sine", 0.15, 1600, 0, true); break;
      case "strike": this.noise(0.2, 800, 0.4, "highpass", 4000); this.tone(220, 0.2, "sawtooth", 0.25, 440); break;
      case "warn": this.tone(880, 0.12, "square", 0.15); this.tone(880, 0.12, "square", 0.15, undefined, 0.2); break;
      case "weak": case "error": this.tone(150, 0.25, "square", 0.15, 100); break;
      case "full": this.tone(300, 0.15, "square", 0.12); this.tone(220, 0.2, "square", 0.12, undefined, 0.12); break;
      case "step": this.noise(0.05, 160, 0.06, "lowpass"); break;
      case "enemyAtk": this.tone(90, 0.3, "sawtooth", 0.25, 45); this.noise(0.2, 250, 0.25, "lowpass"); break;
      case "enemyDie": this.tone(200, 0.4, "sawtooth", 0.2, 40); this.noise(0.3, 400, 0.2, "lowpass", 100); break;
      case "boss": this.tone(70, 1.4, "sawtooth", 0.35, 35, 0, true); this.noise(1.2, 200, 0.3, "lowpass", 60); break;
      case "bossDead": [196, 262, 330, 392, 523].forEach((f, i) => this.tone(f, 0.8, "triangle", 0.2, undefined, i * 0.12, true)); break;
      case "secret": this.noise(0.6, 300, 0.5, "lowpass", 80); this.tone(80, 0.6, "triangle", 0.3, 40); this.tone(660, 0.8, "sine", 0.1, undefined, 0.3, true); break;
      case "hidden": [392, 494, 587, 784].forEach((f, i) => this.tone(f, 0.5, "sine", 0.15, undefined, i * 0.1, true)); break;
      case "discover": [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => this.tone(f, 1.0, "triangle", 0.16, undefined, i * 0.13, true)); break;
      case "extract": this.tone(180, 1.8, "sawtooth", 0.15, 700, 0, true); this.noise(1.6, 300, 0.2, "bandpass", 1500); break;
      case "extracted": [262, 330, 392, 523, 659].forEach((f, i) => this.tone(f, 0.9, "triangle", 0.18, undefined, i * 0.1, true)); break;
      case "dead": this.tone(220, 1.6, "sawtooth", 0.3, 30); this.noise(1.2, 300, 0.3, "lowpass", 60); break;
      case "ui": this.tone(520, 0.06, "triangle", 0.12); break;
      case "buy": this.tone(523, 0.1, "triangle", 0.15); this.tone(784, 0.15, "triangle", 0.15, undefined, 0.08); break;
      case "heal": this.tone(440, 0.3, "sine", 0.15, 880); break;
    }
  }

  startAmbience(biome: number) {
    if (!this.ctx) return;
    this.stopAmbience();
    const c = this.ctx;
    this.biome = biome;
    const drone = (f: number, v: number) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = "sine"; o.frequency.value = f; g.gain.value = v;
      const lfo = c.createOscillator(), lg = c.createGain();
      lfo.frequency.value = 0.07 + Math.random() * 0.1; lg.gain.value = v * 0.5;
      lfo.connect(lg); lg.connect(g.gain);
      o.connect(g); g.connect(this.ambG); o.start(); lfo.start();
      this.nodes.push(o, lfo);
    };
    const base = [55, 49, 41, 46, 36][biome] ?? 50;
    drone(base, 0.35); drone(base * 1.5, 0.15); drone(base * 2.01, 0.08);
    const n = c.createBufferSource(); n.buffer = this.noiseBuf; n.loop = true;
    const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = biome === 2 ? 420 : 240;
    const ng = c.createGain(); ng.gain.value = biome === 2 ? 0.22 : 0.1;
    n.connect(f); f.connect(ng); ng.connect(this.ambG); n.start();
    this.nodes.push(n);
    this.ambG.gain.cancelScheduledValues(c.currentTime);
    this.ambG.gain.linearRampToValueAtTime(0.5, c.currentTime + 2);
    // water drips + crystal resonance
    this.timers.push(setInterval(() => {
      if (Math.random() < 0.6) this.tone(1100 + Math.random() * 900, 0.12, "sine", 0.05, 600, 0, true);
    }, 2300));
    if (biome === 1 || biome === 4) this.timers.push(setInterval(() => {
      if (Math.random() < 0.5) this.tone([880, 1175, 1318, 1760][Math.floor(Math.random() * 4)], 2.2, "sine", 0.035, undefined, 0, true);
    }, 3800));
    if (biome === 2) this.timers.push(setInterval(() => { if (Math.random() < 0.5) this.noise(0.8, 150, 0.25, "lowpass", 60); }, 4200));
    if (biome === 3) this.timers.push(setInterval(() => { if (Math.random() < 0.3) this.tone(300, 0.6, "square", 0.03, 150, 0, true); }, 5000));
  }
  setBoss(on: boolean) {
    if (!this.ctx) return;
    const c = this.ctx;
    this.bossG.gain.cancelScheduledValues(c.currentTime);
    this.bossG.gain.linearRampToValueAtTime(on ? 0.6 : 0, c.currentTime + 1.2);
    this.ambG.gain.linearRampToValueAtTime(on ? 0.15 : 0.5, c.currentTime + 1.2);
    this.stopBossLoop();
    if (!on) return;
    const o = c.createOscillator(), g = c.createGain(), o2 = c.createOscillator();
    o.type = "sawtooth"; o.frequency.value = 55; o2.type = "square"; o2.frequency.value = 82.4;
    const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 300;
    g.gain.value = 0.25;
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 2.2; lg.gain.value = 0.22; lfo.connect(lg); lg.connect(g.gain);
    o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(this.bossG);
    o.start(); o2.start(); lfo.start();
    this.bossNodes = [o, o2, lfo];
  }
  private bossNodes: OscillatorNode[] = [];
  private stopBossLoop() {
    const old = this.bossNodes; this.bossNodes = [];
    setTimeout(() => old.forEach((n) => { try { n.stop(); } catch { /* already stopped */ } }), 1500);
  }
  stopAmbience() {
    this.timers.forEach(clearInterval); this.timers = [];
    this.nodes.forEach((n) => { try { n.stop(); } catch { /* already stopped */ } }); this.nodes = [];
    if (this.ctx) { this.ambG.gain.value = 0; }
    this.stopBossLoop();
    if (this.ctx) this.bossG.gain.value = 0;
  }
  /** camp ambience: soft wind + occasional chime */
  startCamp() {
    if (!this.ctx) return;
    this.startAmbience(0);
    this.ambG.gain.value = 0.25;
  }
  get biomeIndex() { return this.biome; }
}

export const audio = new AudioEngine();
