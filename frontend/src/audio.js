// Original Dream Aquarium synthesis. No recordings, external assets or samples.
export const AUDIO_KEY = "dreamAudio";
export const DEFAULT_AUDIO = Object.freeze({
  master: 45,
  music: 30,
  ambient: 25,
  effects: 25,
  musicOn: true,
  ambientOn: true,
  effectsOn: true,
  muted: false,
});
export function sanitizeAudio(value = {}) {
  const out = { ...DEFAULT_AUDIO };
  for (const key of ["master", "music", "ambient", "effects"])
    if (typeof value?.[key] === "number" && Number.isFinite(value[key]))
      out[key] = Math.max(0, Math.min(100, value[key]));
  for (const key of ["musicOn", "ambientOn", "effectsOn", "muted"])
    if (typeof value?.[key] === "boolean") out[key] = value[key];
  return out;
}
export class AquariumAudio {
  constructor({
    storage,
    Context = globalThis.AudioContext || globalThis.webkitAudioContext,
    document = globalThis.document,
  } = {}) {
    this.storage = storage;
    this.Context = Context;
    this.document = document;
    this.listeners = new Set();
    this.sources = new Set();
    let saved;
    try {
      saved = JSON.parse(storage?.getItem(AUDIO_KEY) || "null");
    } catch {}
    this.snapshot = {
      prefs: sanitizeAudio(saved),
      active: false,
      available: !!Context,
    };
    this.subscribe = (listener) => {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    };
    this.getSnapshot = () => this.snapshot;
  }
  emit(next = {}) {
    this.snapshot = { ...this.snapshot, ...next };
    for (const fn of this.listeners) fn();
  }
  update(patch) {
    const prefs = sanitizeAudio({ ...this.snapshot.prefs, ...patch });
    try {
      this.storage?.setItem(AUDIO_KEY, JSON.stringify(prefs));
    } catch {}
    this.emit({ prefs });
    this.apply();
    if (this.ctx) this.resume().catch(() => {});
  }
  async enable() {
    if (!this.Context) {
      this.emit({ available: false });
      return false;
    }
    try {
      if (!this.ctx) {
        this.ctx = new this.Context();
        const c = this.ctx;
        this.master = c.createGain();
        this.master.gain.value = 0;
        const compressor = c.createDynamicsCompressor();
        compressor.threshold.value = -14;
        compressor.ratio.value = 5;
        compressor.knee.value = 18;
        this.master.connect(compressor);
        compressor.connect(c.destination);
        this.compressor = compressor;
        this.channels = {};
        for (const layer of ["music", "ambient", "effects"]) {
          const gain = c.createGain();
          gain.gain.value = 0;
          gain.connect(this.master);
          this.channels[layer] = gain;
        }
        this.nextNote = c.currentTime + 0.1;
        this.noteIndex = 0;
        this.nextBubble = c.currentTime + 4;
        this.makeWater();
      }
      await this.resume();
      return true;
    } catch {
      this.emit({ available: false, active: false });
      this.dispose();
      return false;
    }
  }
  fade(node, value, seconds = 0.18) {
    if (!node || !this.ctx) return;
    const now = this.ctx.currentTime;
    node.gain.cancelScheduledValues(now);
    node.gain.setTargetAtTime(value, now, seconds / 3);
  }
  apply() {
    if (!this.ctx) return;
    const p = this.snapshot.prefs;
    this.fade(
      this.master,
      p.muted || this.document?.hidden ? 0 : (p.master / 100) * 0.6,
    );
    for (const layer of ["music", "ambient", "effects"])
      this.fade(this.channels[layer], p[layer + "On"] ? p[layer] / 100 : 0);
  }
  async resume() {
    if (!this.ctx) return;
    const p = this.snapshot.prefs;
    clearTimeout(this.pauseTimer);
    if (
      this.document?.hidden ||
      p.muted ||
      p.master === 0 ||
      !["music", "ambient", "effects"].some((k) => p[k + "On"] && p[k] > 0)
    ) {
      this.fade(this.master, 0);
      clearInterval(this.timer);
      this.timer = null;
      this.pauseTimer = setTimeout(() => {
        this.ctx?.suspend().catch(() => {});
        this.emit({ active: false });
      }, 200);
      return;
    }
    await this.ctx.resume();
    this.apply();
    this.emit({ active: this.ctx.state === "running" });
    if (!this.timer) {
      this.schedule();
      this.timer = setInterval(() => this.schedule(), 250);
    }
  }
  track(source) {
    this.sources.add(source);
    source.onended = () => {
      this.sources.delete(source);
      source.disconnect();
    };
    return source;
  }
  tone(
    frequency,
    time,
    length,
    layer = "music",
    level = 0.08,
    type = "sine",
    endFrequency,
  ) {
    const c = this.ctx;
    if (!c) return;
    const osc = this.track(c.createOscillator()),
      gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, time);
    if (endFrequency)
      osc.frequency.exponentialRampToValueAtTime(endFrequency, time + length);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(
      level,
      time + Math.min(0.3, length * 0.25),
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, time + length);
    osc.connect(gain);
    gain.connect(this.channels[layer]);
    osc.onended = () => {
      this.sources.delete(osc);
      osc.disconnect();
      gain.disconnect();
    };
    osc.start(time);
    osc.stop(time + length + 0.03);
  }
  makeWater() {
    const c = this.ctx,
      buffer = c.createBuffer(1, c.sampleRate * 3, c.sampleRate),
      data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      last = (last + (Math.random() * 2 - 1) * 0.02) / 1.02;
      data[i] = last;
    }
    // Match the end to the beginning so the noise loop has no discontinuity.
    const tail = Math.max(1, Math.floor(c.sampleRate * 0.1));
    for (let i = 0; i < tail; i++) {
      const at = data.length - tail + i,
        mix = (i + 1) / tail;
      data[at] = data[at] * (1 - mix) + data[0] * mix;
    }
    const source = this.track(c.createBufferSource()),
      filter = c.createBiquadFilter();
    source.buffer = buffer;
    source.loop = true;
    filter.type = "lowpass";
    filter.frequency.value = 450;
    const gain = c.createGain();
    gain.gain.value = 0.12;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.channels.ambient);
    source.start();
    this.waterNodes = [filter, gain];
  }
  schedule() {
    if (!this.ctx || this.document?.hidden) return;
    const now = this.ctx.currentTime,
      p = this.snapshot.prefs;
    this.nextNote = Math.max(this.nextNote, now + 0.04);
    const notes = [
      146.83, 220, 293.66, 369.99, 329.63, 246.94, 196, 293.66, 164.81, 246.94,
      329.63, 440, 196, 293.66, 369.99, 220,
    ];
    while (this.nextNote < now + 2) {
      if (p.musicOn && p.music > 0) {
        const f = notes[this.noteIndex % notes.length];
        this.tone(f, this.nextNote, 5, "music", 0.09);
        this.tone(f * 2, this.nextNote, 3.5, "music", 0.018);
      }
      this.noteIndex++;
      this.nextNote += 2.4;
    }
    if (now >= this.nextBubble) {
      if (p.ambientOn && p.ambient > 0)
        this.tone(280, now + 0.03, 1.2, "ambient", 0.035, "sine", 600);
      this.nextBubble = now + 7;
    }
  }
  effect(kind = "click") {
    const p = this.snapshot.prefs;
    if (
      !this.ctx ||
      !this.snapshot.active ||
      !p.effectsOn ||
      p.muted ||
      this.document?.hidden
    )
      return;
    const now = this.ctx.currentTime;
    if (this.sources.size > 32) return;
    if (kind === "hover") {
      if (now - (this.lastHover ?? -1) < 0.35) return;
      this.lastHover = now;
      this.tone(420, now, 0.13, "effects", 0.012);
      return;
    }
    const melodies = {
      click: [330],
      fish: [392, 523.25],
      breed: [293.66, 369.99, 440],
      discovery: [329.63, 440, 587.33],
      reward: [392, 493.88, 587.33],
      trade: [293.66, 440],
      success: [329.63, 392],
      notification: [440],
    };
    (melodies[kind] || melodies.click).forEach((f, i) =>
      this.tone(f, now + i * 0.13, 0.65, "effects", 0.035),
    );
  }
  attach() {
    const doc = this.document;
    if (!doc) return () => {};
    const click = (e) => {
      if (
        e.target.closest?.("button") &&
        !e.target.closest("[data-audio-control]")
      )
        this.effect("click");
    };
    const hover = (e) => {
      if (e.target.closest?.("button")) this.effect("hover");
    };
    const pagehide = () => this.dispose();
    const visibility = () => {
      this.resume().catch(() => {});
    };
    globalThis.addEventListener?.("pagehide", pagehide);
    doc.addEventListener("click", click);
    doc.addEventListener("pointerover", hover);
    doc.addEventListener("visibilitychange", visibility);
    return () => {
      globalThis.removeEventListener?.("pagehide", pagehide);
      doc.removeEventListener("click", click);
      doc.removeEventListener("pointerover", hover);
      doc.removeEventListener("visibilitychange", visibility);
      this.dispose();
    };
  }
  dispose() {
    clearInterval(this.timer);
    clearTimeout(this.pauseTimer);
    this.timer = null;
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {}
      source.disconnect();
    }
    this.sources.clear();
    for (const node of this.waterNodes || []) node.disconnect();
    for (const node of Object.values(this.channels || {})) node.disconnect();
    this.master?.disconnect();
    this.compressor?.disconnect();
    const ctx = this.ctx;
    this.ctx = null;
    if (ctx && ctx.state !== "closed") ctx.close().catch(() => {});
    this.emit({ active: false });
  }
}
let storage;
try {
  storage = globalThis.localStorage;
} catch {}
export const audio = new AquariumAudio({ storage });
