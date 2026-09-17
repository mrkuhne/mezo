import React, { useState } from "react";
export default function MealScore({ meal }) {
  const [expanded, setExpanded] = useState(null),
    [pending, setPending] = useState(false);
  const dimensions = [
    [
      "Kcal és makrók",
      meal.protein >= 25 ? 84 : 68,
      "A mentett adag fehérjéjét és energiatartalmát mutató példa.",
    ],
    [
      "Mikrotápanyagok",
      72,
      "A valódi értékeléshez részletes összetevőadatok szükségesek.",
    ],
    [
      "Feldolgozottság · NOVA",
      76,
      "Bemutató érték: a prototípus nem osztályozza az alapanyagokat.",
    ],
    [
      "A napod kontextusa",
      82,
      "Itt kapcsolódik majd össze a táplálkozás, a sportterhelés és a személyes cél.",
    ],
  ];
  const score = Math.round(dimensions.reduce((n, d) => n + d[1], 0) / 4);
  return (
    <section className="core-score" aria-label="AI score bemutató">
      <span className="flow-kicker">BOOP · AI SCORE · DEMÓ</span>
      <div className="core-score-hero">
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle
            cx="60"
            cy="60"
            r="48"
            fill="none"
            stroke="currentColor"
            opacity=".12"
            strokeWidth="6"
          />
          <circle
            cx="60"
            cy="60"
            r="48"
            pathLength="100"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${score} 100`}
            transform="rotate(-90 60 60)"
          />
        </svg>
        <strong>
          {pending ? "…" : score}
          <small>/100</small>
        </strong>
      </div>
      <p>Az étkezés több nézőpontból.</p>
      {pending ? (
        <p role="status">Az értékelés előkészítése…</p>
      ) : (
        dimensions.map(([label, value, note], i) => (
          <div key={label}>
            <button
              className="core-score-row"
              aria-expanded={expanded === i}
              onClick={() => setExpanded(expanded === i ? null : i)}
            >
              <span>{label}</span>
              <b>{value}</b>
              <span>{expanded === i ? "−" : "+"}</span>
            </button>
            {expanded === i && <p>{note}</p>}
          </div>
        ))
      )}
      <p className="evidence-note">
        Szimulált pontszámok a felület kipróbálásához. Nem fut AI-elemzés.
      </p>
      <button
        className="text-button"
        disabled={pending}
        onClick={() => setPending(true)}
      >
        Újraértékelés kipróbálása
      </button>
      {pending && (
        <button className="text-button" onClick={() => setPending(false)}>
          Demó eredmény megérkezett
        </button>
      )}
    </section>
  );
}
