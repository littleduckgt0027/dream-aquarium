import React, { useEffect, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import Aquarium, { FishIcon } from "./Aquarium.jsx";
import {
  RARITIES,
  COLORS,
  ODDS,
  LIMITED,
  ROLLS,
  MARKET_UPGRADES,
  MILESTONES,
} from "../../shared/rules.js";
import "./style.css";
const fmt = (n) => Math.floor(n || 0).toLocaleString();
const hours = (n) => `${Math.floor(n / 3600)}h ${Math.floor((n % 3600) / 60)}m`;
const wait = (end, at = Date.now()) => {
  const s = Math.max(0, Math.ceil((end - at) / 1000));
  return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};
async function api(path, body, key) {
  const r = await fetch("/api/" + path, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    ...(body ? { method: "POST", body: JSON.stringify(body) } : {}),
  });
  let data;
  try {
    data = await r.json();
  } catch {
    throw Error("Cannot reach server");
  }
  if (!r.ok) {
    const e = Error(data.error);
    e.status = r.status;
    throw e;
  }
  return data;
}
const nav = [
  ["aquarium", "◉", "Aquarium"],
  ["collection", "▦", "Fish storage"],
  ["breed", "♡", "Breeding"],
  ["gacha", "✧", "Discovery"],
  ["market", "⇄", "Marketplace"],
  ["rewards", "◷", "Online rewards"],
  ["limited", "☾", "Monthly collection"],
  ["inbox", "✉", "Inboxes"],
  ["inventory", "◈", "Inventory"],
  ["customize", "❋", "Customize"],
  ["profile", "◎", "Profile"],
  ["settings", "⚙", "Settings"],
];
function App() {
  const [state, setState] = useState(null),
    [loading, setLoading] = useState(true),
    [online, setOnline] = useState(true),
    [screen, setScreen] = useState("aquarium"),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [selected, setSelected] = useState(null),
    [recoveryCode, setRecoveryCode] = useState(""),
    [quality, setQuality] = useState(
      localStorage.getItem("dreamQuality") || "high",
    );
  const [authMode, setAuthMode] = useState("register"),
    [query, setQuery] = useState(""),
    [tier, setTier] = useState("all"),
    [sort, setSort] = useState("rarity"),
    [chosen, setChosen] = useState([]),
    [parents, setParents] = useState(["", ""]),
    [rolls, setRolls] = useState(null),
    [marketType, setMarketType] = useState("all"),
    [historyMonth, setHistoryMonth] = useState(""),
    [fishPage, setFishPage] = useState(1),
    [marketPage, setMarketPage] = useState(1),
    [marketData, setMarketData] = useState(null);
  useEffect(() => {
    setFishPage(1);
    setMarketPage(1);
  }, [query, tier, sort, marketType]);
  useEffect(() => {
    if (screen !== "market" || !state || !online) return;
    let active = true;
    const q = new URLSearchParams({
      search: query,
      rarity: tier,
      type: marketType,
      sort,
      page: String(marketPage),
    });
    api("market?" + q)
      .then((d) => {
        if (active) setMarketData(d);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [
    screen,
    query,
    tier,
    marketType,
    sort,
    marketPage,
    state?.serverTime,
    online,
  ]);
  const pending = useRef(null);
  const clock = useState(0)[1];
  function accept(s) {
    setState(s);
    setOnline(true);
    const { listings, ledger, sales, ...cached } = s;
    localStorage.setItem(
      "dreamAquarium",
      JSON.stringify({ ...cached, listings: [], ledger: [], sales: [] }),
    );
  }
  async function refresh() {
    try {
      const s = await api("state");
      accept(s);
    } catch (e) {
      if (e.status === 401) {
        setState(null);
        localStorage.removeItem("dreamAquarium");
      } else setOnline(false);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    const cached = localStorage.getItem("dreamAquarium");
    if (cached) {
      try {
        setState(JSON.parse(cached));
        setOnline(false);
      } catch {}
    }
    refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 15000);
    const c = setInterval(() => clock((x) => x + 1), 1000);
    return () => {
      clearInterval(timer);
      clearInterval(c);
    };
  }, []);
  useEffect(() => {
    if (!state) return;
    const beat = () => {
      if (document.visibilityState === "visible")
        api("action", { type: "heartbeat" }, crypto.randomUUID())
          .then(accept)
          .catch((e) => {
            if (e.status !== 400) setOnline(false);
          });
    };
    beat();
    const timer = setInterval(beat, 15000);
    return () => clearInterval(timer);
  }, [state?.id]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 7000);
    return () => clearTimeout(t);
  }, [notice]);
  const locked = !online || state?.maintenance || busy;
  async function act(type, payload = {}) {
    if (locked) return;
    setBusy(true);
    const signature = JSON.stringify({ type, payload });
    if (!pending.current || pending.current.signature !== signature)
      pending.current = { signature, key: crypto.randomUUID() };
    try {
      const s = await api("action", { type, payload }, pending.current.key);
      pending.current = null;
      accept(s);
      setNotice("Saved to your aquarium");
      return s;
    } catch (e) {
      setNotice(e.message);
      if (e.status) pending.current = null;
      else setOnline(false);
    } finally {
      setBusy(false);
    }
  }
  async function authenticate(e) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.target);
    try {
      const r = await api("auth/" + authMode, Object.fromEntries(f));
      if (r.recoveryCode) setRecoveryCode(r.recoveryCode);
      await refresh();
    } catch (e) {
      setNotice(e.message);
    } finally {
      setBusy(false);
    }
  }
  const button = (label, fn, extra = {}) => (
    <button disabled={locked} onClick={fn} {...extra}>
      {label}
    </button>
  );
  const fishCard = (f, actions = true) => (
    <article className="fish-card" key={f.id}>
      <button className="fish-preview" onClick={() => setSelected(f)}>
        <FishIcon fish={f} />
      </button>
      <div className="fish-title">
        <b>{f.name}</b>
        <span style={{ color: COLORS[f.rarity] }}>{RARITIES[f.rarity]}</span>
      </div>
      <small>
        {f.limited
          ? `☾ ${f.limited} Limited`
          : `Generation ${f.generation} · ${f.growth >= 1 ? "Adult" : Math.round((f.growth || 0) * 100) + "% grown"}`}
      </small>
      {actions && (
        <div className="card-actions">
          {button(
            f.location === "tank" ? "Store" : "Add to tank",
            () =>
              act("move", {
                id: f.id,
                location: f.location === "tank" ? "storage" : "tank",
              }),
            { className: "subtle" },
          )}
          <label className="check">
            <input
              type="checkbox"
              aria-label={`Select ${f.name}`}
              checked={chosen.includes(f.id)}
              onChange={(e) =>
                setChosen(
                  e.target.checked
                    ? [...chosen, f.id]
                    : chosen.filter((id) => id !== f.id),
                )
              }
            />
            Recycle
          </label>
        </div>
      )}
    </article>
  );
  if (loading && !state)
    return (
      <main className="loading">
        <span className="brand-mark">◉</span>
        <h1>Entering your sanctuary…</h1>
      </main>
    );
  if (!state)
    return (
      <main className="auth">
        <div className="auth-art">
          <div className="brand">◉ DREAM AQUARIUM</div>
          <h1>
            A little ocean.
            <br />
            An endless discovery.
          </h1>
          <p>
            Raise extraordinary fish. Discover their stories.
            <br />
            Make a world that is entirely yours.
          </p>
          <Aquarium
            fish={Array.from({ length: 7 }, (_, i) => ({
              id: String(i),
              name: "Opal",
              rarity: i % 4,
              growth: 1,
              dna: {
                body: i * 0.13,
                proportion: 0.6,
                tail: i % 4,
                tailLength: 0.5,
                finLength: 0.4,
                hue: i * 47,
                accent: i * 47 + 50,
                pattern: i % 4,
                eye: 0.5,
                maxSize: 1,
                glow: false,
              },
            }))}
            theme="lagoon"
            decor="garden"
            onSelect={() => {}}
          />
        </div>
        <section className="auth-form">
          <span className="eyebrow">YOUR UNDERWATER WORLD AWAITS</span>
          <h2>
            {authMode === "register"
              ? "Begin your journey"
              : authMode === "recover"
                ? "Recover your aquarium"
                : "Welcome back"}
          </h2>
          <p>Cloud-saved fish. A living collection. Your own quiet escape.</p>
          <form onSubmit={authenticate}>
            <label>
              Username
              <input
                name="username"
                autoComplete="username"
                required
                minLength="3"
                maxLength="24"
                pattern="[a-zA-Z0-9_]+"
                placeholder="Your explorer name"
              />
            </label>
            <label>
              {authMode === "recover" ? "New password" : "Password"}
              <input
                name="password"
                type="password"
                autoComplete={
                  authMode === "login" ? "current-password" : "new-password"
                }
                required
                minLength="10"
                maxLength="128"
                placeholder="At least 10 characters"
              />
            </label>
            {authMode === "recover" && (
              <label>
                Recovery code
                <input name="recovery" required />
              </label>
            )}
            <button className="primary" disabled={busy}>
              {busy
                ? "Connecting…"
                : authMode === "register"
                  ? "Create aquarium →"
                  : authMode === "recover"
                    ? "Reset password"
                    : "Enter aquarium →"}
            </button>
          </form>
          <div className="auth-links">
            <button
              onClick={() =>
                setAuthMode(authMode === "login" ? "register" : "login")
              }
            >
              {authMode === "login"
                ? "Create an account"
                : "I already have an account"}
            </button>
            <button onClick={() => setAuthMode("recover")}>
              Recover account
            </button>
          </div>
          <small>
            No real-money purchases. Your first 5 fish and 3,000 Pearl are
            included.
          </small>
        </section>
        {notice && (
          <div role="alert" className="toast">
            {notice}
          </div>
        )}
      </main>
    );
  const fishes = state.fish
    .filter(
      (f) =>
        (tier === "all" || f.rarity === Number(tier)) &&
        `${f.name} ${f.id} ${RARITIES[f.rarity]}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "rarity"
        ? b.rarity - a.rarity
        : sort === "age"
          ? a.born - b.born
          : a.name.localeCompare(b.name),
    );
  const tank = state.fish.filter((f) => f.location === "tank"),
    adults = state.fish.filter((f) => f.growth >= 1);
  const unclaimed =
    state.rewards.filter((r) => !r.claimed).length +
    state.deliveries.filter((r) => !r.claimed).length;
  return (
    <div className="app">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setScreen("aquarium");
          }}
        >
          <span className="brand-mark">◉</span>
          <span>
            DREAM
            <br />
            <strong>AQUARIUM</strong>
          </span>
        </a>
        <div className="nav-label">YOUR SANCTUARY</div>
        <nav>
          {nav.map(([id, icon, label]) => (
            <button
              key={id}
              className={screen === id ? "active" : ""}
              onClick={() => setScreen(id)}
            >
              <span>{icon}</span>
              {label}
              {id === "inbox" && unclaimed > 0 && <em>{unclaimed}</em>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span
            className={
              online && !state.maintenance ? "status-dot" : "status-dot offline"
            }
          />
          {state.maintenance
            ? "Maintenance"
            : online
              ? "Cloud connected"
              : "Offline · view only"}
          <small>Made for a slower moment.</small>
        </div>
      </aside>
      <div className="workspace">
        <header>
          <div className="breadcrumb">
            Your sanctuary <span>/</span>{" "}
            <b>{nav.find((n) => n[0] === screen)?.[2]}</b>
          </div>
          <div className="top-right">
            <span className="pearl">
              ◈ <b>{fmt(state.pearls)}</b> <small>PEARL</small>
            </span>
            <button className="avatar" onClick={() => setScreen("profile")}>
              {state.username.slice(0, 1).toUpperCase()}
            </button>
          </div>
        </header>
        <main className="content">
          {(!online || state.maintenance) && (
            <div className="warning">
              {state.maintenance
                ? "Maintenance in progress. Transactions and online time are paused. Your fish are safe."
                : "Connection lost. This is your cached aquarium. Changes are disabled until the server reconnects."}
              <button onClick={refresh}>Reconnect</button>
            </div>
          )}
          {screen === "aquarium" && (
            <>
              <div className="page-title">
                <div>
                  <span className="eyebrow">A WORLD OF YOUR OWN</span>
                  <h1>
                    Your little ocean<span>.</span>
                  </h1>
                  <p>
                    Take a breath. There’s always something beautiful happening.
                  </p>
                </div>
                <button
                  className="outline"
                  onClick={() => setScreen("customize")}
                >
                  ❋ Customize aquarium
                </button>
              </div>
              <section className="tank-view">
                <Aquarium
                  fish={tank}
                  theme={state.theme}
                  decor={state.decorations[0]}
                  onSelect={setSelected}
                  quality={quality}
                />
                <div className="tank-top">
                  <span className="glass-pill">
                    ◉ &nbsp;{" "}
                    {state.theme === "midnight"
                      ? "Midnight reef"
                      : state.theme === "coral"
                        ? "Coral cove"
                        : "Emerald lagoon"}
                  </span>
                  <span className="glass-pill">
                    {tank.length} / {state.tank} fish
                  </span>
                </div>
                <div className="tank-caption">
                  <span>YOUR LIVING AQUARIUM</span>
                  <h2>A moment of wonder.</h2>
                  <p>Tap a fish to discover its story.</p>
                </div>
                <div className="water-label">
                  ✧ PROCEDURALLY UNIQUE · ALWAYS ALIVE
                </div>
              </section>
              <div className="stats-row">
                <div>
                  <span>◈</span>
                  <section>
                    <small>YOUR COLLECTION</small>
                    <b>
                      {fmt(state.fish.length)} <i>unique fish</i>
                    </b>
                  </section>
                </div>
                <div>
                  <span>♡</span>
                  <section>
                    <small>NURSERY</small>
                    <b>
                      {state.breeds.filter((b) => !b.claimed).length}{" "}
                      <i>breeding pairs</i>
                    </b>
                  </section>
                  <button onClick={() => setScreen("breed")}>↗</button>
                </div>
                <div>
                  <span>◷</span>
                  <section>
                    <small>TIME TO UNWIND</small>
                    <b>
                      {hours(state.online.seconds)} <i>this month</i>
                    </b>
                  </section>
                  <button onClick={() => setScreen("rewards")}>↗</button>
                </div>
              </div>
              <div className="section-title">
                <h2>
                  Swimming in your sanctuary <span>{tank.length}</span>
                </h2>
                <button onClick={() => setScreen("collection")}>
                  View collection →
                </button>
              </div>
              <div className="fish-grid">
                {tank.map((f) => fishCard(f, false))}
              </div>
              <div className="discover-banner">
                <span>✧</span>
                <div>
                  <small>A NEW DISCOVERY IS WAITING</small>
                  <h2>Every fish has a story written in its DNA.</h2>
                  <p>
                    Discover new colors, extraordinary fins, and a little bit of
                    magic.
                  </p>
                </div>
                <button onClick={() => setScreen("gacha")}>
                  Discover fish →
                </button>
              </div>
            </>
          )}
          {screen === "collection" && (
            <>
              <Title
                label="YOUR LIVING LIBRARY"
                title="Every fish, a discovery."
                text={`${state.fish.length} fish · ${state.fish.filter((f) => f.location === "storage").length}/${state.storage} storage · ${tank.length}/${state.tank} aquarium`}
              />
              <div className="toolbar">
                <input
                  aria-label="Search fish"
                  placeholder="Search fish or DNA ID…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <select
                  aria-label="Filter rarity"
                  value={tier}
                  onChange={(e) => setTier(e.target.value)}
                >
                  <option value="all">All rarities</option>
                  {RARITIES.map((r, i) => (
                    <option value={i} key={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Sort fish"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="rarity">Rarity</option>
                  <option value="age">Age</option>
                  <option value="name">Name</option>
                </select>
                {button(`Expand storage · ${fmt(state.storage * 2)} ◈`, () =>
                  act("upgrade", { kind: "storage" }),
                )}
                {button(`Recycle ${chosen.length}/10`, async () => {
                  const s = await act("recycle", { ids: chosen });
                  if (s) setChosen([]);
                })}
              </div>
              <p className="muted">
                Select 10 non-limited fish of the same rarity to receive one
                non-tradable recycling ticket.
              </p>
              <div className="fish-grid">
                {fishes
                  .slice((fishPage - 1) * 60, fishPage * 60)
                  .map((f) => fishCard(f))}
              </div>
              {fishes.length > 60 && (
                <div className="pagination">
                  <button
                    disabled={fishPage <= 1}
                    onClick={() => setFishPage((p) => p - 1)}
                  >
                    Previous
                  </button>
                  <span>
                    Page {fishPage} / {Math.ceil(fishes.length / 60)}
                  </span>
                  <button
                    disabled={fishPage >= Math.ceil(fishes.length / 60)}
                    onClick={() => setFishPage((p) => p + 1)}
                  >
                    Next
                  </button>
                </div>
              )}
              {!fishes.length && <Empty text="No fish match your search." />}
            </>
          )}
          {screen === "breed" && (
            <>
              <Title
                label="THE NURSERY"
                title="A new generation."
                text="Two mature parents. Inherited DNA. Endless possibilities."
              />
              <section className="panel">
                <div className="parent-pair">
                  {[0, 1].map((i) => (
                    <div key={i}>
                      <label>
                        Parent {i + 1}
                        <select
                          aria-label={`Parent ${i + 1}`}
                          value={parents[i]}
                          onChange={(e) =>
                            setParents(
                              parents.map((p, j) =>
                                j === i ? e.target.value : p,
                              ),
                            )
                          }
                        >
                          <option value="">Choose a mature fish</option>
                          {adults.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name} · {RARITIES[f.rarity]} ·{" "}
                              {f.id.slice(0, 4)}
                            </option>
                          ))}
                        </select>
                      </label>
                      {parents[i] &&
                        state.fish.find((f) => f.id === parents[i]) &&
                        fishCard(
                          state.fish.find((f) => f.id === parents[i]),
                          false,
                        )}
                    </div>
                  ))}
                </div>
                <p>
                  1–2 offspring based on fertility · 2 minute incubation · 8%
                  color mutation chance. Most offspring inherit their parents’
                  combined rarity; 5% rise one tier.
                </p>
                {button(
                  "Begin breeding · 200 ◈",
                  () => act("breed", { a: parents[0], b: parents[1] }),
                  { className: "primary" },
                )}
              </section>
              <h2>Breeding journal</h2>
              {state.breeds
                .slice()
                .reverse()
                .map((b) => (
                  <article className="panel" key={b.id}>
                    <b>
                      Generation {b.children[0].generation} ·{" "}
                      {b.children.length} offspring
                    </b>
                    <p>
                      Parents:{" "}
                      {b.parents
                        .map(
                          (id) =>
                            state.fish.find((f) => f.id === id)?.name ||
                            id.slice(0, 8),
                        )
                        .join(" × ")}
                    </p>
                    {b.claimed ? (
                      <span className="badge">Welcomed to collection</span>
                    ) : Date.now() >= b.ready ? (
                      button("Welcome offspring", () =>
                        act("breedClaim", { id: b.id }),
                      )
                    ) : (
                      <span className="badge">Incubating {wait(b.ready)}</span>
                    )}
                    {b.claimed && (
                      <div className="fish-grid">
                        {b.children.map((f) =>
                          fishCard(
                            state.fish.find((x) => x.id === f.id) || f,
                            false,
                          ),
                        )}
                      </div>
                    )}
                  </article>
                ))}
            </>
          )}
          {screen === "gacha" && (
            <>
              <Title
                label="THE DISCOVERY POOL"
                title="Meet the unexpected."
                text="Every discovery is genetically unique. Pearl only. No pity system."
              />
              <div className="gacha-hero">
                <span className="orb">✧</span>
                <h2>
                  A thousand possibilities.
                  <br />
                  One little ocean.
                </h2>
                <p>New discoveries arrive in your storage.</p>
                <div className="roll-buttons">
                  {Object.entries(ROLLS).map(([n, c]) =>
                    button(
                      `Discover ×${n} · ${fmt(c)} ◈`,
                      async () => {
                        const s = await act("gacha", { count: Number(n) });
                        if (s)
                          setRolls(
                            s.fish.filter((f) => s.lastRoll.includes(f.id)),
                          );
                      },
                      { key: n, className: Number(n) === 1 ? "primary" : "" },
                    ),
                  )}
                </div>
              </div>
              <div className="odds">
                {RARITIES.map((r, i) => (
                  <div key={r}>
                    <span style={{ color: COLORS[i] }}>✧ {r}</span>
                    <b>{ODDS[i]}%</b>
                  </div>
                ))}
              </div>
              <p className="muted">
                Bulk discounts: 10× 10%, 100× 15%, 1000× 20%. Storage space and
                sufficient Pearl are required.
              </p>
              {rolls && (
                <>
                  <h2>Your discoveries · {rolls.length}</h2>
                  <div className="fish-grid">
                    {rolls.slice(0, 100).map((f) => fishCard(f, false))}
                  </div>
                  {rolls.length > 100 && (
                    <p>
                      Showing first 100 results. All {rolls.length} are in Fish
                      storage.
                    </p>
                  )}
                </>
              )}
            </>
          )}
          {screen === "market" && (
            <>
              <Title
                label="THE TRADING HARBOR"
                title="Find a new favorite."
                text="Trade with real players. Fish are held safely in escrow. Completed sales have a 10% tax."
              />
              <div className="toolbar">
                <input
                  aria-label="Search marketplace"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search seller or fish…"
                />
                <select
                  value={marketType}
                  onChange={(e) => setMarketType(e.target.value)}
                  aria-label="Listing type"
                >
                  <option value="all">All listings</option>
                  <option value="fixed">Buy Now</option>
                  <option value="auction">Auctions</option>
                  <option value="mine">My listings</option>
                </select>
                <select
                  aria-label="Market rarity"
                  value={tier}
                  onChange={(e) => setTier(e.target.value)}
                >
                  <option value="all">All rarities</option>
                  {RARITIES.map((r, i) => (
                    <option key={r} value={i}>
                      {r}
                    </option>
                  ))}
                </select>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  aria-label="Market sort"
                >
                  <option value="rarity">Rarity</option>
                  <option value="price">Lowest price</option>
                  <option value="ending">Ending soon</option>
                </select>
              </div>
              <div className="fish-grid">
                {(marketData?.items || state.listings).map((l) => (
                  <article className="panel listing" key={l.id}>
                    <button
                      className="fish-preview"
                      onClick={() => setSelected(l.fish)}
                    >
                      <FishIcon fish={l.fish} />
                    </button>
                    <h3>
                      {l.fish.name}{" "}
                      <small style={{ color: COLORS[l.fish.rarity] }}>
                        {RARITIES[l.fish.rarity]}
                      </small>
                    </h3>
                    <small>
                      By {l.seller_name} ·{" "}
                      {l.type === "fixed" ? "Buy Now" : "Auction"}
                    </small>
                    <p className="price">◈ {fmt(l.bid || l.price)}</p>
                    {l.end_at && (
                      <p>
                        Remaining{" "}
                        {wait(
                          l.end_at,
                          state.maintenance
                            ? state.maintenanceSince
                            : Date.now(),
                        )}
                        {l.bidder === state.id ? " · You lead" : ""}
                      </p>
                    )}
                    {l.seller === state.id ? (
                      button(
                        "Cancel listing",
                        () => act("cancel", { id: l.id }),
                        {
                          disabled: locked || !!l.bidder,
                          title: l.bidder
                            ? "Cannot cancel with active bids"
                            : "",
                        },
                      )
                    ) : (
                      <>
                        {(l.type === "fixed" || l.buyout) &&
                          button(
                            `Buy ${fmt(l.type === "fixed" ? l.price : l.buyout)} ◈`,
                            () => {
                              if (confirm("Purchase this fish?"))
                                act("buy", { id: l.id });
                            },
                          )}
                        {l.type === "auction" && (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              act("bid", {
                                id: l.id,
                                amount: Number(
                                  new FormData(e.target).get("amount"),
                                ),
                              });
                            }}
                          >
                            <input
                              name="amount"
                              aria-label="Bid amount"
                              type="number"
                              min={Math.max(l.price, l.bid + 1)}
                              defaultValue={Math.max(l.price, l.bid + 1)}
                              required
                            />
                            <button disabled={locked}>Place bid</button>
                          </form>
                        )}
                      </>
                    )}
                  </article>
                ))}
              </div>
              {marketData && marketData.pages > 1 && (
                <div className="pagination">
                  <button
                    disabled={marketPage <= 1}
                    onClick={() => setMarketPage((p) => p - 1)}
                  >
                    Previous
                  </button>
                  <span>
                    Page {marketData.page} / {marketData.pages} ·{" "}
                    {marketData.total} listings
                  </span>
                  <button
                    disabled={marketPage >= marketData.pages}
                    onClick={() => setMarketPage((p) => p + 1)}
                  >
                    Next
                  </button>
                </div>
              )}
              {!(marketData?.items || state.listings).length && (
                <Empty text="The harbor is quiet. List one of your fish below, or invite another player." />
              )}
              <section className="panel">
                <h2>Create a listing</h2>
                <form
                  className="listing-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = Object.fromEntries(new FormData(e.target));
                    act("list", {
                      id: f.id,
                      type: f.type,
                      price: Number(f.price),
                      hours: Number(f.hours),
                      buyout: f.buyout ? Number(f.buyout) : null,
                    });
                  }}
                >
                  <label>
                    Fish
                    <select name="id" required>
                      <option value="">Choose your fish</option>
                      {state.fish.map((f) => (
                        <option value={f.id} key={f.id}>
                          {f.name} · {RARITIES[f.rarity]} · {f.id.slice(0, 4)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Type
                    <select name="type">
                      <option value="fixed">Buy Now · never expires</option>
                      <option value="auction">Auction</option>
                    </select>
                  </label>
                  <label>
                    Price / starting bid
                    <input
                      name="price"
                      type="number"
                      min="1"
                      max="1000000000"
                      required
                      defaultValue="500"
                    />
                  </label>
                  <label>
                    Auction duration
                    <select name="hours">
                      {[6, 12, 24, 48].map((n) => (
                        <option key={n} value={n}>
                          {n} hours
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Optional auction buyout
                    <input
                      name="buyout"
                      type="number"
                      min="1"
                      placeholder="No buyout"
                    />
                  </label>
                  <button className="primary" disabled={locked}>
                    Create listing
                  </button>
                </form>
              </section>
              <section className="panel">
                <h2>Marketplace expansion</h2>
                <p>
                  {10 + state.marketLevel * 10} slots · maximum 100 · total
                  upgrade cost 796,000 Pearl
                </p>
                {state.marketLevel < 9 ? (
                  button(
                    `Add 10 slots · ${fmt(MARKET_UPGRADES[state.marketLevel])} ◈`,
                    () => act("upgrade", { kind: "market" }),
                  )
                ) : (
                  <span>Fully expanded</span>
                )}
                <h3>Sale history</h3>
                {state.sales.slice(0, 30).map((s, i) => (
                  <p key={i}>
                    {s.fish} · {fmt(s.price)} ◈ · tax {fmt(s.tax)} ◈ ·{" "}
                    {new Date(s.time).toLocaleString()}
                  </p>
                ))}
              </section>
            </>
          )}
          {screen === "rewards" && (
            <>
              <Title
                label="TIME WELL SPENT"
                title="Stay a little longer."
                text="Eligible online time is measured by the server. Hidden tabs, offline time and maintenance earn no time."
              />
              <div className="panel reward-clock">
                <span>THIS MONTH · {state.online.month} · ASIA/BANGKOK</span>
                <h1>{hours(state.online.seconds)}</h1>
                <p>Lifetime eligible time: {hours(state.online.total)}</p>
                <p>
                  300 Pearl every 3 hours. Next reward in{" "}
                  {hours(10800 - (state.online.total % 10800))}.
                </p>
                <progress value={state.online.total % 10800} max="10800" />
              </div>
              <div className="milestones">
                {MILESTONES.map((h) => (
                  <article className="panel" key={h}>
                    <span className="large-icon">☾</span>
                    <h2>{h} hours</h2>
                    <p>Monthly Limited reward</p>
                    <progress value={state.online.seconds / 3600} max={h} />
                    <p>
                      {state.online.milestones.includes(h)
                        ? "Sent to Reward Inbox"
                        : `${Math.min(100, Math.floor(state.online.seconds / (h * 36)))}% complete`}
                    </p>
                  </article>
                ))}
              </div>
              <button onClick={() => setScreen("inbox")}>
                Open Reward Inbox →
              </button>
              <p className="muted">
                A connection can resume within 10 minutes, but unobserved time
                earns no rewards. No fabricated online time is added.
              </p>
            </>
          )}
          {screen === "limited" && (
            <>
              <Title
                label="A MOMENT IN TIME"
                title="The moonlit collection."
                text="Monthly collections follow the Asia/Bangkok calendar. Earn Limited fish through online milestones or rare recycling rewards."
              />
              <section className="limited-hero">
                <span>☾</span>
                <div>
                  <small>CURRENT COLLECTION · {state.month}</small>
                  <h2>Moonlit tides</h2>
                  <p>
                    Choose Sunrise or Moonlight when claiming a milestone
                    reward.
                  </p>
                  <button onClick={() => setScreen("rewards")}>
                    View online milestones →
                  </button>
                </div>
              </section>
              <div className="milestones">
                {["sunrise", "moonlight"].map((v) => (
                  <article className="panel" key={v}>
                    <span className="large-icon">
                      {v === "sunrise" ? "☀" : "☾"}
                    </span>
                    <h3>{v === "sunrise" ? "Sunrise" : "Moonlight"}</h3>
                    <p>
                      {state.collection.some(
                        (c) =>
                          c.month === (historyMonth || state.month) &&
                          c.variant === v,
                      )
                        ? "Discovered ✓"
                        : "Awaiting discovery"}{" "}
                      · {historyMonth || state.month}
                    </p>
                  </article>
                ))}
              </div>
              <h2>Collection journal · {state.collection.length} discovered</h2>
              <label>
                Browse history
                <select
                  value={historyMonth}
                  onChange={(e) => setHistoryMonth(e.target.value)}
                >
                  <option value="">All months</option>
                  {[...state.historicalMonths, state.month]
                    .reverse()
                    .map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                </select>
              </label>
              <div className="fish-grid">
                {state.collection
                  .filter((c) => !historyMonth || c.month === historyMonth)
                  .map((c) => {
                    const f =
                      state.fish.find((f) => f.id === c.fishId) ||
                      state.deliveries.find((d) => d.fish.id === c.fishId)
                        ?.fish;
                    return f ? (
                      fishCard(f, false)
                    ) : (
                      <article className="panel" key={c.fishId}>
                        {c.month} · {RARITIES[c.rarity]} · recorded discovery
                      </article>
                    );
                  })}
              </div>
              <section className="panel">
                <h2>All-Month Pool</h2>
                <p>
                  Eligible historical months:{" "}
                  {state.historicalMonths.join(", ") || "None yet"}. Historical
                  months are selected uniformly.
                </p>
                <p>
                  Recycling ticket Limited chances (separate from main gacha
                  odds):
                </p>
                <div className="odds">
                  {RARITIES.map((r, i) => (
                    <div key={r}>
                      <span>{r}</span>
                      <b>{LIMITED[i]}%</b>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
          {screen === "inbox" && (
            <>
              <Title
                label="SAFE UNTIL YOU’RE READY"
                title="Something for you."
                text="Two separate inboxes. Unlimited deliveries. Nothing expires."
              />
              <div className="inbox-columns">
                <section className="panel">
                  <h2>Reward Inbox</h2>
                  {button("Claim all without selections", () =>
                    act("reward", { all: true }),
                  )}
                  {!state.rewards.length && (
                    <Empty text="Online rewards will arrive here." />
                  )}
                  {state.rewards.slice(0, 100).map((r) => (
                    <div className="inbox-row" key={r.id}>
                      <b>
                        {r.kind === "pearl"
                          ? `${r.value} Pearl`
                          : `${r.value} Limited fish`}
                      </b>
                      <small>
                        {new Date(r.time).toLocaleString()} ·{" "}
                        {r.claimed ? "Claimed" : "Never expires"}
                      </small>
                      {!r.claimed &&
                        (r.selection ? (
                          <div>
                            {button("Choose Sunrise", () =>
                              act("reward", { id: r.id, selection: "sunrise" }),
                            )}
                            {button("Choose Moonlight", () =>
                              act("reward", {
                                id: r.id,
                                selection: "moonlight",
                              }),
                            )}
                          </div>
                        ) : (
                          button("Claim reward", () =>
                            act("reward", { id: r.id }),
                          )
                        ))}
                    </div>
                  ))}
                </section>
                <section className="panel">
                  <h2>Delivery Inbox</h2>
                  {button("Claim all deliveries", () =>
                    act("delivery", { all: true }),
                  )}
                  {!state.deliveries.length && (
                    <Empty text="Your purchases and deliveries will arrive here." />
                  )}
                  {state.deliveries.slice(0, 100).map((d) => (
                    <div className="inbox-row" key={d.id}>
                      <FishIcon fish={d.fish} />
                      <b>{d.fish.name}</b>
                      <small>
                        {d.reason} · {new Date(d.time).toLocaleString()}
                      </small>
                      {d.claimed ? (
                        <span>Claimed</span>
                      ) : (
                        button("Move to storage", () =>
                          act("delivery", { id: d.id }),
                        )
                      )}
                    </div>
                  ))}
                </section>
              </div>
            </>
          )}
          {screen === "inventory" && (
            <>
              <Title
                label="THE TREASURE CHEST"
                title="Little things, big possibilities."
                text="Recycling tickets are non-tradable unique items. Each creates one fish at its rarity or higher."
              />
              <div className="fish-grid">
                {state.items
                  .filter((i) => i.type === "ticket")
                  .map((i) => (
                    <article className="panel" key={i.id}>
                      <span
                        className="large-icon"
                        style={{ color: COLORS[i.rarity] }}
                      >
                        ◈
                      </span>
                      <h3>{RARITIES[i.rarity]} ticket</h3>
                      <p>
                        Same rarity or higher · Limited chance{" "}
                        {LIMITED[i.rarity]}%
                      </p>
                      {button("Open ticket", () => act("ticket", { id: i.id }))}
                    </article>
                  ))}
              </div>
              <section className="panel">
                <h2>A little extra care</h2>
                <p>
                  Fish food adds one hour of growth progress per serving. Age
                  and DNA stay unchanged. Stackable food is split into stacks of
                  at most 999.
                </p>
                <form
                  className="toolbar"
                  onSubmit={(e) => {
                    e.preventDefault();
                    act("buyFood", {
                      count: Number(new FormData(e.target).get("count")),
                    });
                  }}
                >
                  <label>
                    Food quantity
                    <input
                      name="count"
                      type="number"
                      min="1"
                      max="9999"
                      defaultValue="1"
                      required
                    />
                  </label>
                  <button disabled={locked}>Buy food · 20 Pearl each</button>
                </form>
                {state.items
                  .filter((i) => i.type === "food")
                  .map((i) => (
                    <form
                      className="toolbar"
                      key={i.id}
                      onSubmit={(e) => {
                        e.preventDefault();
                        act("feed", {
                          id: i.id,
                          fishId: new FormData(e.target).get("fishId"),
                        });
                      }}
                    >
                      <span>Food ×{i.count} / 999</span>
                      <label>
                        Growing fish
                        <select
                          name="fishId"
                          aria-label="Growing fish"
                          required
                        >
                          <option value="">Choose a young fish</option>
                          {state.fish
                            .filter((f) => f.growth < 1)
                            .map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.name} · {Math.round(f.growth * 100)}% grown ·{" "}
                                {f.id.slice(0, 4)}
                              </option>
                            ))}
                        </select>
                      </label>
                      <button
                        disabled={
                          locked || !state.fish.some((f) => f.growth < 1)
                        }
                      >
                        Feed one serving
                      </button>
                    </form>
                  ))}
              </section>
              {!state.items.some((i) => i.type === "ticket") && (
                <Empty text="Recycle 10 fish of the same rarity to receive a ticket." />
              )}
            </>
          )}
          {screen === "customize" && (
            <>
              <Title
                label="MAKE ROOM FOR WONDER"
                title="Your ocean, your way."
                text="Choose a backdrop, grow a garden, and give your fish more room."
              />
              <Aquarium
                fish={tank}
                theme={state.theme}
                decor={state.decorations[0]}
                onSelect={setSelected}
              />
              <section className="panel">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    act("decorate", Object.fromEntries(new FormData(e.target)));
                  }}
                >
                  <label>
                    Environment
                    <select name="theme" defaultValue={state.theme}>
                      <option value="lagoon">Emerald lagoon</option>
                      <option value="midnight">Midnight reef</option>
                      <option value="coral">Coral cove</option>
                    </select>
                  </label>
                  <label>
                    Decorations
                    <select name="decor" defaultValue={state.decorations[0]}>
                      <option value="garden">Swaying sea garden</option>
                      <option value="ruins">Sunken ruins</option>
                      <option value="minimal">Quiet stones</option>
                    </select>
                  </label>
                  <button className="primary" disabled={locked}>
                    Save aquarium style · free
                  </button>
                </form>
              </section>
              <section className="panel">
                <h2>A little more room</h2>
                <p>Capacity: {state.tank} fish</p>
                {button(`Expand +6 · ${fmt(state.tank * 100)} ◈`, () =>
                  act("upgrade", { kind: "tank" }),
                )}
              </section>
            </>
          )}
          {screen === "profile" && (
            <>
              <Title
                label="THE EXPLORER"
                title={state.username}
                text={`Aquarium keeper since ${new Date(state.created).toLocaleDateString()}`}
              />
              <section className="panel">
                <h2>Your story in numbers</h2>
                <p>
                  {state.fish.length} fish · {state.collection.length} Limited
                  discoveries · {hours(state.online.total)} online
                </p>
                <p>Player ID: {state.id}</p>
                <p>
                  Cloud saves are stored on this server. Keep your password and
                  recovery code safe.
                </p>
                <button
                  onClick={async () => {
                    try {
                      await api("logout", {});
                      localStorage.removeItem("dreamAquarium");
                      setState(null);
                    } catch (e) {
                      setNotice(e.message);
                    }
                  }}
                >
                  Sign out
                </button>
              </section>
              <section className="panel">
                <h2>Pearl ledger</h2>
                {!state.ledger.length && <p>Welcome gift: 3,000 Pearl</p>}
                {state.ledger.slice(0, 100).map((l) => (
                  <div className="ledger-row" key={l.id}>
                    <span>
                      {l.reason}
                      <small>{new Date(l.time).toLocaleString()}</small>
                    </span>
                    <b style={{ color: l.delta > 0 ? "#8ce8bf" : "#f2b6aa" }}>
                      {l.delta > 0 ? "+" : ""}
                      {fmt(l.delta)} ◈
                    </b>
                  </div>
                ))}
              </section>
            </>
          )}
          {screen === "settings" && (
            <>
              <Title
                label="YOUR COMFORT ZONE"
                title="A quieter kind of play."
                text="Fine-tune the experience for your device."
              />
              <section className="panel">
                <label>
                  Animation quality
                  <select
                    value={quality}
                    onChange={(e) => {
                      setQuality(e.target.value);
                      localStorage.setItem("dreamQuality", e.target.value);
                    }}
                  >
                    <option value="high">High · full particles</option>
                    <option value="low">Low · fewer particles</option>
                  </select>
                </label>
                <h3>Connection & privacy</h3>
                <p>
                  {online ? "Connected to game server" : "Offline view only"}. A
                  cached aquarium is kept on this browser for offline viewing.
                  All ownership and Pearl are authoritative on the server.
                </p>
                <button onClick={refresh}>Synchronize server state</button>
                <button
                  onClick={() => {
                    localStorage.removeItem("dreamAquarium");
                    setNotice(
                      "Local offline cache cleared. Server data is unchanged.",
                    );
                  }}
                >
                  Clear offline cache
                </button>
                <h3>Account recovery</h3>
                <p>
                  Use the recovery code saved at registration on the sign-in
                  screen. Recovering rotates the code and signs out all older
                  sessions. No external email service is required.
                </p>
              </section>
            </>
          )}
          <footer>
            DREAM AQUARIUM <span>A little wonder, every day.</span>
            <small>Server-authoritative · Pearl only</small>
          </footer>
        </main>
      </div>
      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Fish details"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="close"
              aria-label="Close fish details"
              onClick={() => setSelected(null)}
            >
              ×
            </button>
            <FishIcon fish={selected} />
            <span
              className="eyebrow"
              style={{ color: COLORS[selected.rarity] }}
            >
              {RARITIES[selected.rarity]}{" "}
              {selected.limited && `· ${selected.limited} Limited`}
            </span>
            <h2>{selected.name}</h2>
            <p>
              Generation {selected.generation} ·{" "}
              {selected.growth >= 1
                ? "Mature"
                : `${Math.round((selected.growth || 0) * 100)}% grown`}{" "}
              · Born {new Date(selected.born).toLocaleDateString()}
            </p>
            <progress value={selected.growth || 0} max="1" />
            <h3>Genetic fingerprint</h3>
            {selected.parents.length > 0 && (
              <div className="card-actions">
                {selected.parents.map((id, i) => (
                  <button
                    key={id}
                    onClick={async () => {
                      try {
                        setSelected(await api("lineage/" + id));
                      } catch (e) {
                        setNotice(e.message);
                      }
                    }}
                  >
                    View ancestor {i + 1}
                  </button>
                ))}
              </div>
            )}
            <div className="dna-grid">
              {Object.entries(selected.dna).map(([k, v]) => (
                <div key={k}>
                  <small>{k}</small>
                  <b>
                    {typeof v === "number" ? v.toFixed(3) : v ? "Yes" : "No"}
                  </b>
                </div>
              ))}
            </div>
            <p className="muted">
              ID {selected.id}
              <br />
              Parents{" "}
              {selected.parents.length
                ? selected.parents.join(" × ")
                : "Wild discovery"}
            </p>
            {state.fish.some((f) => f.id === selected.id) && (
              <div className="card-actions">
                {button(
                  selected.location === "tank"
                    ? "Move to storage"
                    : "Move to aquarium",
                  async () => {
                    const s = await act("move", {
                      id: selected.id,
                      location:
                        selected.location === "tank" ? "storage" : "tank",
                    });
                    if (s) setSelected(null);
                  },
                )}
                {button(
                  "Release permanently",
                  async () => {
                    if (
                      confirm(
                        "Permanently release this fish? This cannot be undone.",
                      )
                    ) {
                      const s = await act("release", {
                        id: selected.id,
                        confirm: true,
                      });
                      if (s) setSelected(null);
                    }
                  },
                  { className: "danger" },
                )}
              </div>
            )}
          </section>
        </div>
      )}
      {recoveryCode && (
        <div className="modal-backdrop">
          <section className="modal" role="dialog" aria-label="Recovery code">
            <span className="eyebrow">KEEP YOUR AQUARIUM SAFE</span>
            <h2>Save your recovery code.</h2>
            <p>
              This is shown once. Store it somewhere private. It can reset your
              password without email.
            </p>
            <code className="recovery">{recoveryCode}</code>
            <button className="primary" onClick={() => setRecoveryCode("")}>
              I have saved my recovery code
            </button>
          </section>
        </div>
      )}
      {notice && (
        <div className="toast" role="alert">
          {notice}
        </div>
      )}
    </div>
  );
}
function Title({ label, title, text }) {
  return (
    <div className="page-title">
      <div>
        <span className="eyebrow">{label}</span>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
    </div>
  );
}
function Empty({ text }) {
  return (
    <div className="empty">
      <span>≈</span>
      <p>{text}</p>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);

if (import.meta.env.PROD && "serviceWorker" in navigator)
  navigator.serviceWorker.register("/sw.js").catch(() => {});
