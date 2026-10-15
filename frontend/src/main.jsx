import {
  t,
  useI18n,
  sourceKeys,
  systemMessage,
  number,
  date,
  dateTime,
  getLocale,
  duration,
} from "./i18n/index.js";
import GlobalControls from "./GlobalControls.jsx";
import { audio } from "./audio.js";
import React, { useEffect, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import Aquarium, { FishIcon } from "./Aquarium.jsx";
import {
  RARITIES as RARITY_NAMES,
  COLORS,
  ODDS,
  LIMITED,
  ROLLS,
  MARKET_UPGRADES,
  MILESTONES,
} from "../../shared/rules.js";
import "./style.css";
const fmt = (n) => number(Math.floor(n || 0));
const hours = duration;
const wait = (end, at = Date.now()) => {
  const s = Math.max(0, Math.ceil((end - at) / 1000));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
    .map((n, i) =>
      number(n, { minimumIntegerDigits: i ? 2 : 1, useGrouping: false }),
    )
    .join(":");
};
const API_BASE = (import.meta.env.VITE_API_URL || " ")
  .trim()
  .replace(/\/$/, "");
const TOKEN_KEY = "dreamSession:" + API_BASE;
async function api(path, body, key) {
  const r = await fetch(API_BASE + "/api/" + path, {
    credentials: API_BASE ? "omit" : "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(API_BASE && sessionStorage.getItem(TOKEN_KEY)
        ? {
            Authorization: "Bearer " + sessionStorage.getItem(TOKEN_KEY),
          }
        : {}),
      ...(key
        ? {
            "Idempotency-Key": key,
          }
        : {}),
    },
    ...(body
      ? {
          method: "POST",
          body: JSON.stringify(body),
        }
      : {}),
  });
  let data;
  try {
    data = await r.json();
  } catch {
    throw Error("Cannot reach server");
  }
  if (data.sessionToken) sessionStorage.setItem(TOKEN_KEY, data.sessionToken);
  if (r.status === 401) sessionStorage.removeItem(TOKEN_KEY);
  if (path === "logout" && r.ok) sessionStorage.removeItem(TOKEN_KEY);
  if (!r.ok) {
    const e = Error(data.error);
    e.status = r.status;
    throw e;
  }
  return data;
}
const nav = [
  ["aquarium", "◉", "ui.aquarium"],
  ["collection", "▦", "ui.fish_storage"],
  ["breed", "♡", "ui.breeding"],
  ["gacha", "✧", "ui.discovery"],
  ["market", "⇄", "ui.marketplace"],
  ["rewards", "◷", "ui.online_rewards"],
  ["limited", "☾", "ui.monthly_collection"],
  ["inbox", "✉", "ui.inboxes"],
  ["inventory", "◈", "ui.inventory"],
  ["customize", "❋", "ui.customize"],
  ["profile", "◎", "ui.profile"],
  ["settings", "⚙", "ui.settings"],
];
function App() {
  useI18n();
  useEffect(() => audio.attach(), []);
  const RARITIES = RARITY_NAMES.map((name) => t(sourceKeys[name]));
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
      JSON.stringify({
        ...cached,
        listings: [],
        ledger: [],
        sales: [],
      }),
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
        api(
          "action",
          {
            type: "heartbeat",
          },
          crypto.randomUUID(),
        )
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
    audio.effect("notification");
    const t = setTimeout(() => setNotice(""), 7000);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    if (selected) audio.effect("fish");
  }, [selected?.id]);
  const locked = !online || state?.maintenance || busy;
  async function act(type, payload = {}) {
    if (locked) return;
    setBusy(true);
    const signature = JSON.stringify({
      type,
      payload,
    });
    if (!pending.current || pending.current.signature !== signature)
      pending.current = {
        signature,
        key: crypto.randomUUID(),
      };
    try {
      const s = await api(
        "action",
        {
          type,
          payload,
        },
        pending.current.key,
      );
      pending.current = null;
      audio.effect(
        type === "breed"
          ? "breed"
          : type === "gacha"
            ? "discovery"
            : ["reward", "delivery"].includes(type)
              ? "reward"
              : ["buy", "bid", "list"].includes(type)
                ? "trade"
                : "success",
      );
      accept(s);
      setNotice("Saved to your aquarium");
      return s;
    } catch (e) {
      setNotice(e.message);
      if (e.status && e.status < 500) pending.current = null;
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
        <span
          style={{
            color: COLORS[f.rarity],
          }}
        >
          {RARITIES[f.rarity]}
        </span>
      </div>
      <small>
        {f.limited
          ? t("ui.value0_limited", {
              p0: f.limited,
            })
          : t("ui.generation_value0_value1", {
              p0: f.generation,
              p1:
                f.growth >= 1
                  ? t("ui.adult")
                  : t("ui.value0_grown", {
                      p0: number(Math.round((f.growth || 0) * 100)),
                    }),
            })}
      </small>
      {actions && (
        <div className="card-actions">
          {button(
            f.location === "tank" ? t("ui.store") : t("ui.add_to_tank"),
            () =>
              act("move", {
                id: f.id,
                location: f.location === "tank" ? "storage" : "tank",
              }),
            {
              className: "subtle",
            },
          )}
          <label className="check">
            <input
              type="checkbox"
              aria-label={t("ui.select_value0", {
                p0: f.name,
              })}
              checked={chosen.includes(f.id)}
              onChange={(e) =>
                setChosen(
                  e.target.checked
                    ? [...chosen, f.id]
                    : chosen.filter((id) => id !== f.id),
                )
              }
            />
            {t("ui.recycle")}
          </label>
        </div>
      )}
    </article>
  );
  if (loading && !state)
    return (
      <main className="loading">
        <div className="auth-controls">
          <GlobalControls />
        </div>
        <span className="brand-mark">◉</span>
        <h1>{t("ui.entering_your_sanctuary")}</h1>
      </main>
    );
  if (!state)
    return (
      <main className="auth">
        <div className="auth-controls">
          <GlobalControls />
        </div>
        <div className="auth-art">
          <div className="brand">◉ DREAM AQUARIUM</div>
          <h1>
            {t("ui.a_little_ocean")}
            <br />
            {t("ui.an_endless_discovery")}
          </h1>
          <p>
            {t("ui.raise_extraordinary_fish_discover_their_stories")}
            <br />
            {t("ui.make_a_world_that_is_entirely_yours")}
          </p>
          <Aquarium
            fish={Array.from(
              {
                length: 7,
              },
              (_, i) => ({
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
              }),
            )}
            theme="lagoon"
            decor="garden"
            onSelect={() => {}}
          />
        </div>
        <section className="auth-form">
          <span className="eyebrow">
            {t("ui.your_underwater_world_awaits")}
          </span>
          <h2>
            {authMode === "register"
              ? t("ui.begin_your_journey")
              : authMode === "recover"
                ? t("ui.recover_your_aquarium")
                : t("ui.welcome_back")}
          </h2>
          <p>
            {t("ui.cloud_saved_fish_a_living_collection_your_own_quiet_escape")}
          </p>
          <form onSubmit={authenticate}>
            <label>
              {t("ui.username")}
              <input
                name="username"
                autoComplete="username"
                required
                minLength="3"
                maxLength="24"
                pattern="[a-zA-Z0-9_]+"
                placeholder={t("ui.your_explorer_name")}
              />
            </label>
            <label>
              {authMode === "recover" ? t("ui.new_password") : t("ui.password")}
              <input
                name="password"
                type="password"
                autoComplete={
                  authMode === "login" ? "current-password" : "new-password"
                }
                required
                minLength="10"
                maxLength="128"
                placeholder={t("ui.at_least_10_characters")}
              />
            </label>
            {authMode === "recover" && (
              <label>
                {t("ui.recovery_code")}
                <input name="recovery" required />
              </label>
            )}
            <button className="primary" disabled={busy}>
              {busy
                ? t("ui.connecting")
                : authMode === "register"
                  ? t("ui.create_aquarium")
                  : authMode === "recover"
                    ? t("ui.reset_password")
                    : t("ui.enter_aquarium")}
            </button>
          </form>
          <div className="auth-links">
            <button
              onClick={() =>
                setAuthMode(authMode === "login" ? "register" : "login")
              }
            >
              {authMode === "login"
                ? t("ui.create_an_account")
                : t("ui.i_already_have_an_account")}
            </button>
            <button onClick={() => setAuthMode("recover")}>
              {t("ui.recover_account")}
            </button>
          </div>
          <small>
            {t(
              "ui.no_real_money_purchases_your_first_5_fish_and_3_000_pearl_are_included",
            )}
          </small>
        </section>
        {notice && (
          <div role="alert" className="toast">
            {systemMessage(notice)}
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
          : a.name.localeCompare(b.name, getLocale()),
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
        <div className="nav-label">{t("ui.your_sanctuary")}</div>
        <nav>
          {nav.map(([id, icon, label]) => (
            <button
              key={id}
              aria-label={t(label)}
              className={screen === id ? "active" : ""}
              onClick={() => setScreen(id)}
            >
              <span>{icon}</span>
              {t(label)}
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
            ? t("ui.maintenance")
            : online
              ? t("ui.cloud_connected")
              : t("ui.offline_view_only")}
          <small>{t("ui.made_for_a_slower_moment")}</small>
        </div>
      </aside>
      <div className="workspace">
        <header>
          <div className="breadcrumb">
            {t("ui.your_sanctuary_e88dad")} <span>/</span>{" "}
            <b>{t(nav.find((n) => n[0] === screen)?.[2])}</b>
          </div>
          <div className="top-right">
            <GlobalControls />
            <span className="pearl">
              ◈ <b>{fmt(state.pearls)}</b> <small>{t("ui.pearl")}</small>
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
                ? t(
                    "ui.maintenance_in_progress_transactions_and_online_time_are_paused_your_fish_are_safe",
                  )
                : t(
                    "ui.connection_lost_this_is_your_cached_aquarium_changes_are_disabled_until_the_server_reconnects",
                  )}
              <button onClick={refresh}>{t("ui.reconnect")}</button>
            </div>
          )}
          {screen === "aquarium" && (
            <>
              <div className="page-title">
                <div>
                  <span className="eyebrow">{t("ui.a_world_of_your_own")}</span>
                  <h1>
                    {t("ui.your_little_ocean")}
                    <span>.</span>
                  </h1>
                  <p>
                    {t(
                      "ui.take_a_breath_there_s_always_something_beautiful_happening",
                    )}
                  </p>
                </div>
                <button
                  className="outline"
                  onClick={() => setScreen("customize")}
                >
                  {t("ui.customize_aquarium")}
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
                      ? t("ui.midnight_reef")
                      : state.theme === "coral"
                        ? t("ui.coral_cove")
                        : t("ui.emerald_lagoon")}
                  </span>
                  <span className="glass-pill">
                    {tank.length} / {state.tank} {t("ui.fish")}
                  </span>
                </div>
                <div className="tank-caption">
                  <span>{t("ui.your_living_aquarium")}</span>
                  <h2>{t("ui.a_moment_of_wonder")}</h2>
                  <p>{t("ui.tap_a_fish_to_discover_its_story")}</p>
                </div>
                <div className="water-label">
                  {t("ui.procedurally_unique_always_alive")}
                </div>
              </section>
              <div className="stats-row">
                <div>
                  <span>◈</span>
                  <section>
                    <small>{t("ui.your_collection")}</small>
                    <b>
                      {fmt(state.fish.length)} <i>{t("ui.unique_fish")}</i>
                    </b>
                  </section>
                </div>
                <div>
                  <span>♡</span>
                  <section>
                    <small>{t("ui.nursery")}</small>
                    <b>
                      {state.breeds.filter((b) => !b.claimed).length}{" "}
                      <i>{t("ui.breeding_pairs")}</i>
                    </b>
                  </section>
                  <button
                    aria-label={t("ui.breeding")}
                    onClick={() => setScreen("breed")}
                  >
                    <svg
                      aria-hidden="true"
                      width="14"
                      height="14"
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="currentColor"
                    >
                      <path d="M4 16 16 4M5 4h11v11" />
                    </svg>
                  </button>
                </div>
                <div>
                  <span>◷</span>
                  <section>
                    <small>{t("ui.time_to_unwind")}</small>
                    <b>
                      {hours(state.online.seconds)} <i>{t("ui.this_month")}</i>
                    </b>
                  </section>
                  <button
                    aria-label={t("ui.online_rewards")}
                    onClick={() => setScreen("rewards")}
                  >
                    <svg
                      aria-hidden="true"
                      width="14"
                      height="14"
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="currentColor"
                    >
                      <path d="M4 16 16 4M5 4h11v11" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="section-title">
                <h2>
                  {t("ui.swimming_in_your_sanctuary")}{" "}
                  <span>{tank.length}</span>
                </h2>
                <button onClick={() => setScreen("collection")}>
                  {t("ui.view_collection")}
                </button>
              </div>
              <div className="fish-grid">
                {tank.map((f) => fishCard(f, false))}
              </div>
              <div className="discover-banner">
                <span>✧</span>
                <div>
                  <small>{t("ui.a_new_discovery_is_waiting")}</small>
                  <h2>{t("ui.every_fish_has_a_story_written_in_its_dna")}</h2>
                  <p>
                    {t(
                      "ui.discover_new_colors_extraordinary_fins_and_a_little_bit_of_magic",
                    )}
                  </p>
                </div>
                <button onClick={() => setScreen("gacha")}>
                  {t("ui.discover_fish")}
                </button>
              </div>
            </>
          )}
          {screen === "collection" && (
            <>
              <Title
                label={t("ui.your_living_library")}
                title={t("ui.every_fish_a_discovery")}
                text={t(
                  "ui.value0_fish_value1_value2_storage_value3_value4_aquarium",
                  {
                    p0: state.fish.length,
                    p1: state.fish.filter((f) => f.location === "storage")
                      .length,
                    p2: state.storage,
                    p3: tank.length,
                    p4: state.tank,
                  },
                )}
              />
              <div className="toolbar">
                <input
                  aria-label={t("ui.search_fish")}
                  placeholder={t("ui.search_fish_or_dna_id")}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <select
                  aria-label={t("ui.filter_rarity")}
                  value={tier}
                  onChange={(e) => setTier(e.target.value)}
                >
                  <option value="all">{t("ui.all_rarities")}</option>
                  {RARITIES.map((r, i) => (
                    <option value={i} key={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <select
                  aria-label={t("ui.sort_fish")}
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="rarity">{t("ui.rarity")}</option>
                  <option value="age">{t("ui.age")}</option>
                  <option value="name">{t("ui.name")}</option>
                </select>
                {button(
                  t("ui.expand_storage_value0", {
                    p0: fmt(state.storage * 2),
                  }),
                  () =>
                    act("upgrade", {
                      kind: "storage",
                    }),
                )}
                {button(
                  t("ui.recycle_value0_10", {
                    p0: chosen.length,
                  }),
                  async () => {
                    const s = await act("recycle", {
                      ids: chosen,
                    });
                    if (s) setChosen([]);
                  },
                )}
              </div>
              <p className="muted">
                {t(
                  "ui.select_10_non_limited_fish_of_the_same_rarity_to_receive_one_non_tradable_recycling_ticket",
                )}
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
                    {t("ui.previous")}
                  </button>
                  <span>
                    {t("ui.page")} {fishPage} / {Math.ceil(fishes.length / 60)}
                  </span>
                  <button
                    disabled={fishPage >= Math.ceil(fishes.length / 60)}
                    onClick={() => setFishPage((p) => p + 1)}
                  >
                    {t("ui.next")}
                  </button>
                </div>
              )}
              {!fishes.length && (
                <Empty text={t("ui.no_fish_match_your_search")} />
              )}
            </>
          )}
          {screen === "breed" && (
            <>
              <Title
                label={t("ui.the_nursery")}
                title={t("ui.a_new_generation")}
                text={t(
                  "ui.two_mature_parents_inherited_dna_endless_possibilities",
                )}
              />
              <section className="panel">
                <div className="parent-pair">
                  {[0, 1].map((i) => (
                    <div key={i}>
                      <label>
                        {t("ui.parent")} {i + 1}
                        <select
                          aria-label={t("ui.parent_value0", {
                            p0: i + 1,
                          })}
                          value={parents[i]}
                          onChange={(e) =>
                            setParents(
                              parents.map((p, j) =>
                                j === i ? e.target.value : p,
                              ),
                            )
                          }
                        >
                          <option value="">
                            {t("ui.choose_a_mature_fish")}
                          </option>
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
                  {t(
                    "ui.1_2_offspring_based_on_fertility_2_minute_incubation_8_color_mutation_chance_most_offspring_inh",
                  )}
                </p>
                {button(
                  t("ui.begin_breeding_200"),
                  () =>
                    act("breed", {
                      a: parents[0],
                      b: parents[1],
                    }),
                  {
                    className: "primary",
                  },
                )}
              </section>
              <h2>{t("ui.breeding_journal")}</h2>
              {state.breeds
                .slice()
                .reverse()
                .map((b) => (
                  <article className="panel" key={b.id}>
                    <b>
                      {t("ui.generation")} {b.children[0].generation} ·{" "}
                      {b.children.length} {t("ui.offspring")}
                    </b>
                    <p>
                      {t("ui.parents")}{" "}
                      {b.parents
                        .map(
                          (id) =>
                            state.fish.find((f) => f.id === id)?.name ||
                            id.slice(0, 8),
                        )
                        .join(" × ")}
                    </p>
                    {b.claimed ? (
                      <span className="badge">
                        {t("ui.welcomed_to_collection")}
                      </span>
                    ) : Date.now() >= b.ready ? (
                      button(t("ui.welcome_offspring"), () =>
                        act("breedClaim", {
                          id: b.id,
                        }),
                      )
                    ) : (
                      <span className="badge">
                        {t("ui.incubating")} {wait(b.ready)}
                      </span>
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
                label={t("ui.the_discovery_pool")}
                title={t("ui.meet_the_unexpected")}
                text={t(
                  "ui.every_discovery_is_genetically_unique_pearl_only_no_pity_system",
                )}
              />
              <div className="gacha-hero">
                <span className="orb">✧</span>
                <h2>
                  {t("ui.a_thousand_possibilities")}
                  <br />
                  {t("ui.one_little_ocean")}
                </h2>
                <p>{t("ui.new_discoveries_arrive_in_your_storage")}</p>
                <div className="roll-buttons">
                  {Object.entries(ROLLS).map(([n, c]) =>
                    button(
                      t("ui.discover_value0_value1", {
                        p0: Number(n),
                        p1: fmt(c),
                      }),
                      async () => {
                        const s = await act("gacha", {
                          count: Number(n),
                        });
                        if (s)
                          setRolls(
                            s.fish.filter((f) => s.lastRoll.includes(f.id)),
                          );
                      },
                      {
                        key: n,
                        className: Number(n) === 1 ? "primary" : "",
                      },
                    ),
                  )}
                </div>
              </div>
              <div className="odds">
                {RARITIES.map((r, i) => (
                  <div key={r}>
                    <span
                      style={{
                        color: COLORS[i],
                      }}
                    >
                      ✧ {r}
                    </span>
                    <b>{ODDS[i]}%</b>
                  </div>
                ))}
              </div>
              <p className="muted">
                {t(
                  "ui.bulk_discounts_10_10_100_15_1000_20_storage_space_and_sufficient_pearl_are_required",
                )}
              </p>
              {rolls && (
                <>
                  <h2>
                    {t("ui.your_discoveries")} {rolls.length}
                  </h2>
                  <div className="fish-grid">
                    {rolls.slice(0, 100).map((f) => fishCard(f, false))}
                  </div>
                  {rolls.length > 100 && (
                    <p>
                      {t("ui.showing_first_100_results_all")} {rolls.length}{" "}
                      {t("ui.are_in_fish_storage")}
                    </p>
                  )}
                </>
              )}
            </>
          )}
          {screen === "market" && (
            <>
              <Title
                label={t("ui.the_trading_harbor")}
                title={t("ui.find_a_new_favorite")}
                text={t(
                  "ui.trade_with_real_players_fish_are_held_safely_in_escrow_completed_sales_have_a_10_tax",
                )}
              />
              <div className="toolbar">
                <input
                  aria-label={t("ui.search_marketplace")}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("ui.search_seller_or_fish")}
                />
                <select
                  value={marketType}
                  onChange={(e) => setMarketType(e.target.value)}
                  aria-label={t("ui.listing_type")}
                >
                  <option value="all">{t("ui.all_listings")}</option>
                  <option value="fixed">{t("ui.buy_now")}</option>
                  <option value="auction">{t("ui.auctions")}</option>
                  <option value="mine">{t("ui.my_listings")}</option>
                </select>
                <select
                  aria-label={t("ui.market_rarity")}
                  value={tier}
                  onChange={(e) => setTier(e.target.value)}
                >
                  <option value="all">{t("ui.all_rarities")}</option>
                  {RARITIES.map((r, i) => (
                    <option key={r} value={i}>
                      {r}
                    </option>
                  ))}
                </select>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  aria-label={t("ui.market_sort")}
                >
                  <option value="rarity">{t("ui.rarity")}</option>
                  <option value="price">{t("ui.lowest_price")}</option>
                  <option value="ending">{t("ui.ending_soon")}</option>
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
                      <small
                        style={{
                          color: COLORS[l.fish.rarity],
                        }}
                      >
                        {RARITIES[l.fish.rarity]}
                      </small>
                    </h3>
                    <small>
                      {t("ui.by")} {l.seller_name} ·{" "}
                      {l.type === "fixed" ? t("ui.buy_now") : t("ui.auction")}
                    </small>
                    <p className="price">◈ {fmt(l.bid || l.price)}</p>
                    {l.end_at && (
                      <p>
                        {t("ui.remaining")}{" "}
                        {wait(
                          l.end_at,
                          state.maintenance
                            ? state.maintenanceSince
                            : Date.now(),
                        )}
                        {l.bidder === state.id ? t("ui.you_lead") : ""}
                      </p>
                    )}
                    {l.seller === state.id ? (
                      button(
                        t("ui.cancel_listing"),
                        () =>
                          act("cancel", {
                            id: l.id,
                          }),
                        {
                          disabled: locked || !!l.bidder,
                          title: l.bidder
                            ? t("ui.cannot_cancel_with_active_bids")
                            : "",
                        },
                      )
                    ) : (
                      <>
                        {(l.type === "fixed" || l.buyout) &&
                          button(
                            t("ui.buy_value0", {
                              p0: fmt(l.type === "fixed" ? l.price : l.buyout),
                            }),
                            () => {
                              if (confirm(t("ui.purchase_this_fish")))
                                act("buy", {
                                  id: l.id,
                                });
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
                              aria-label={t("ui.bid_amount")}
                              type="number"
                              min={Math.max(l.price, l.bid + 1)}
                              defaultValue={Math.max(l.price, l.bid + 1)}
                              required
                            />
                            <button disabled={locked}>
                              {t("ui.place_bid")}
                            </button>
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
                    {t("ui.previous")}
                  </button>
                  <span>
                    {t("ui.page")} {marketData.page} / {marketData.pages} ·{" "}
                    {marketData.total} {t("ui.listings")}
                  </span>
                  <button
                    disabled={marketPage >= marketData.pages}
                    onClick={() => setMarketPage((p) => p + 1)}
                  >
                    {t("ui.next")}
                  </button>
                </div>
              )}
              {!(marketData?.items || state.listings).length && (
                <Empty
                  text={t(
                    "ui.the_harbor_is_quiet_list_one_of_your_fish_below_or_invite_another_player",
                  )}
                />
              )}
              <section className="panel">
                <h2>{t("ui.create_a_listing")}</h2>
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
                    {t("ui.fish_3f3f8b")}
                    <select name="id" required>
                      <option value="">{t("ui.choose_your_fish")}</option>
                      {state.fish.map((f) => (
                        <option value={f.id} key={f.id}>
                          {f.name} · {RARITIES[f.rarity]} · {f.id.slice(0, 4)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t("ui.type")}
                    <select name="type">
                      <option value="fixed">
                        {t("ui.buy_now_never_expires")}
                      </option>
                      <option value="auction">{t("ui.auction")}</option>
                    </select>
                  </label>
                  <label>
                    {t("ui.price_starting_bid")}
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
                    {t("ui.auction_duration")}
                    <select name="hours">
                      {[6, 12, 24, 48].map((n) => (
                        <option key={n} value={n}>
                          {n} {t("ui.hours")}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t("ui.optional_auction_buyout")}
                    <input
                      name="buyout"
                      type="number"
                      min="1"
                      placeholder={t("ui.no_buyout")}
                    />
                  </label>
                  <button className="primary" disabled={locked}>
                    {t("ui.create_listing")}
                  </button>
                </form>
              </section>
              <section className="panel">
                <h2>{t("ui.marketplace_expansion")}</h2>
                <p>
                  {10 + state.marketLevel * 10}{" "}
                  {t("ui.slots_maximum_100_total_upgrade_cost_796_000_pearl")}
                </p>
                {state.marketLevel < 9 ? (
                  button(
                    t("ui.add_10_slots_value0", {
                      p0: fmt(MARKET_UPGRADES[state.marketLevel]),
                    }),
                    () =>
                      act("upgrade", {
                        kind: "market",
                      }),
                  )
                ) : (
                  <span>{t("ui.fully_expanded")}</span>
                )}
                <h3>{t("ui.sale_history")}</h3>
                {state.sales.slice(0, 30).map((s, i) => (
                  <p key={i}>
                    {s.fish} · {fmt(s.price)} {t("ui.tax")} {fmt(s.tax)} ◈ ·{" "}
                    {dateTime(s.time)}
                  </p>
                ))}
              </section>
            </>
          )}
          {screen === "rewards" && (
            <>
              <Title
                label={t("ui.time_well_spent")}
                title={t("ui.stay_a_little_longer")}
                text={t(
                  "ui.eligible_online_time_is_measured_by_the_server_hidden_tabs_offline_time_and_maintenance_earn_no",
                )}
              />
              <div className="panel reward-clock">
                <span>
                  {t("ui.this_month_ecb84f")} {state.online.month}{" "}
                  {t("ui.asia_bangkok")}
                </span>
                <h1>{hours(state.online.seconds)}</h1>
                <p>
                  {t("ui.lifetime_eligible_time")} {hours(state.online.total)}
                </p>
                <p>
                  {t("ui.300_pearl_every_3_hours_next_reward_in")}{" "}
                  {hours(10800 - (state.online.total % 10800))}.
                </p>
                <progress value={state.online.total % 10800} max="10800" />
              </div>
              <div className="milestones">
                {MILESTONES.map((h) => (
                  <article className="panel" key={h}>
                    <span className="large-icon">☾</span>
                    <h2>
                      {h} {t("ui.hours")}
                    </h2>
                    <p>{t("ui.monthly_limited_reward")}</p>
                    <progress value={state.online.seconds / 3600} max={h} />
                    <p>
                      {state.online.milestones.includes(h)
                        ? t("ui.sent_to_reward_inbox")
                        : t("ui.value0_complete", {
                            p0: Math.min(
                              100,
                              Math.floor(state.online.seconds / (h * 36)),
                            ),
                          })}
                    </p>
                  </article>
                ))}
              </div>
              <button onClick={() => setScreen("inbox")}>
                {t("ui.open_reward_inbox")}
              </button>
              <p className="muted">
                {t(
                  "ui.a_connection_can_resume_within_10_minutes_but_unobserved_time_earns_no_rewards_no_fabricated_on",
                )}
              </p>
            </>
          )}
          {screen === "limited" && (
            <>
              <Title
                label={t("ui.a_moment_in_time")}
                title={t("ui.the_moonlit_collection")}
                text={t(
                  "ui.monthly_collections_follow_the_asia_bangkok_calendar_earn_limited_fish_through_online_milestone",
                )}
              />
              <section className="limited-hero">
                <span>☾</span>
                <div>
                  <small>
                    {t("ui.current_collection")} {state.month}
                  </small>
                  <h2>{t("ui.moonlit_tides")}</h2>
                  <p>
                    {t(
                      "ui.choose_sunrise_or_moonlight_when_claiming_a_milestone_reward",
                    )}
                  </p>
                  <button onClick={() => setScreen("rewards")}>
                    {t("ui.view_online_milestones")}
                  </button>
                </div>
              </section>
              <div className="milestones">
                {["sunrise", "moonlight"].map((v) => (
                  <article className="panel" key={v}>
                    <span className="large-icon">
                      {v === "sunrise" ? "☀" : "☾"}
                    </span>
                    <h3>
                      {v === "sunrise" ? t("ui.sunrise") : t("ui.moonlight")}
                    </h3>
                    <p>
                      {state.collection.some(
                        (c) =>
                          c.month === (historyMonth || state.month) &&
                          c.variant === v,
                      )
                        ? t("ui.discovered")
                        : t("ui.awaiting_discovery")}{" "}
                      · {historyMonth || state.month}
                    </p>
                  </article>
                ))}
              </div>
              <h2>
                {t("ui.collection_journal")} {state.collection.length}{" "}
                {t("ui.discovered_0c56a4")}
              </h2>
              <label>
                {t("ui.browse_history")}
                <select
                  value={historyMonth}
                  onChange={(e) => setHistoryMonth(e.target.value)}
                >
                  <option value="">{t("ui.all_months")}</option>
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
                        {c.month} · {RARITIES[c.rarity]}{" "}
                        {t("ui.recorded_discovery")}
                      </article>
                    );
                  })}
              </div>
              <section className="panel">
                <h2>{t("ui.all_month_pool")}</h2>
                <p>
                  {t("ui.eligible_historical_months")}{" "}
                  {state.historicalMonths.join(", ") || t("ui.none_yet")}
                  {t("ui.historical_months_are_selected_uniformly")}
                </p>
                <p>
                  {t(
                    "ui.recycling_ticket_limited_chances_separate_from_main_gacha_odds",
                  )}
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
                label={t("ui.safe_until_you_re_ready")}
                title={t("ui.something_for_you")}
                text={t(
                  "ui.two_separate_inboxes_unlimited_deliveries_nothing_expires",
                )}
              />
              <div className="inbox-columns">
                <section className="panel">
                  <h2>{t("ui.reward_inbox")}</h2>
                  {button(t("ui.claim_all_without_selections"), () =>
                    act("reward", {
                      all: true,
                    }),
                  )}
                  {!state.rewards.length && (
                    <Empty text={t("ui.online_rewards_will_arrive_here")} />
                  )}
                  {state.rewards.slice(0, 100).map((r) => (
                    <div className="inbox-row" key={r.id}>
                      <b>
                        {r.kind === "pearl"
                          ? t("ui.value0_pearl", {
                              p0: r.value,
                            })
                          : t("ui.value0_limited_fish", {
                              p0: r.value,
                            })}
                      </b>
                      <small>
                        {dateTime(r.time)} ·{" "}
                        {r.claimed ? t("ui.claimed") : t("ui.never_expires")}
                      </small>
                      {!r.claimed &&
                        (r.selection ? (
                          <div>
                            {button(t("ui.choose_sunrise"), () =>
                              act("reward", {
                                id: r.id,
                                selection: "sunrise",
                              }),
                            )}
                            {button(t("ui.choose_moonlight"), () =>
                              act("reward", {
                                id: r.id,
                                selection: "moonlight",
                              }),
                            )}
                          </div>
                        ) : (
                          button(t("ui.claim_reward"), () =>
                            act("reward", {
                              id: r.id,
                            }),
                          )
                        ))}
                    </div>
                  ))}
                </section>
                <section className="panel">
                  <h2>{t("ui.delivery_inbox")}</h2>
                  {button(t("ui.claim_all_deliveries"), () =>
                    act("delivery", {
                      all: true,
                    }),
                  )}
                  {!state.deliveries.length && (
                    <Empty
                      text={t(
                        "ui.your_purchases_and_deliveries_will_arrive_here",
                      )}
                    />
                  )}
                  {state.deliveries.slice(0, 100).map((d) => (
                    <div className="inbox-row" key={d.id}>
                      <FishIcon fish={d.fish} />
                      <b>{d.fish.name}</b>
                      <small>
                        {systemMessage(d.reason)} · {dateTime(d.time)}
                      </small>
                      {d.claimed ? (
                        <span>{t("ui.claimed")}</span>
                      ) : (
                        button(t("ui.move_to_storage"), () =>
                          act("delivery", {
                            id: d.id,
                          }),
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
                label={t("ui.the_treasure_chest")}
                title={t("ui.little_things_big_possibilities")}
                text={t(
                  "ui.recycling_tickets_are_non_tradable_unique_items_each_creates_one_fish_at_its_rarity_or_higher",
                )}
              />
              <div className="fish-grid">
                {state.items
                  .filter((i) => i.type === "ticket")
                  .map((i) => (
                    <article className="panel" key={i.id}>
                      <span
                        className="large-icon"
                        style={{
                          color: COLORS[i.rarity],
                        }}
                      >
                        ◈
                      </span>
                      <h3>
                        {RARITIES[i.rarity]} {t("ui.ticket")}
                      </h3>
                      <p>
                        {t("ui.same_rarity_or_higher_limited_chance")}{" "}
                        {LIMITED[i.rarity]}%
                      </p>
                      {button(t("ui.open_ticket"), () =>
                        act("ticket", {
                          id: i.id,
                        }),
                      )}
                    </article>
                  ))}
              </div>
              <section className="panel">
                <h2>{t("ui.a_little_extra_care")}</h2>
                <p>
                  {t(
                    "ui.fish_food_adds_one_hour_of_growth_progress_per_serving_age_and_dna_stay_unchanged_stackable_foo",
                  )}
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
                    {t("ui.food_quantity")}
                    <input
                      name="count"
                      type="number"
                      min="1"
                      max="9999"
                      defaultValue="1"
                      required
                    />
                  </label>
                  <button disabled={locked}>
                    {t("ui.buy_food_20_pearl_each")}
                  </button>
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
                      <span>
                        {t("ui.food")}
                        {i.count} / 999
                      </span>
                      <label>
                        {t("ui.growing_fish")}
                        <select
                          name="fishId"
                          aria-label={t("ui.growing_fish")}
                          required
                        >
                          <option value="">
                            {t("ui.choose_a_young_fish")}
                          </option>
                          {state.fish
                            .filter((f) => f.growth < 1)
                            .map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.name} · {Math.round(f.growth * 100)}
                                {t("ui.grown")} {f.id.slice(0, 4)}
                              </option>
                            ))}
                        </select>
                      </label>
                      <button
                        disabled={
                          locked || !state.fish.some((f) => f.growth < 1)
                        }
                      >
                        {t("ui.feed_one_serving")}
                      </button>
                    </form>
                  ))}
              </section>
              {!state.items.some((i) => i.type === "ticket") && (
                <Empty
                  text={t(
                    "ui.recycle_10_fish_of_the_same_rarity_to_receive_a_ticket",
                  )}
                />
              )}
            </>
          )}
          {screen === "customize" && (
            <>
              <Title
                label={t("ui.make_room_for_wonder")}
                title={t("ui.your_ocean_your_way")}
                text={t(
                  "ui.choose_a_backdrop_grow_a_garden_and_give_your_fish_more_room",
                )}
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
                    {t("ui.environment")}
                    <select name="theme" defaultValue={state.theme}>
                      <option value="lagoon">{t("ui.emerald_lagoon")}</option>
                      <option value="midnight">{t("ui.midnight_reef")}</option>
                      <option value="coral">{t("ui.coral_cove")}</option>
                    </select>
                  </label>
                  <label>
                    {t("ui.decorations")}
                    <select name="decor" defaultValue={state.decorations[0]}>
                      <option value="garden">
                        {t("ui.swaying_sea_garden")}
                      </option>
                      <option value="ruins">{t("ui.sunken_ruins")}</option>
                      <option value="minimal">{t("ui.quiet_stones")}</option>
                    </select>
                  </label>
                  <button className="primary" disabled={locked}>
                    {t("ui.save_aquarium_style_free")}
                  </button>
                </form>
              </section>
              <section className="panel">
                <h2>{t("ui.a_little_more_room")}</h2>
                <p>
                  {t("ui.capacity")} {t("counts.fish", { count: state.tank })}
                </p>
                {button(
                  t("ui.expand_6_value0", {
                    p0: fmt(state.tank * 100),
                  }),
                  () =>
                    act("upgrade", {
                      kind: "tank",
                    }),
                )}
              </section>
            </>
          )}
          {screen === "profile" && (
            <>
              <Title
                label={t("ui.the_explorer")}
                title={state.username}
                text={t("ui.aquarium_keeper_since_value0", {
                  p0: date(state.created),
                })}
              />
              <section className="panel">
                <h2>{t("ui.your_story_in_numbers")}</h2>
                <p>
                  {state.fish.length} {t("ui.fish_62ee46")}{" "}
                  {state.collection.length} {t("ui.limited_discoveries")}{" "}
                  {hours(state.online.total)} {t("ui.online")}
                </p>
                <p>
                  {t("ui.player_id")} {state.id}
                </p>
                <p>
                  {t(
                    "ui.cloud_saves_are_stored_on_this_server_keep_your_password_and_recovery_code_safe",
                  )}
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
                  {t("ui.sign_out")}
                </button>
              </section>
              <section className="panel">
                <h2>{t("ui.pearl_ledger")}</h2>
                {!state.ledger.length && (
                  <p>{t("ui.welcome_gift_3_000_pearl")}</p>
                )}
                {state.ledger.slice(0, 100).map((l) => (
                  <div className="ledger-row" key={l.id}>
                    <span>
                      {systemMessage(l.reason)}
                      <small>{dateTime(l.time)}</small>
                    </span>
                    <b
                      style={{
                        color: l.delta > 0 ? "#8ce8bf" : "#f2b6aa",
                      }}
                    >
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
                label={t("ui.your_comfort_zone")}
                title={t("ui.a_quieter_kind_of_play")}
                text={t("ui.fine_tune_the_experience_for_your_device")}
              />
              <section className="panel">
                <label>
                  {t("ui.animation_quality")}
                  <select
                    value={quality}
                    onChange={(e) => {
                      setQuality(e.target.value);
                      localStorage.setItem("dreamQuality", e.target.value);
                    }}
                  >
                    <option value="high">{t("ui.high_full_particles")}</option>
                    <option value="low">{t("ui.low_fewer_particles")}</option>
                  </select>
                </label>
                <h3>{t("ui.connection_privacy")}</h3>
                <p>
                  {online
                    ? t("ui.connected_to_game_server")
                    : t("ui.offline_view_only_870d31")}
                  {t(
                    "ui.a_cached_aquarium_is_kept_on_this_browser_for_offline_viewing_all_ownership_and_pearl_are_autho",
                  )}
                </p>
                <button onClick={refresh}>
                  {t("ui.synchronize_server_state")}
                </button>
                <button
                  onClick={() => {
                    localStorage.removeItem("dreamAquarium");
                    setNotice(
                      "Local offline cache cleared. Server data is unchanged.",
                    );
                  }}
                >
                  {t("ui.clear_offline_cache")}
                </button>
                <h3>{t("ui.account_recovery")}</h3>
                <p>
                  {t(
                    "ui.use_the_recovery_code_saved_at_registration_on_the_sign_in_screen_recovering_rotates_the_code_a",
                  )}
                </p>
              </section>
            </>
          )}
          <footer>
            DREAM AQUARIUM <span>{t("ui.a_little_wonder_every_day")}</span>
            <small>{t("ui.server_authoritative_pearl_only")}</small>
          </footer>
        </main>
      </div>
      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={t("ui.fish_details")}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="close"
              aria-label={t("ui.close_fish_details")}
              onClick={() => setSelected(null)}
            >
              ×
            </button>
            <FishIcon fish={selected} />
            <span
              className="eyebrow"
              style={{
                color: COLORS[selected.rarity],
              }}
            >
              {RARITIES[selected.rarity]}{" "}
              {selected.limited &&
                t("ui.value0_limited_3919fa", {
                  p0: selected.limited,
                })}
            </span>
            <h2>{selected.name}</h2>
            <p>
              {t("ui.generation")} {selected.generation} ·{" "}
              {selected.growth >= 1
                ? t("ui.mature")
                : t("ui.value0_grown", {
                    p0: Math.round((selected.growth || 0) * 100),
                  })}{" "}
              {t("ui.born")} {date(selected.born)}
            </p>
            <progress value={selected.growth || 0} max="1" />
            <h3>{t("ui.genetic_fingerprint")}</h3>
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
                    {t("ui.view_ancestor")} {i + 1}
                  </button>
                ))}
              </div>
            )}
            <div className="dna-grid">
              {Object.entries(selected.dna).map(([k, v]) => (
                <div key={k}>
                  <small>{k}</small>
                  <b>
                    {typeof v === "number"
                      ? v.toFixed(3)
                      : v
                        ? t("ui.yes")
                        : t("ui.no")}
                  </b>
                </div>
              ))}
            </div>
            <p className="muted">
              {t("ui.id")} {selected.id}
              <br />
              {t("ui.parents_c8b299")}{" "}
              {selected.parents.length
                ? selected.parents.join(" × ")
                : t("ui.wild_discovery")}
            </p>
            {state.fish.some((f) => f.id === selected.id) && (
              <div className="card-actions">
                {button(
                  selected.location === "tank"
                    ? t("ui.move_to_storage")
                    : t("ui.move_to_aquarium"),
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
                  t("ui.release_permanently"),
                  async () => {
                    if (
                      confirm(
                        t(
                          "ui.permanently_release_this_fish_this_cannot_be_undone",
                        ),
                      )
                    ) {
                      const s = await act("release", {
                        id: selected.id,
                        confirm: true,
                      });
                      if (s) setSelected(null);
                    }
                  },
                  {
                    className: "danger",
                  },
                )}
              </div>
            )}
          </section>
        </div>
      )}
      {recoveryCode && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-label={t("ui.recovery_code")}
          >
            <span className="eyebrow">{t("ui.keep_your_aquarium_safe")}</span>
            <h2>{t("ui.save_your_recovery_code")}</h2>
            <p>
              {t(
                "ui.this_is_shown_once_store_it_somewhere_private_it_can_reset_your_password_without_email",
              )}
            </p>
            <code className="recovery">{recoveryCode}</code>
            <button className="primary" onClick={() => setRecoveryCode("")}>
              {t("ui.i_have_saved_my_recovery_code")}
            </button>
          </section>
        </div>
      )}
      {notice && (
        <div className="toast" role="alert">
          {systemMessage(notice)}
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
  navigator.serviceWorker
    .register(import.meta.env.BASE_URL + "sw.js", {
      scope: import.meta.env.BASE_URL,
    })
    .catch(() => {});
