import React, { useEffect, useState, useRef } from "react";
import { t, useI18n, number, systemMessage } from "./i18n/index.js";
import { COLORS } from "../../shared/rules.js";
export default function StackInventory({ state, api, act, locked }) {
  useI18n();
  const [category, setCategory] = useState(""),
    [tier, setTier] = useState(""),
    [page, setPage] = useState(1),
    [data, setData] = useState(null),
    [selected, setSelected] = useState({}),
    [all, setAll] = useState(false),
    [preview, setPreview] = useState(null),
    [error, setError] = useState(""),
    [processing, setProcessing] = useState(false);
  const seq = useRef(0);
  useEffect(() => {
    setPage(1);
    setAll(false);
    setSelected({});
    setPreview(null);
  }, [category, tier]);
  useEffect(() => {
    const n = ++seq.current;
    const q = new URLSearchParams({
      page: String(page),
      ...(category ? { category } : {}),
      ...(tier ? { tiers: tier } : {}),
    });
    api("stacks?" + q)
      .then((d) => {
        if (seq.current === n) setData(d);
      })
      .catch((e) => setError(systemMessage(e.message)));
  }, [category, tier, page, state]);
  const perform = async (type, payload) => {
    setProcessing(true);
    try {
      return await act(type, payload);
    } finally {
      setProcessing(false);
    }
  };
  async function prepare(operation) {
    const s = await perform("stackPreview", {
      operation,
      ...(category ? { category } : {}),
      ...(tier ? { tiers: [Number(tier)] } : {}),
      ...(!all
        ? {
            quantities: Object.entries(selected)
              .filter(([, quantity]) => quantity > 0)
              .map(([key, quantity]) => ({ key, quantity })),
          }
        : {}),
    });
    if (s) setPreview(s.stackPreview);
  }
  return (
    <section className="stack-inventory">
      <div className="page-title">
        <div>
          <span className="eyebrow">{t("exp.collection")}</span>
          <h1>{t("exp.stacks")}</h1>
          <p>{t("exp.open_limit")}</p>
        </div>
      </div>
      <div className="toolbar">
        <select
          aria-label={t("exp.category")}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">{t("exp.all_categories")}</option>
          {["fish", "decoration", "background", "accessory", "food"].map(
            (c) => (
              <option key={c} value={c}>
                {t(
                  c === "fish"
                    ? "ui.fish"
                    : c === "food"
                      ? "ui.fish_food"
                      : "exp." + c,
                )}
              </option>
            ),
          )}
        </select>
        <select
          aria-label={t("exp.tier")}
          value={tier}
          onChange={(e) => setTier(e.target.value)}
        >
          <option value="">{t("exp.all_tiers")}</option>
          {COLORS.map((_, i) => (
            <option key={i} value={i}>
              {t("rarity." + i)}
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            setAll(true);
            setSelected({});
          }}
        >
          {t("exp.select_all")}
        </button>
        <button
          onClick={() => {
            setAll(false);
            setSelected({});
          }}
        >
          {t("exp.deselect")}
        </button>
        <span>
          {t("exp.selected", {
            count: all
              ? data?.eligibleTotal || 0
              : Object.values(selected).reduce((a, b) => a + b, 0),
          })}
        </span>
        <button
          disabled={
            locked || (!all && !Object.values(selected).some((n) => n > 0))
          }
          onClick={() => prepare("open")}
        >
          {t("exp.open")}
        </button>
        <button
          className="danger"
          disabled={
            locked || (!all && !Object.values(selected).some((n) => n > 0))
          }
          onClick={() => prepare("delete")}
        >
          {t("exp.delete")}
        </button>
      </div>
      {processing && <p role="status">{t("exp.loading")}</p>}
      {error && <p role="alert">{error}</p>}
      <div className="item-grid">
        {data?.rows.map((i) => (
          <article
            className="item-card"
            key={i.key}
            style={{ "--rarity": COLORS[i.rarity] }}
          >
            <b>
              {t(
                i.category === "fish"
                  ? "exp.fish_ticket"
                  : i.category === "food"
                    ? "ui.fish_food"
                    : "exp." + i.category,
              )}
              {i.category !== "food" && " · " + t("exp.tickets")}
            </b>
            <small>
              {t("rarity." + i.rarity)}
              {" × "}
              {number(i.quantity)}
            </small>
            <label>
              {t("exp.quantity")}
              <input
                aria-label={t("exp.quantity")}
                disabled={i.locked || all}
                type="number"
                min="0"
                max={i.quantity}
                value={all && !i.locked ? i.quantity : selected[i.key] || 0}
                onChange={(e) =>
                  setSelected({
                    ...selected,
                    [i.key]: Math.max(
                      0,
                      Math.min(i.quantity, Number(e.target.value)),
                    ),
                  })
                }
              />
            </label>
            <button
              disabled={locked}
              onClick={() =>
                perform("stackLock", { key: i.key, locked: !i.locked })
              }
            >
              {t(i.locked ? "exp.unlock" : "exp.lock")}
            </button>
          </article>
        ))}
      </div>
      <div className="pagination">
        <button disabled={page === 1} onClick={() => setPage(page - 1)}>
          {t("ui.previous")}
        </button>
        <span>{t("exp.page", { page, total: data?.total || 0 })}</span>
        <button
          disabled={!data || page * 48 >= data.total}
          onClick={() => setPage(page + 1)}
        >
          {t("ui.next")}
        </button>
      </div>
      {preview && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={t("exp.confirm")}
          >
            <h2>{t("exp.confirm")}</h2>
            {preview.rows.map((i) => (
              <p key={i.key}>
                {t(
                  i.category === "fish"
                    ? "ui.fish"
                    : i.category === "food"
                      ? "ui.fish_food"
                      : "exp." + i.category,
                )}
                {" · "}
                {t("rarity." + i.rarity)}
                {" × "}
                {number(i.quantity)}
              </p>
            ))}
            <p>
              {t("exp.preview_rows", {
                count: Math.min(preview.rowCount || preview.rows.length, 48),
                total: preview.rowCount || preview.rows.length,
              })}
            </p>
            <p>{t("exp.affected", { count: preview.total })}</p>
            <button
              disabled={locked || !preview.total}
              onClick={async () => {
                const s = await perform("stackCommit", {
                  previewId: preview.id,
                  confirm: true,
                });
                if (s) {
                  setPreview(null);
                  setSelected({});
                  setAll(false);
                }
              }}
            >
              {t("exp.confirm")}
            </button>
            <button onClick={() => setPreview(null)}>{t("exp.cancel")}</button>
          </section>
        </div>
      )}
    </section>
  );
}
