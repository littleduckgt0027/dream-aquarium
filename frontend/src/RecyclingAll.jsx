import React, { useState } from "react";
import { t, useI18n, number } from "./i18n/index.js";
import { COLORS } from "../../shared/rules.js";
export default function RecyclingAll({ act, locked }) {
  useI18n();
  const [tiers, setTiers] = useState([0, 1, 2, 3, 4, 5, 6]),
    [previews, setPreviews] = useState(null),
    [busy, setBusy] = useState(false);
  return (
    <section className="panel recycling-all">
      <h2>{t("exp.recycle_all")}</h2>
      <div className="toolbar">
        {COLORS.map((color, i) => (
          <label key={i} style={{ color }}>
            <input
              type="checkbox"
              checked={tiers.includes(i)}
              onChange={(e) => {
                setTiers(
                  e.target.checked
                    ? [...tiers, i]
                    : tiers.filter((r) => r !== i),
                );
                setPreviews(null);
              }}
            />
            {t("rarity." + i)}
          </label>
        ))}
      </div>
      <button
        disabled={locked || busy || !tiers.length}
        onClick={async () => {
          setBusy(true);
          try {
            const s = await act("recycleAllPreview", { tiers });
            if (s) setPreviews(s.bulkPreviews);
          } finally {
            setBusy(false);
          }
        }}
      >
        {t("exp.recycle_all")}
      </button>
      {busy && <p role="status">{t("exp.loading")}</p>}
      {previews && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={t("exp.confirm")}
          >
            <h2>{t("exp.confirm")}</h2>
            <p>{t("exp.snapshot_hint")}</p>
            {previews.map((v) => (
              <div key={v.id}>
                <h3>
                  {t(v.category === "fish" ? "ui.fish" : "exp." + v.category)}
                </h3>
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
                    {v.summary.map((g) => (
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
              </div>
            ))}
            <p>
              {t("exp.affected", {
                count: previews.reduce((n, v) => n + v.total, 0),
              })}
            </p>
            <button
              disabled={locked || busy || !previews.some((v) => v.total)}
              onClick={async () => {
                setBusy(true);
                try {
                  const s = await act("recycleAllCommit", {
                    confirm: true,
                    previewIds: previews.map((v) => v.id),
                  });
                  if (s) setPreviews(null);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t("exp.confirm")}
            </button>
            <button onClick={() => setPreviews(null)}>{t("exp.cancel")}</button>
          </section>
        </div>
      )}
    </section>
  );
}
