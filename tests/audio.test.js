import test from "node:test";
import assert from "node:assert/strict";
import {
  AquariumAudio,
  DEFAULT_AUDIO,
  sanitizeAudio,
} from "../frontend/src/audio.js";
const param = () => ({
  value: 0,
  cancelScheduledValues() {},
  setTargetAtTime() {},
  setValueAtTime() {},
  linearRampToValueAtTime() {},
  exponentialRampToValueAtTime() {},
});
const node = () => ({
  connect() {},
  disconnect() {},
  gain: param(),
  frequency: param(),
  threshold: param(),
  ratio: param(),
  knee: param(),
  start() {},
  stop() {
    this.stopped = true;
  },
});
class Context {
  static created = 0;
  constructor() {
    Context.created++;
    this.currentTime = 0;
    this.sampleRate = 100;
    this.state = "suspended";
  }
  createGain() {
    return node();
  }
  createDynamicsCompressor() {
    return node();
  }
  createOscillator() {
    return node();
  }
  createBufferSource() {
    return node();
  }
  createBiquadFilter() {
    return node();
  }
  createBuffer() {
    return { getChannelData: () => new Float32Array(300) };
  }
  async resume() {
    this.state = "running";
  }
  async suspend() {
    this.state = "suspended";
  }
  async close() {
    this.state = "closed";
  }
}
function fixture() {
  const data = new Map(),
    storage = {
      getItem: (k) => data.get(k),
      setItem: (k, v) => data.set(k, v),
    },
    events = new Map(),
    doc = {
      hidden: false,
      addEventListener: (n, fn) => events.set(n, fn),
      removeEventListener: (n) => events.delete(n),
    };
  return {
    storage,
    doc,
    events,
    audio: new AquariumAudio({ storage, Context, document: doc }),
  };
}
test("audio creates no context until enabled; singleton playback, levels, mute and cleanup", async () => {
  const f = fixture(),
    a = f.audio,
    created = Context.created;
  const cleanup = a.attach();
  a.effect("discovery");
  a.update({ master: 80 });
  assert.equal(Context.created, created);
  assert.equal(await a.enable(), true);
  assert.equal(Context.created, created + 1);
  const ctx = a.ctx,
    timer = a.timer;
  await a.enable();
  assert.equal(a.ctx, ctx);
  assert.equal(a.timer, timer);
  assert.equal(Context.created, created + 1);
  a.update({ music: 17, musicOn: false });
  assert.equal(a.getSnapshot().prefs.music, 17);
  assert.equal(a.getSnapshot().prefs.musicOn, false);
  const count = a.sources.size;
  a.effect("reward");
  assert.ok(a.sources.size > count);
  a.update({ effectsOn: false });
  const off = a.sources.size;
  a.effect("click");
  assert.equal(a.sources.size, off);
  a.update({ muted: true });
  assert.equal(a.getSnapshot().prefs.muted, true);
  a.update({ muted: false });
  await a.resume();
  assert.equal(a.getSnapshot().active, true);
  const restored = new AquariumAudio({
    storage: f.storage,
    Context,
    document: f.doc,
  });
  assert.equal(restored.snapshot.prefs.master, 80);
  assert.equal(restored.ctx, undefined);
  cleanup();
  assert.equal(f.events.size, 0);
  assert.equal(a.sources.size, 0);
  assert.equal(a.timer, null);
  assert.equal(a.ctx, null);
  assert.equal(ctx.state, "closed");
});
test("visibility pauses scheduling; returning resumes once; unavailable API degrades safely", async () => {
  const f = fixture(),
    a = f.audio;
  await a.enable();
  f.doc.hidden = true;
  await a.resume();
  assert.equal(a.timer, null);
  f.doc.hidden = false;
  await a.resume();
  assert.ok(a.timer);
  a.dispose();
  const unavailable = new AquariumAudio({ Context: null });
  assert.equal(await unavailable.enable(), false);
  assert.equal(unavailable.getSnapshot().available, false);
  unavailable.effect("fish");
  unavailable.dispose();
});
test("invalid stored preferences are bounded and storage failures are safe", () => {
  assert.deepEqual(sanitizeAudio(null), DEFAULT_AUDIO);
  assert.equal(
    sanitizeAudio({ music: 200, ambient: -4, master: NaN }).music,
    100,
  );
  assert.equal(sanitizeAudio({ ambient: -4 }).ambient, 0);
  const a = new AquariumAudio({
    Context: null,
    storage: {
      getItem() {
        throw Error("blocked");
      },
      setItem() {
        throw Error("blocked");
      },
    },
  });
  assert.doesNotThrow(() => a.update({ master: 33 }));
  a.dispose();
});
