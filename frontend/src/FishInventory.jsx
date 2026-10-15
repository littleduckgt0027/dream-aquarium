import React, { useEffect, useState, useRef } from "react";
import { t, useI18n, number, systemMessage } from "./i18n/index.js";
import { COLORS } from "../../shared/rules.js";
export default function FishInventory({
  state,
  api,
  act,
  locked,
  renderFish,
  chosen,
  setChosen,
  query,
  setQuery,
  tier,
  setTier,
  sort,
  setSort,
}) {
  useI18n();
  const [page, setPage] = useState(1),
    [data, setData] = useState(null),
    [all, setAll] = useState(false),
    [generation, setGeneration] = useState(""),
    [location, setLocation] = useState(""),
    [preview, setPreview] = useState(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const request = useRef(0);
  useEffect(() => {
    setPage(1);
    setAll(false);
    setChosen([]);
    setPreview(null);
  }, [query, tier, sort, generation, location]);
  const filter = {
    ...(query ? { search: query } : {}),
    ...(tier === "all" ? {} : { tiers: tier.split(",").map(Number) }),
    ...(generation !== "" ? { generation } : {}),
    ...(location ? { location } : {}),
  };
  useEffect(() => {
    const n = ++request.current;
    const q = new URLSearchParams({
      page: String(page),
      sort,
      ...(query ? { search: query } : {}),
      ...(tier === "all" ? {} : { tiers: tier }),
      ...(generation !== "" ? { generation } : {}),
      ...(location ? { location } : {}),
    });
    setLoading(true);
    api("fish?" + q)
      .then((d) => {
        if (n === request.current) setData(d);
      })
      .catch((e) => setError(systemMessage(e.message)))
      .finally(() => {
        if (n === request.current) setLoading(false);
      });
  }, [page, query, tier, sort, generation, location, state]);
  const perform = async (type, payload) => {
    setLoading(true);
    try {
      return await act(type, payload);
    } finally {
      setLoading(false);
    }
  };
  const prepare = async (operation) => {
    const result = await perform("fishPreview", {
      ...filter,
      operation,
      ...(!all ? { ids: chosen } : {}),
    });
    if (result) setPreview(result.itemPreview);
  };
  return (
    <section className="fish-inventory">
      <div className="page-title">
        <div>
          <span className="eyebrow">{t("ui.your_living_library")}</span>
          <h1>{t("ui.every_fish_a_discovery")}</h1>
          <p>
            {number(state.fishCounts?.total || state.fish.length)}
            {" / "}
            {number(state.storage)}
            {" · "}
            {t("exp.maximum_storage")}
          </p>
        </div>
        <button
          disabled={locked || state.storage >= 50000}
          onClick={() => perform("upgrade", { kind: "storage" })}
        >
          {t("ui.expand_storage_value0", { p0: number(state.storage * 2) })}
        </button>
      </div>
      <div className="tier-selection">
        {COLORS.map((color, i) => (
          <label key={i} style={{ color }}>
            <input
              type="checkbox"
              checked={tier === "all" || tier.split(",").includes(String(i))}
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
          {COLORS.map((_, i) => (
            <option key={i} value={i}>
              {t("rarity." + i)}
            </option>
          ))}
        </select>
        <select
          aria-label={t("ui.sort_fish")}
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          {["rarity", "name", "age", "generation"].map((k) => (
            <option key={k} value={k}>
              {t(k === "generation" ? "exp.generation" : "ui." + k)}
            </option>
          ))}
        </select>
        <input
          type="number"
          min="0"
          placeholder={t("exp.generation")}
          aria-label={t("exp.generation")}
          value={generation}
          onChange={(e) => setGeneration(e.target.value)}
        />
        <select
          aria-label={t("exp.location")}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        >
          <option value="">{t("exp.all_locations")}</option>
          <option value="storage">{t("ui.fish_storage")}</option>
          <option value="tank">{t("ui.aquarium")}</option>
        </select>
      </div>
      <div className="toolbar">
        <button
          onClick={() => {
            setAll(true);
            setChosen([]);
          }}
        >
          {t("exp.select_all")}
        </button>
        <button
          onClick={() => {
            setAll(false);
            setChosen([]);
          }}
        >
          {t("exp.deselect")}
        </button>
        <span>
          {t("exp.selected", {
            count: all ? data?.eligibleTotal || 0 : chosen.length,
          })}
        </span>
        {all && <small>{t("exp.all_matching")}</small>}
        <button
          disabled={locked || loading || (!all && !chosen.length)}
          onClick={() => prepare("recycle")}
        >
          {t("exp.recycle")}
        </button>
        <button
          className="danger"
          disabled={locked || loading || (!all && !chosen.length)}
          onClick={() => prepare("delete")}
        >
          {t("exp.delete")}
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {loading && <p role="status">{t("exp.loading")}</p>}
      <div className="fish-grid">
        {data?.rows.map((f) => (
          <div className="fish-inventory-entry" key={f.id}>
            {renderFish({ ...f, bulkSelected: all && !f.restricted })}
            <button
              disabled={locked}
              onClick={() => {
                setChosen(chosen.filter((id) => id !== f.id));
                perform("fishLock", { id: f.id, locked: !f.locked });
              }}
            >
              {t(f.locked ? "exp.unlock" : "exp.lock")}
            </button>
          </div>
        ))}
      </div>
      <div className="pagination">
        <button
          disabled={page <= 1 || loading}
          onClick={() => setPage(page - 1)}
        >
          {t("ui.previous")}
        </button>
        <span>{t("exp.page", { page, total: data?.total || 0 })}</span>
        <button
          disabled={!data || page * 48 >= data.total || loading}
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
                    <td style={{ color: COLORS[g.rarity] }}>
                      {t("rarity." + g.rarity)}
                    </td>
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
              disabled={locked || !preview.total}
              onClick={async () => {
                const s = await perform("fishCommit", {
                  previewId: preview.id,
                  confirm: true,
                });
                if (s) {
                  setPreview(null);
                  setChosen([]);
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
