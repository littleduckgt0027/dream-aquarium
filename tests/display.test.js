import test from "node:test";
import assert from "node:assert/strict";
import {
  readDisplay,
  registerDisplay,
  enterAquarium,
  exitAquarium,
  toggleBackground,
  displaySnapshot,
  nativeFullscreenEnded,
} from "../frontend/src/display.js";
test("display preferences validate storage and survive unavailable storage", () => {
  for (const value of [
    null,
    "bad",
    "{}",
    '{"background":"true","immersive":1}',
  ])
    assert.deepEqual(readDisplay({ getItem: () => value }), {
      background: false,
      immersive: false,
    });
  assert.deepEqual(
    readDisplay({ getItem: () => '{"background":true,"immersive":true}' }),
    { background: true, immersive: true },
  );
  assert.deepEqual(
    readDisplay({
      getItem: () => {
        throw Error("blocked");
      },
    }),
    { background: false, immersive: false },
  );
});
test("fullscreen rejection/unsupported API preserves fallback and native exit preserves background", async () => {
  const un = registerDisplay({
    requestFullscreen: () => Promise.reject(Error("denied")),
  });
  toggleBackground();
  enterAquarium();
  await Promise.resolve();
  assert.deepEqual(displaySnapshot(), { background: true, immersive: true });
  nativeFullscreenEnded();
  assert.deepEqual(displaySnapshot(), { background: true, immersive: false });
  un();
  const off = registerDisplay({});
  enterAquarium();
  assert.equal(displaySnapshot().immersive, true);
  await exitAquarium();
  assert.equal(displaySnapshot().immersive, false);
  off();
  toggleBackground();
});
