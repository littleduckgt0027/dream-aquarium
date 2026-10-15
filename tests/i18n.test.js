import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  messages,
  sourceKeys,
  LANGUAGES,
  t,
  setLanguage,
  getLanguage,
  systemMessage,
  number,
  date,
  subscribe,
} from "../frontend/src/i18n/index.js";
test("all five catalogs have complete keys and matching interpolation; missing keys throw", () => {
  const base = Object.keys(messages.en).sort(),
    tokens = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  assert.ok(base.length >= 405);
  for (const { code } of LANGUAGES) {
    assert.deepEqual(Object.keys(messages[code]).sort(), base);
    for (const key of base) {
      const value = messages[code][key];
      if (typeof value === "string") {
        assert.ok(value.trim(), `${code}:${key}`);
        assert.deepEqual(
          tokens(value),
          tokens(messages.en[key]),
          `${code}:${key}`,
        );
      } else
        for (const text of Object.values(value))
          assert.deepEqual(tokens(text), ["count"]);
    }
  }
  assert.throws(() => t("ui.nonexistent"), /Missing translation/);
});
test("Thai default, immediate subscriptions, interpolation/plural rules, dates and numbers", () => {
  assert.equal(getLanguage(), "th");
  let updates = 0;
  const un = subscribe(() => updates++);
  for (const { code } of LANGUAGES) {
    setLanguage(code);
    assert.equal(getLanguage(), code);
    assert.ok(t("counts.fish", { count: 1 }));
    assert.ok(t("counts.fish", { count: 2 }));
    assert.ok(date(Date.UTC(2026, 9, 15)));
    assert.ok(number(1000000000));
  }
  assert.equal(updates, 5);
  un();
  setLanguage("invalid");
  assert.equal(getLanguage(), "en");
  assert.equal(
    t("ui.select_value0", { p0: "魚_<TaYuak>" }),
    "Select 魚_<TaYuak>",
  );
  setLanguage("ja");
  assert.notEqual(systemMessage("Not enough Pearl"), "Not enough Pearl");
  assert.ok(systemMessage("Gacha x10").includes("10"));
  assert.notEqual(
    systemMessage("Unrecognized backend failure"),
    "Unrecognized backend failure",
  );
  setLanguage("th");
});
test("all existing server validation messages, ledger reasons and deliveries have translations", () => {
  const files = [
    "backend/game.js",
    "backend/server.js",
    "backend/inventory.js",
  ];
  // SQL and operator-only configuration messages never reach the player UI.
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const [, source] of text.matchAll(/"([^"\n]+)"/g)) {
      if (
        !/[a-z]/.test(source) ||
        !/^[A-Z]/.test(source) ||
        /^(SELECT|INSERT|UPDATE|DELETE|LOWER|CASE|SET|Render requires)/.test(
          source,
        ) ||
        /^(X-|Cache-|Referrer-|Access-|Content-|Idempotency-)/.test(source) ||
        source.startsWith("Access-Control") ||
        [
          "Referrer-Policy",
          "X-Frame-Options",
          "Idempotency-Key",
          "Origin",
          "Game transaction failed",
          "Auction settlement failed",
        ].includes(source)
      )
        continue;
      assert.ok(sourceKeys[source], `${file}: missing message ${source}`);
    }
  }
});

test("player-facing JSX uses dictionaries; product branding and DNA identifiers stay unchanged", async () => {
  const { parse } = await import("@babel/parser");
  for (const file of [
    "frontend/src/main.jsx",
    "frontend/src/Aquarium.jsx",
    "frontend/src/GlobalControls.jsx",
    "frontend/src/DisplayControls.jsx",
    "frontend/src/AquariumStage.jsx",
    "frontend/src/Expansion.jsx",
    "frontend/src/FishInventory.jsx",
    "frontend/src/StackInventory.jsx",
    "frontend/src/RecyclingAll.jsx",
    "frontend/src/FishPicker.jsx",
  ]) {
    const ast = parse(readFileSync(file, "utf8"), {
      sourceType: "module",
      plugins: ["jsx"],
    });
    function visit(node) {
      if (!node || typeof node !== "object") return;
      if (node.type === "JSXText") {
        const literal = node.value.replace(/\s+/g, " ").trim();
        if (/[a-zA-Z]/.test(literal))
          assert.ok(
            [
              "DREAM",
              "AQUARIUM",
              "DREAM AQUARIUM",
              "◉ DREAM AQUARIUM",
            ].includes(literal),
            `${file}: untranslated JSX ${literal}`,
          );
      }
      if (
        node.type === "JSXAttribute" &&
        ["aria-label", "placeholder", "title", "label", "text", "alt"].includes(
          node.name.name,
        ) &&
        node.value?.type === "StringLiteral"
      )
        assert.doesNotMatch(
          node.value.value,
          /[a-zA-Z]/,
          `${file}: untranslated attribute`,
        );
      for (const value of Object.values(node))
        if (Array.isArray(value)) value.forEach(visit);
        else if (value?.type) visit(value);
    }
    visit(ast);
  }
  assert.ok(systemMessage("__proto__"));
  assert.ok(systemMessage("toString"));
});
