import React, { useState, useEffect, useRef } from "react";
import { t, useI18n } from "./i18n/index.js";
export default function FishPicker({
  api,
  label,
  value,
  onChoose,
  name,
  mature,
  state,
}) {
  useI18n();
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [data, setData] = useState(null),
    [internal, setInternal] = useState(""),
    [chosen, setChosen] = useState(null);
  const seq = useRef(0);
  useEffect(() => setPage(1), [search]);
  useEffect(() => {
    const n = ++seq.current;
    const q = new URLSearchParams({
      page: String(page),
      sort: "name",
      ...(search ? { search } : {}),
      ...(mature === undefined ? {} : { mature: String(mature) }),
    });
    api("fish?" + q)
      .then((d) => {
        if (seq.current === n) {
          setData(d);
          if (
            value === undefined &&
            chosen &&
            !d.rows.some((f) => f.id === chosen.id)
          ) {
            setChosen(null);
            setInternal("");
          }
        }
      })
      .catch(() => {});
  }, [search, page, state?.serverTime, mature]);
  const selected = value ?? internal,
    rows = data?.rows || [];
  return (
    <div className="fish-picker">
      <label>
        {label}
        <input
          aria-label={t("exp.search_fish_for", { label })}
          placeholder={t("ui.search_fish")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          name={name}
          required
          aria-label={label}
          value={selected}
          onChange={(e) => {
            const f = rows.find((f) => f.id === e.target.value);
            setInternal(e.target.value);
            setChosen(f);
            onChoose?.(f);
          }}
        >
          <option value="">{t("exp.choose_fish")}</option>
          {chosen &&
            chosen.id === selected &&
            !rows.some((f) => f.id === selected) && (
              <option value={chosen.id}>{chosen.name}</option>
            )}
          {rows.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
              {" · "}
              {t("rarity." + f.rarity)}
              {" · "}
              {f.id.slice(0, 4)}
            </option>
          ))}
        </select>
      </label>
      <div className="pagination">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          {t("ui.previous")}
        </button>
        <span>
          {t("ui.page")} {page}
        </span>
        <button
          type="button"
          disabled={!data || page * 48 >= data.total}
          onClick={() => setPage(page + 1)}
        >
          {t("ui.next")}
        </button>
      </div>
    </div>
  );
}
