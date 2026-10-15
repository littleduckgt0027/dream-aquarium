import FishPicker from "./FishPicker.jsx";
import React, { useEffect, useRef, useState } from "react";
import {
  CATALOG,
  CATEGORIES,
  ITEM_ROLLS,
  ODDS,
  definition,
} from "../../shared/collectibles.js";
import { drawFish } from "./Aquarium.jsx";
import { COLORS, RARITIES } from "../../shared/rules.js";
import { useI18n, t, number, systemMessage } from "./i18n/index.js";
import { decoration, background, accessories } from "./collectible-art.js";
export function ItemArt({ item, fish }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current.getContext("2d");
    c.clearRect(0, 0, 220, 120);
    const d = definition(item.definition_id || item.id);
    if (!d) return;
    const i = {
      ...item,
      definition_id: d.id,
      x: 0.5,
      y: 0.9,
      scale: 1,
      rotation: 0,
    };
    if (d.category === "background") background(c, i, 220, 120, 0, true);
    else if (d.category === "decoration") decoration(c, i, 220, 120, 0, true);
    else {
      c.translate(110, 70);
      c.scale(1.7, 1.7);
      if (fish) {
        c.setTransform(1, 0, 0, 1, 0, 0);
        drawFish(c, { ...fish, accessories: [i] }, 110, 70, 45, 1, 0);
      } else accessories(c, [i], 0, true);
      c.setTransform(1, 0, 0, 1, 0, 0);
    }
  }, [item, fish]);
  return (
    <canvas
      width="220"
      height="120"
      ref={ref}
      aria-label={t(
        "exp." +
          (definition(item.definition_id || item.id)?.motif || "preview"),
      )}
    />
  );
}
const label = (i) => t("exp." + definition(i.definition_id || i.id).motif);
export default function Expansion({
  screen,
  state,
  act,
  api,
  locked,
  onSelectPlacement,
  fishInventory,
}) {
  useI18n();
  const [category, setCategory] = useState("decoration"),
    [tier, setTier] = useState("all"),
    [search, setSearch] = useState(""),
    [sort, setSort] = useState("newest"),
    [page, setPage] = useState(1),
    [data, setData] = useState(null),
    [selected, setSelected] = useState([]),
    [all, setAll] = useState(false),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [preview, setPreview] = useState(null),
    [drawing, setDrawing] = useState(null),
    [fishId, setFishId] = useState(""),
    [ticketCount, setTicketCount] = useState(1);
  const latest = useRef(0);
  useEffect(() => {
    if (screen !== "recycling" && category === "fish")
      setCategory("decoration");
  }, [screen, category]);
  useEffect(() => {
    setPage(1);
    setSelected([]);
    setAll(false);
    setPreview(null);
  }, [category, tier, search, sort, screen]);
  const filters = () => ({
    category,
    ...(tier === "all" ? {} : { tiers: tier.split(",").map(Number) }),
    ...(search ? { search } : {}),
  });
  useEffect(() => {
    if (category === "fish") return;
    const n = ++latest.current;
    setLoading(true);
    const q = new URLSearchParams({
      category,
      page: String(page),
      sort,
      ...(tier === "all" ? {} : { tiers: tier }),
      ...(search ? { search } : {}),
    });
    api("items?" + q)
      .then((d) => {
        if (n === latest.current) setData(d);
      })
      .catch((e) => setError(systemMessage(e.message)))
      .finally(() => {
        if (n === latest.current) setLoading(false);
      });
  }, [category, tier, search, sort, page, state]);
  async function run(type, p) {
    setError("");
    setLoading(true);
    try {
      return await act(type, p);
    } catch (e) {
      setError(systemMessage(e.message));
    } finally {
      setLoading(false);
    }
  }
  async function prepare(operation) {
    const result = await run("itemPreview", {
      ...filters(),
      operation,
      ...(!all ? { ids: selected } : {}),
    });
    if (result?.itemPreview) setPreview(result.itemPreview);
  }
  const eligible = (i) =>
    !i.locked && !i.equipped && !i.fish_id && i.x === null;
  const title = t(
    screen === "itemGacha"
      ? "exp.item_gacha"
      : screen === "recycling"
        ? "exp.recycling"
        : screen === "studio"
          ? "exp.studio"
          : "exp.items",
  );
  const categoryTabs = (
    <div className="tabs">
      {screen === "recycling" && (
        <button
          className={category === "fish" ? "active" : ""}
          onClick={() => setCategory("fish")}
        >
          {t("exp.fish_category")}
        </button>
      )}
      {CATEGORIES.map((c) => (
        <button
          className={category === c ? "active" : ""}
          key={c}
          onClick={() => setCategory(c)}
        >
          {t("exp." + c)}
        </button>
      ))}
    </div>
  );
  if (category === "fish" && screen === "recycling")
    return (
      <section>
        {categoryTabs}
        <p className="muted">
          {t("exp.capacity_count", {
            count: data?.total || 0,
            capacity: data?.capacity || 50000,
          })}
        </p>
        {fishInventory}
      </section>
    );
  return (
    <section className="expansion">
      <div className="page-title">
        <div>
          <span className="eyebrow">{t("exp.collection")}</span>
          <h1>{title}</h1>
          <p>{t("exp.description")}</p>
        </div>
      </div>
      {categoryTabs}
      <p className="muted">
        {t("exp.capacity_count", {
          count: data?.total || 0,
          capacity: data?.capacity || 50000,
        })}
      </p>
      {error && (
        <p role="alert" className="warning">
          {error}
        </p>
      )}
      {screen === "itemGacha" ? (
        <>
          <div className="panel odds">
            <h2>{t("exp.probabilities")}</h2>
            {ODDS.map((odds, i) => (
              <span key={i} style={{ color: COLORS[i] }}>
                {t("rarity." + i)}
                {" · "}
                {number(odds)}%
              </span>
            ))}
          </div>
          <div className="toolbar">
            {Object.entries(ITEM_ROLLS).map(([n, cost]) => (
              <button
                disabled={locked || loading}
                key={n}
                onClick={() => setDrawing({ count: Number(n), cost })}
              >
                {t("exp.draw", { count: n })}
                {" · "}
                {number(cost)}
                {" ◈"}
              </button>
            ))}
          </div>
          {state.lastItemRoll?.length > 0 && (
            <div className="panel">
              <h2>{t("exp.results", { count: state.lastItemRoll.length })}</h2>
              <div className="result-summary">
                {ODDS.map((_, i) => {
                  const n = state.lastItemRoll.filter(
                    (r) => r.rarity === i,
                  ).length;
                  return n ? (
                    <span key={i} style={{ color: COLORS[i] }}>
                      {t("rarity." + i)}
                      {" × "}
                      {number(n)}
                    </span>
                  ) : null;
                })}
              </div>
              <div className="item-grid">
                {state.lastItemRoll.map((i) => (
                  <article
                    key={i.id}
                    className={"item-card reveal rarity-" + i.rarity}
                    style={{ "--rarity": COLORS[i.rarity] }}
                  >
                    <ItemArt item={{ ...i, definition_id: i.definitionId }} />
                    <b>{label({ definition_id: i.definitionId })}</b>
                    <small>{t("rarity." + i.rarity)}</small>
                  </article>
                ))}
              </div>
            </div>
          )}
          <div className="item-grid">
            {CATALOG.filter((d) => d.category === category).map((d) => (
              <article
                className="item-card"
                key={d.id}
                style={{ "--rarity": COLORS[d.rarity] }}
              >
                <ItemArt item={d} />
                <b>{label(d)}</b>
                <small>{t("rarity." + d.rarity)}</small>
              </article>
            ))}
          </div>
        </>
      ) : (
        <>
          {category === "accessory" && (
            <FishPicker
              api={api}
              state={state}
              label={t("exp.choose_fish")}
              value={fishId}
              onChoose={(f) => setFishId(f?.id || "")}
            />
          )}
          <div className="tier-selection">
            {COLORS.map((color, i) => (
              <label key={i} style={{ color }}>
                <input
                  type="checkbox"
                  checked={
                    tier === "all" || tier.split(",").includes(String(i))
                  }
                  onChange={(e) => {
                    const current =
                      tier === "all"
                        ? [0, 1, 2, 3, 4, 5, 6]
                        : tier.split(",").map(Number);
                    const next = e.target.checked
                      ? [...current, i]
                      : current.filter((v) => v !== i);
                    setTier(next.length ? next.join(",") : "all");
                  }}
                />
                {t("rarity." + i)}
              </label>
            ))}
          </div>
          <div className="toolbar">
            <select
              aria-label={t("exp.tier")}
              value={tier}
              onChange={(e) => setTier(e.target.value)}
            >
              <option value="all">{t("exp.all_tiers")}</option>
              {ODDS.map((_, i) => (
                <option key={i} value={i}>
                  {t("rarity." + i)}
                </option>
              ))}
            </select>
            <input
              aria-label={t("exp.search")}
              placeholder={t("exp.search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              aria-label={t("exp.sort")}
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              {["newest", "oldest", "tier", "name"].map((v) => (
                <option key={v} value={v}>
                  {t("exp." + v)}
                </option>
              ))}
            </select>
          </div>
          <div className="toolbar">
            <button
              onClick={() => {
                setAll(true);
                setSelected([]);
              }}
              disabled={loading}
            >
              {t("exp.select_all")}
            </button>
            <button
              onClick={() => {
                setAll(false);
                setSelected([]);
              }}
            >
              {t("exp.deselect")}
            </button>
            <span>
              {all
                ? t("exp.selected", { count: data?.eligibleTotal || 0 })
                : t("exp.selected", { count: selected.length })}
            </span>
            <button
              disabled={locked || loading || (!all && !selected.length)}
              onClick={() => prepare("recycle")}
            >
              {t("exp.recycle")}
            </button>
            <button
              className="danger"
              disabled={locked || loading || (!all && !selected.length)}
              onClick={() => prepare("delete")}
            >
              {t("exp.delete")}
            </button>
          </div>
          {loading && <p role="status">{t("exp.loading")}</p>}
          <div className="item-grid">
            {data?.rows.map((i) => (
              <article
                key={i.id}
                className="item-card"
                style={{ "--rarity": COLORS[i.rarity] }}
              >
                <ItemArt item={i} />
                <b>{label(i)}</b>
                <small>{t("rarity." + i.rarity)}</small>
                <label>
                  <input
                    type="checkbox"
                    disabled={!eligible(i) || all}
                    checked={all ? eligible(i) : selected.includes(i.id)}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? [...selected, i.id]
                          : selected.filter((id) => id !== i.id),
                      )
                    }
                  />
                  {t("exp.select")}
                </label>
                <div className="item-actions">
                  <button
                    disabled={locked || loading}
                    onClick={() =>
                      run("itemLock", { id: i.id, locked: !i.locked })
                    }
                  >
                    {t(i.locked ? "exp.unlock" : "exp.lock")}
                  </button>
                  {category === "decoration" && (
                    <>
                      <button
                        disabled={locked || loading}
                        onClick={() => {
                          onSelectPlacement?.(i);
                          if (i.x === null)
                            run("itemPlace", {
                              id: i.id,
                              x: 0.5,
                              y: 0.8,
                              scale: 1,
                              rotation: 0,
                            });
                        }}
                      >
                        {t(i.x === null ? "exp.place" : "exp.edit")}
                      </button>
                      {i.x !== null && (
                        <button
                          disabled={locked || loading}
                          onClick={() => run("itemRemove", { id: i.id })}
                        >
                          {t("exp.remove")}
                        </button>
                      )}
                    </>
                  )}
                  {category === "background" && (
                    <>
                      <button onClick={() => setDrawing({ item: i })}>
                        {t("exp.preview")}
                      </button>
                      <button
                        disabled={locked || loading}
                        onClick={() =>
                          run(i.equipped ? "itemUnequip" : "itemEquip", {
                            id: i.id,
                          })
                        }
                      >
                        {t(i.equipped ? "exp.unequip" : "exp.equip")}
                      </button>
                    </>
                  )}
                  {category === "accessory" && (
                    <>
                      <button onClick={() => setDrawing({ item: i })}>
                        {t("exp.preview")}
                      </button>

                      <button
                        disabled={locked || loading || (!i.fish_id && !fishId)}
                        onClick={() =>
                          run(i.fish_id ? "itemUnequip" : "itemEquip", {
                            id: i.id,
                            fishId,
                          })
                        }
                      >
                        {t(i.fish_id ? "exp.unequip" : "exp.equip")}
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
          <div className="toolbar">
            <button
              disabled={page === 1 || loading}
              onClick={() => setPage(page - 1)}
            >
              {t("exp.previous")}
            </button>
            <span>{t("exp.page", { page, total: data?.total || 0 })}</span>
            <button
              disabled={loading || !data || page * data.pageSize >= data.total}
              onClick={() => setPage(page + 1)}
            >
              {t("exp.next")}
            </button>
          </div>
          <div className="panel">
            <h2>{t("exp.tickets")}</h2>
            <label>
              {t("exp.quantity")}
              <input
                type="number"
                min="1"
                max="1000"
                value={ticketCount}
                onChange={(e) => setTicketCount(Number(e.target.value))}
              />
            </label>
            {data?.tickets
              .filter((i) => i.category === category)
              .map((i) => (
                <div className="ticket-row" key={i.rarity}>
                  <span style={{ color: COLORS[i.rarity] }}>
                    {t("rarity." + i.rarity)}
                    {" × "}
                    {number(i.quantity)}
                  </span>
                  <button
                    disabled={
                      locked ||
                      loading ||
                      ticketCount < 1 ||
                      ticketCount > i.quantity ||
                      ticketCount > 1000
                    }
                    onClick={() =>
                      run("itemTicket", {
                        category,
                        rarity: i.rarity,
                        count: ticketCount,
                      })
                    }
                  >
                    {t("exp.open")}
                  </button>
                </div>
              ))}
          </div>
        </>
      )}
      {preview && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={t("exp.confirm")}
          >
            <h2>{t("exp.confirm")}</h2>
            <p>{t("exp.snapshot_hint")}</p>
            <table>
              <thead>
                <tr>
                  {["tier", "eligible", "consume", "left", "earned"].map(
                    (k) => (
                      <th key={k}>{t("exp." + k)}</th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {preview.summary.map((g) => (
                  <tr key={g.rarity}>
                    <td>{t("rarity." + g.rarity)}</td>
                    <td>{number(g.eligible)}</td>
                    <td>{number(g.consume)}</td>
                    <td>{number(g.left)}</td>
                    <td>{number(g.tickets)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>{t("exp.affected", { count: preview.total })}</p>
            <button
              disabled={locked || loading || !preview.total}
              onClick={async () => {
                await run("itemCommit", {
                  previewId: preview.id,
                  confirm: true,
                });
                setPreview(null);
                setSelected([]);
                setAll(false);
              }}
            >
              {t("exp.confirm")}
            </button>
            <button onClick={() => setPreview(null)}>{t("exp.cancel")}</button>
          </section>
        </div>
      )}
      {drawing && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={t("exp.preview")}
          >
            <h2>{t("exp.preview")}</h2>
            {drawing.item ? (
              <>
                <ItemArt
                  item={drawing.item}
                  fish={
                    state.fish.find((f) => f.id === fishId) || state.fish[0]
                  }
                />
                <p>{label(drawing.item)}</p>
              </>
            ) : (
              <>
                <p>
                  {t("exp.draw_cost", {
                    count: drawing.count,
                    cost: number(drawing.cost),
                  })}
                </p>
                <button
                  disabled={locked || loading}
                  onClick={async () => {
                    await run("itemGacha", { category, count: drawing.count });
                    setDrawing(null);
                  }}
                >
                  {t("exp.confirm")}
                </button>
              </>
            )}
            <button onClick={() => setDrawing(null)}>{t("exp.cancel")}</button>
          </section>
        </div>
      )}
    </section>
  );
}
