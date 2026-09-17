import React, { useState } from "react";
import { Avatar, Icon, Sparkline, Ring } from "../shared.jsx";
import {
  FlowHead,
  FlowTabs,
  FlowRow,
  CompanionNote,
  EmptyState,
} from "./FlowUI.jsx";
import {
  DIMENSIONS,
  decidePattern,
  saveFact,
  judgeClaim,
  closePrediction,
  accuracy,
  decideExperiment,
  patternFactId,
  patternExperiment,
  weekSnapshot,
  toggleMemoirLike,
} from "./insight-state.mjs";
import "./insight-flow.css";
export const INSIGHT_ROUTES = {
  mezo: { title: "Boop", parent: "home" },
  patterns: { title: "Minták", parent: "mezo" },
  pattern: { title: "Minta részletei", parent: "patterns" },
  predictions: { title: "Előrejelzések", parent: "mezo" },
  prediction: { title: "Előrejelzés", parent: "predictions" },
  knowledge: { title: "Tudástár", parent: "mezo" },
  fact: { title: "Egy darab közös tudás", parent: "knowledge" },
  "knowledge-categories": {
    title: "Kapcsolódó területek",
    parent: "knowledge",
  },
  "knowledge-category": {
    title: "A tudás kapcsolatai",
    parent: "knowledge-categories",
  },
  communication: { title: "Így beszélj velem", parent: "knowledge" },
  character: { title: "Karakter", parent: "mezo" },
  dimensions: { title: "Dimenziók", parent: "character" },
  dimension: { title: "Egy oldalad", parent: "dimensions" },
  claim: { title: "Állítás és visszajelzés", parent: "character" },
  "character-feed": { title: "Alakuló kép", parent: "character" },
  team: { title: "A csapat", parent: "character" },
  expert: { title: "Egy nézőpont", parent: "team" },
  conference: { title: "Konzílium", parent: "character" },
  "character-engine": { title: "Hogyan áll össze?", parent: "character" },
  "character-run": {
    title: "Egy feldolgozás útja",
    parent: "character-engine",
  },
  "character-sources": { title: "Adatforrások", parent: "character-engine" },
  "character-detectors": {
    title: "Mit figyelünk?",
    parent: "character-engine",
  },
  week: { title: "A heted", parent: "mezo" },
  "week-day": { title: "Egy nap közelről", parent: "week" },
  "week-domain": { title: "Heti összefüggések", parent: "week" },
  "week-archive": { title: "Korábbi hetek", parent: "week" },
  memoir: { title: "Memoár", parent: "mezo" },
  "memoir-archive": { title: "A történeted fejezetei", parent: "memoir" },
  experiments: { title: "Kísérletek", parent: "mezo" },
  experiment: { title: "Egy kis kísérlet", parent: "experiments" },
  memory: { title: "Amire emlékszem", parent: "mezo" },
};
const BUCKETS = [
  ["decide", "Döntésre vár"],
  ["monitoring", "Figyeljük"],
  ["confirmed", "Megerősítve"],
  ["gathering", "Még gyűlik"],
  ["noRelationship", "Nem igazolódott"],
  ["rejected", "Elvetve"],
];
const STATUS = Object.fromEntries(BUCKETS);
const PSTATUS = {
  pending: "Folyamatban",
  validated: "Bevált",
  missed: "Nem vált be",
};
const safe = (api, route, params) => () => api.go(route, params);
function Head(props) {
  return <FlowHead {...props} />;
}
function Links({ api, items }) {
  return (
    <div className="flow-list">
      {items.map(([route, icon, title, sub, params]) => (
        <FlowRow
          key={route + title}
          icon={icon}
          title={title}
          subtitle={sub}
          onClick={safe(api, route, params)}
        />
      ))}
    </div>
  );
}
function Unknown({ api }) {
  return (
    <EmptyState
      title="Ezt a részletet nem találom."
      description="Válassz egyet a bemutatóban szereplő bejegyzések közül."
      action="Vissza Mezóhoz"
      onClick={safe(api, "mezo")}
    />
  );
}
function Hub({ api }) {
  const s = api.state.insight,
    pending = s.patterns.filter((p) => p.status === "decide").length;
  return (
    <div className="flow-page insight-hub">
      <div className="insight-hello">
        <div>
          <span className="flow-kicker">A RÉSZLETEKBŐL ÖSSZEÁLLÓ KÉP</span>
          <h1>
            Ismerlek.
            <br />
            <em>És figyelek rád.</em>
          </h1>
        </div>
        <button
          className="insight-avatar-button"
          onClick={safe(api, "chat")}
          aria-label="Beszélgetés Mezóval"
        >
          <Avatar size={116} />
        </button>
      </div>
      <p className="flow-copy">
        Amit észreveszek, amit közösen megerősítünk, és amivel érdemes
        továbbmenned.
      </p>
      <button className="primary-button" onClick={safe(api, "chat")}>
        Mi jár a fejedben?
        <Icon name="message" />
      </button>
      <div
        className="insight-thread"
        aria-label="A megfigyelésből közös tudás, majd következő lehetőség lesz"
      >
        <span>
          <i>01</i>Észreveszem
        </span>
        <b>→</b>
        <span>
          <i>02</i>Átbeszéljük
        </span>
        <b>→</b>
        <span>
          <i>03</i>Használjuk
        </span>
      </div>
      {pending > 0 && (
        <button
          className="insight-focus"
          onClick={safe(api, "pattern", { id: "walk-sleep" })}
        >
          <span className="flow-kicker">EGY VISSZAJELZÉSRE VÁROK</span>
          <h2>
            Az esti sétáid
            <br />
            nyomot hagynak?
          </h2>
          <p>12 megfigyelt nap · még nem bizonyított összefüggés</p>
          <span>
            Megnézem és visszajelzek
            <Icon name="arrow-right" size={17} />
          </span>
        </button>
      )}
      <section className="flow-section">
        <h2>A közös tudásunk</h2>
        <Links
          api={api}
          items={[
            [
              "patterns",
              "chart",
              "Minták",
              `${s.patterns.length} megfigyelés · ${pending} döntésre vár`,
            ],
            [
              "predictions",
              "sparkles",
              "Előrejelzések",
              "Mi következhet, és mennyire biztos?",
            ],
            [
              "knowledge",
              "book",
              "Tudástár",
              `${s.facts.filter((f) => f.enabled).length} használható tény · te alakítod`,
            ],
            [
              "character",
              "brain",
              "Karakter",
              "A rólad alakuló kép, dimenziónként",
            ],
            ["week", "calendar", "Heti", "A történet a számok mögött"],
          ]}
        />
      </section>
      <section className="flow-section">
        <h2>Van hely a mélyebb képnek is</h2>
        <Links
          api={api}
          items={[
            [
              "experiments",
              "leaf",
              "Kísérletek",
              "Kis változtatás, közösen értékelt eredmény",
            ],
            ["memoir", "book", "Memoár", "A történeted egy-egy fejezete"],
            [
              "memory",
              "layers",
              "Amire emlékszem",
              "Források, használat és javíthatóság",
            ],
            [
              "avatar",
              "sun",
              "A társ megjelenése",
              "Clay, figyelem és mozdulatok",
            ],
          ]}
        />
      </section>
    </div>
  );
}
function Patterns({ api }) {
  const s = api.state.insight;
  const [filter, setFilter] = useState(api.params.status || "decide");
  const list = s.patterns.filter((p) => p.status === filter);
  return (
    <div className="flow-page">
      <Head
        eyebrow="JELEKBŐL FELISMERÉS"
        title="Nem minden együttjárás jelent kapcsolatot."
        description="Itt látod, mit figyelünk, mi állta ki az idő próbáját, és mivel nem értettél egyet."
      />
      <FlowTabs
        value={filter}
        onChange={setFilter}
        items={BUCKETS.map(([id, l]) => [
          id,
          `${l} · ${s.patterns.filter((p) => p.status === id).length}`,
        ])}
      />
      {list.length ? (
        list.map((p) => (
          <button
            key={p.id}
            className="pattern-entry"
            onClick={safe(api, "pattern", { id: p.id })}
          >
            <div className="pattern-meta">
              <Icon name={p.icon} />
              <span>{p.domain}</span>
              <small>{p.strength}</small>
            </div>
            <h2>{p.title}</h2>
            <p>{p.finding}</p>
            <div className="pattern-foot">
              <span>{p.days} megfigyelt nap</span>
              <Icon name="arrow-right" size={18} />
            </div>
          </button>
        ))
      ) : (
        <EmptyState
          icon="check-circle"
          title="Itt most nincs új bejegyzés."
          description="A többi nézetben a megfigyelt és korábban elbírált mintákat is megtalálod."
        />
      )}
      <CompanionNote>
        Te döntöd el, mi jellemző rád. Megerősítés után egy minta bekerülhet a
        Tudástárba; a megfigyelés önmagában nem válik ténnyé.
      </CompanionNote>
      <Links
        api={api}
        items={[
          [
            "character-sources",
            "layers",
            "Miből tanulok?",
            "Naplók és adatlefedettség",
          ],
        ]}
      />
    </div>
  );
}
function Pattern({ api }) {
  const p = api.state.insight.patterns.find(
    (x) => x.id === (api.params.id || "walk-sleep"),
  );
  const [tab, setTab] = useState("meaning");
  if (!p) return <Unknown api={api} />;
  function decide(status) {
    api.update("insight", (s) => decidePattern(s, p.id, status));
    api.toast(
      status === "confirmed"
        ? "Megerősítve — a Tudástárban is megtalálod"
        : status === "monitoring"
          ? "Tovább figyeljük"
          : "Elvetve — nem használom tudásként",
    );
    if (status === "confirmed") {
      api.celebrate();
      api.notify({
        kind: "insight",
        title: "Egy felismerés a közös tudásunk része lett",
        body: p.title,
        route: "fact",
        params: {
          id: patternFactId(api.state.insight, p.id) || "fact-" + p.id,
        },
      });
    }
  }
  const fact = api.state.insight.facts.find((f) => f.patternId === p.id),
    experiment = patternExperiment(api.state.insight, p.id);
  return (
    <div className="flow-page">
      <Head eyebrow={`${p.domain} · ${STATUS[p.status]}`} title={p.question} />
      <FlowTabs
        items={[
          ["meaning", "Mit jelent?"],
          ["evidence", "Bizonyíték"],
          ["history", "Előzmények"],
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "meaning" ? (
        <>
          <div className="insight-statement">
            <Icon name={p.icon} size={30} />
            <h2>{p.finding}</h2>
            <span>
              {p.strength} · {p.days} nap
            </span>
          </div>
          <p className="flow-copy">
            Ez az eddigi naplóidban látható együttjárás. A munkanap, a stressz
            vagy más szokásod is közrejátszhat; a lehetséges okot még nem
            ismerjük.
          </p>
          {!["gathering", "noRelationship"].includes(p.status) && (
            <section className="flow-section">
              <h2>Ismerős neked?</h2>
              <div className="flow-actions">
                <button
                  className="primary-button"
                  onClick={() => decide("confirmed")}
                  disabled={p.status === "confirmed"}
                >
                  Igen, jellemző
                </button>
                <button
                  className="secondary-button"
                  onClick={() => decide("monitoring")}
                  disabled={p.status === "monitoring"}
                >
                  Figyeljük még
                </button>
              </div>
              <button
                className="text-button"
                onClick={() => decide("rejected")}
                disabled={p.status === "rejected"}
              >
                Nem jellemző rám
              </button>
            </section>
          )}
          {fact?.enabled && (
            <div className="flow-status">
              <Icon name="check-circle" size={18} /> Ez a megfigyelés már
              használható közös tudás.
              <button
                className="text-button"
                onClick={safe(api, "fact", { id: fact.id })}
              >
                Megnézem a Tudástárban
                <Icon name="arrow-right" size={16} />
              </button>
            </div>
          )}
          <CompanionNote
            action="Beszéljük át"
            onClick={() => api.ask(`Beszéljünk erről a mintáról: ${p.title}.`)}
          >
            A számaid mellett a saját tapasztalatod is számít. A
            visszajelzésedet megőrzöm.
          </CompanionNote>
          <Links
            api={api}
            items={[
              ...(experiment
                ? [
                    [
                      "experiment",
                      "leaf",
                      "Kipróbálom egy kis kísérletben",
                      "Előbb megnézem a javaslatot",
                      { id: experiment.id },
                    ],
                  ]
                : []),
              [
                "predictions",
                "sparkles",
                "Előrejelzéseink",
                "Mire számíthatunk ezután?",
              ],
            ]}
          />
        </>
      ) : tab === "evidence" ? (
        <>
          <div className="flow-status">
            {p.source} · {p.days} összehasonlítható nap
          </div>
          {p.values.length > 0 ? (
            <div className="insight-chart">
              <span className="flow-kicker">
                {p.domain === "Alvás"
                  ? "ALVÁSIDŐ · ÓRA"
                  : "NAPLÓZOTT MUTATÓ · MINTAADAT"}
              </span>
              <Sparkline values={p.values} height={130} />
              <div className="flow-chart-caption">
                <span>Korábbi napok</span>
                <span>Legutóbbi nap</span>
              </div>
            </div>
          ) : (
            <EmptyState
              title="Még nincs elég összehasonlítható adat."
              description="A hiányzó napokat nem helyettesítjük becsléssel."
            />
          )}
          <h2 className="insight-small-heading">Amit még nem tudunk</h2>
          <p className="flow-copy">
            Az eltérő napirend és a közérzet befolyásolhatta az eredményt. A
            diagram a prototípus mintanaplóját szemlélteti.
          </p>
          <Links
            api={api}
            items={[
              [
                p.domain === "Étkezés"
                  ? "fuel"
                  : p.domain === "Edzés"
                    ? "train"
                    : "me-sleep",
                "book",
                "Megnyitom az alapul szolgáló naplót",
                p.source,
              ],
            ]}
          />
        </>
      ) : (
        <div className="insight-timeline">
          {p.history.map((h, i) => (
            <div key={i}>
              <i />
              <p>{h}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function Predictions({ api }) {
  const [filter, setFilter] = useState("pending");
  const list = api.state.insight.predictions.filter(
      (p) => filter === "all" || p.status === filter,
    ),
    a = accuracy(api.state.insight.predictions);
  return (
    <div className="flow-page">
      <Head
        eyebrow="LEHETŐSÉGEK, NEM ÍGÉRETEK"
        title="Egy kicsit előre nézünk."
        description="A megerősített mintákból javaslat születhet. Utólag azt is láthatod, mennyire talált."
      />
      {a && (
        <div className="forecast-score">
          <b>
            {a.hits}
            <small> / {a.closed}</small>
          </b>
          <span>
            lezárt előrejelzés vált be
            <br />
            ebben a mintanaplóban
          </span>
        </div>
      )}
      <FlowTabs
        items={[
          ["pending", "Folyamatban"],
          ["validated", "Bevált"],
          ["missed", "Nem vált be"],
          ["all", "Mind"],
        ]}
        value={filter}
        onChange={setFilter}
      />
      {list.map((p) => (
        <button
          className="prediction-entry"
          key={p.id}
          onClick={safe(api, "prediction", { id: p.id })}
        >
          <span className="flow-kicker">
            {p.range} · {PSTATUS[p.status]}
          </span>
          <h2>{p.title}</h2>
          <p>{p.text}</p>
          <span className="prediction-end">
            {p.confidence}
            <Icon name="arrow-right" size={17} />
          </span>
        </button>
      ))}
      {!list.length && (
        <EmptyState title="Ebben a nézetben még nincs előrejelzés." />
      )}
    </div>
  );
}
function Prediction({ api }) {
  const p = api.state.insight.predictions.find(
    (p) => p.id === (api.params.id || "pred1"),
  );
  const [note, setNote] = useState(p?.actual || "");
  if (!p) return <Unknown api={api} />;
  const submit = (status) => {
    api.update("insight", (s) => closePrediction(s, p.id, status, note));
    api.toast("A visszajelzésed bekerült az eredmény mellé");
  };
  return (
    <div className="flow-page">
      <Head
        eyebrow={`${p.range} · ${PSTATUS[p.status]}`}
        title={p.title}
        description={p.text}
      />
      <div className="forecast-window">
        <Icon name="sparkles" size={32} />
        <h2>{p.confidence}</h2>
        <p>
          Ez egy lehetőség. Ha a napod változik, a várakozásunkat is érdemes
          újragondolni.
        </p>
      </div>
      <Links
        api={api}
        items={[
          [
            "pattern",
            "chart",
            "Miből következtetek?",
            "Az alapul szolgáló minta",
            { id: p.patternId },
          ],
          [
            p.route,
            "arrow-right",
            "Megnézem a kapcsolódó napomat",
            "Innen közvetlenül folytathatod",
          ],
        ]}
      />
      <section className="flow-section">
        <h2>Hogy alakult?</h2>
        <label className="flow-field">
          Saját megjegyzésed
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Mi történt valójában?"
          />
        </label>
        <div className="flow-actions">
          <button
            className="primary-button"
            onClick={() => submit("validated")}
          >
            Bevált
          </button>
          <button className="secondary-button" onClick={() => submit("missed")}>
            Nem vált be
          </button>
        </div>
        <p className="evidence-note">
          A prototípusban a jövőbeli eredményt is kipróbálhatod. Ez a
          mintaadatot módosítja.
        </p>
        {p.actual && <div className="flow-status">Elmentve: {p.actual}</div>}
      </section>
      <CompanionNote
        action="Beszéljünk róla"
        onClick={() => api.ask(`Az előrejelzésedről kérdeznélek: ${p.title}`)}
      >
        A be nem vált előrejelzés is segít pontosabban látni. A visszajelzést az
        állítás mellett őrzöm meg.
      </CompanionNote>
    </div>
  );
}
function Knowledge({ api }) {
  const [filter, setFilter] = useState("all"),
    [query, setQuery] = useState("");
  const facts = api.state.insight.facts.filter(
    (f) =>
      (filter === "all" ||
        (filter === "candidate"
          ? f.status === "candidate"
          : filter === "enabled"
            ? f.enabled
            : !f.enabled)) &&
      f.text.toLocaleLowerCase("hu").includes(query.toLocaleLowerCase("hu")),
  );
  return (
    <div className="flow-page">
      <Head
        eyebrow="AMIT KÖZÖSEN TUDUNK"
        title="A saját szavaiddal is alakíthatod."
        description="A megőrzött tények segítenek a válaszaimban. Mindegyiknél látod az eredetét, és te döntöd el, használhatom-e."
      />
      <label className="flow-field">
        Keresés a Tudástárban
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Szokás, preferencia, kapcsolat…"
        />
      </label>
      <FlowTabs
        items={[
          ["all", "Minden tény"],
          ["candidate", "Jóváhagyásra vár"],
          ["enabled", "Használható"],
          ["disabled", "Kikapcsolva"],
        ]}
        value={filter}
        onChange={setFilter}
      />
      {facts.map((f) => (
        <FlowRow
          key={f.id}
          icon={
            f.status === "candidate"
              ? "lightbulb"
              : f.enabled
                ? "check-circle"
                : "pause"
          }
          title={f.text}
          subtitle={`${f.category} · ${f.status === "candidate" ? "Még nem használom" : f.enabled ? "Használható" : "Kikapcsolva"}`}
          onClick={safe(api, "fact", { id: f.id })}
        />
      ))}
      {!facts.length && (
        <EmptyState
          title="Nincs ilyen tény ebben a nézetben."
          description="Próbálj másik keresést vagy szűrőt."
        />
      )}
      <section className="flow-section">
        <Links
          api={api}
          items={[
            [
              "knowledge-categories",
              "layers",
              "Kategóriák és kapcsolatok",
              "Hogyan függnek össze a történeted részletei?",
            ],
            [
              "communication",
              "message",
              "Így beszélj velem",
              "Hangnem, részletesség és kezdeményezés",
            ],
            [
              "memory",
              "info",
              "Hogyan használod ezt?",
              "Eredet, emlék és megerősített tudás",
            ],
          ]}
        />
      </section>
    </div>
  );
}
function Fact({ api }) {
  const f = api.state.insight.facts.find(
    (f) => f.id === (api.params.id || "f1"),
  );
  const [text, setText] = useState(f?.text || ""),
    [enabled, setEnabled] = useState(f?.enabled || false),
    [error, setError] = useState("");
  if (!f) return <Unknown api={api} />;
  function save() {
    try {
      saveFact(api.state.insight, f.id, text, enabled);
      api.update("insight", (s) => saveFact(s, f.id, text, enabled));
      api.toast("A Tudástár frissült");
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <div className="flow-page">
      <Head
        eyebrow={`${f.category} · ${f.status === "candidate" ? "Jóváhagyásra vár" : "Megőrzött tény"}`}
        title="Ez mennyire szól rólad?"
      />
      <div className="insight-quote">„{f.text}”</div>
      <label className="flow-field">
        Pontosítás
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
        />
      </label>
      <label className="flow-checkline">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        Boop használhatja a válaszaiban
      </label>
      {error && (
        <p className="flow-status" role="alert">
          {error}
        </p>
      )}
      <button className="primary-button" onClick={save}>
        {f.status === "candidate" ? "Elfogadom így" : "Módosítás mentése"}
        <Icon name="check" />
      </button>
      <p className="evidence-note">
        Eredet: {f.source}. A kikapcsolás megőrzi az előzményt, de kiveszi a
        használható tudásból.
      </p>
      {f.patternId ? (
        <FlowRow
          icon="chart"
          title="Vissza az eredeti mintához"
          subtitle="Bizonyíték és korábbi döntéseid"
          onClick={safe(api, "pattern", { id: f.patternId })}
        />
      ) : (
        f.route && (
          <FlowRow
            icon="book"
            title="Kapcsolódó forrás megnyitása"
            subtitle={f.source}
            onClick={safe(api, f.route)}
          />
        )
      )}
    </div>
  );
}
const CATEGORIES = [
  ["habits", "Szokások", "target", "Ismétlődő lépések és ritmusok"],
  ["people", "Kapcsolatok", "users", "Emberek és közös események"],
  ["events", "Életesemények", "calendar", "A történeted fontos fordulói"],
  ["preferences", "Preferenciák", "heart", "Ami neked kényelmes és fontos"],
];
function KnowledgeCategories({ api, detail }) {
  const c = CATEGORIES.find((c) => c[0] === api.params.id) || CATEGORIES[0];
  return (
    <div className="flow-page">
      <Head
        eyebrow="A TUDÁS KAPCSOLATAI"
        title={detail ? c[1] : "Minden részlet kapcsolódik valamihez."}
        description={
          detail
            ? c[3]
            : "Egy közös térkép segít a részleteket a helyükön látni."
        }
      />
      {detail ? (
        <>
          <div className="knowledge-map">
            <div>
              <Icon name={c[2]} size={34} />
              <span>{c[1]}</span>
            </div>
            <i />
            <button
              onClick={safe(
                api,
                c[0] === "people"
                  ? "me-people"
                  : c[0] === "habits"
                    ? "me-routines"
                    : c[0] === "events"
                      ? "memoir"
                      : "communication",
              )}
            >
              {c[0] === "people"
                ? "Közös sport és találkozások"
                : c[0] === "habits"
                  ? "Esti séta és reggeli rutin"
                  : c[0] === "events"
                    ? "Visszatérés a futáshoz"
                    : "Rövid, közvetlen segítség"}
              <Icon name="arrow-right" size={15} />
            </button>
            <i />
            <button onClick={safe(api, "knowledge")}>
              Kapcsolódó tények a Tudástárban
              <Icon name="arrow-right" size={15} />
            </button>
          </div>
          <CompanionNote>
            A kategóriák a kapcsolódást mutatják. A tényeket egyetlen helyen, a
            Tudástárban javíthatod.
          </CompanionNote>
        </>
      ) : (
        CATEGORIES.map(([id, title, icon, subtitle]) => (
          <FlowRow
            key={id}
            icon={icon}
            title={title}
            subtitle={subtitle}
            onClick={safe(api, "knowledge-category", { id })}
          />
        ))
      )}
    </div>
  );
}
function Communication({ api }) {
  const s = api.state.insight.communication;
  return (
    <div className="flow-page">
      <Head
        eyebrow="A SAJÁT HANGODHOZ HANGOLVA"
        title="Hogyan segítsek?"
        description="Ezek a választások a prototípus beszélgetési módját és a megőrzött preferenciáidat jelzik."
      />
      <label className="flow-field">
        Hangnem
        <select
          value={s.tone}
          onChange={(e) =>
            api.update("insight", (x) => ({
              ...x,
              communication: { ...x.communication, tone: e.target.value },
            }))
          }
        >
          <option>Közvetlen</option>
          <option>Visszafogott</option>
          <option>Bátorító</option>
        </select>
      </label>
      <label className="flow-field">
        Részletesség
        <select
          value={s.detail}
          onChange={(e) =>
            api.update("insight", (x) => ({
              ...x,
              communication: { ...x.communication, detail: e.target.value },
            }))
          }
        >
          <option>Rövid</option>
          <option>Részletes</option>
        </select>
      </label>
      <label className="flow-checkline">
        <input
          type="checkbox"
          checked={s.checkIn}
          onChange={(e) =>
            api.update("insight", (x) => ({
              ...x,
              communication: { ...x.communication, checkIn: e.target.checked },
            }))
          }
        />
        Érkezéskor kérdezzen rá, hogy vagyok
      </label>
      <CompanionNote
        action="Kipróbálom beszélgetésben"
        onClick={() => api.ask("Hogy áll a hetem?")}
      >
        Az erősebb bátorítás sem jelent sürgetést. Kihagyás után is ugyanúgy itt
        vagyok.
      </CompanionNote>
    </div>
  );
}
function Dossier({ api }) {
  const s = api.state.insight;
  return (
    <div className="flow-page">
      <Head
        eyebrow="KARAKTER · A RÓLAD ALAKULÓ KÉP"
        title="Sok oldalad van.<br/>Egyik sem az egész."
        description="A naplóidból és a visszajelzéseidből lassan egy árnyaltabb kép áll össze. Bármelyik állítást pontosíthatod."
      />
      <div
        className="dossier-orbits"
        aria-label="A hét önismereti terület adatlefedettsége"
      >
        <span className="dossier-person">D</span>
        {DIMENSIONS.slice(0, 7).map((d, i) => (
          <button
            key={d.id}
            style={{ "--angle": `${(i * 360) / 7}deg` }}
            onClick={safe(api, "dimension", { id: d.id })}
            aria-label={d.name}
          >
            <Icon name={d.icon} size={22} />
          </button>
        ))}
      </div>
      <div className="dossier-caption">
        7 nézőpont · {s.claims.filter((c) => c.status === "active").length}{" "}
        aktív állítás
        <br />
        <small>
          A részletesség a rendelkezésre álló tudást jelzi, nem téged pontoz.
        </small>
      </div>
      <Links
        api={api}
        items={[
          [
            "dimensions",
            "layers",
            "Dimenziók",
            "Test, ritmus, belső világ és kapcsolatok",
          ],
          [
            "character-feed",
            "activity",
            "Alakuló kép",
            "Új észrevételek és a pontosításaid",
          ],
          ["team", "users", "A csapat", "Hét nézőpont, egy szkeptikus, Boop"],
          [
            "conference",
            "message",
            "Konzílium",
            "Mit vitattak meg, és mire jutottak?",
          ],
          [
            "character-engine",
            "info",
            "Hogyan áll össze?",
            "Feldolgozások és adatforrások",
          ],
        ]}
      />
    </div>
  );
}
function Dimensions({ api }) {
  return (
    <div className="flow-page">
      <Head eyebrow="KARAKTER · DIMENZIÓK" title="A nagy kép részletei." />
      {DIMENSIONS.map((d) => (
        <FlowRow
          key={d.id}
          icon={d.icon}
          title={d.name}
          subtitle={
            d.meta
              ? "A társ saját működéséről"
              : d.chapter
                ? "Egy alakuló fejezet"
                : `${d.expert} nézőpontja`
          }
          onClick={safe(api, "dimension", { id: d.id })}
        />
      ))}
    </div>
  );
}
function Dimension({ api }) {
  const d = DIMENSIONS.find((d) => d.id === (api.params.id || "body"));
  if (!d) return <Unknown api={api} />;
  const claims = api.state.insight.claims.filter((c) => c.dimension === d.id);
  return (
    <div className="flow-page">
      <Head
        eyebrow={`${d.expert} · ${d.meta ? "Önvizsgálat" : "Karakter"}`}
        title={d.name}
      />
      <div className="dimension-intro">
        <Icon name={d.icon} size={40} />
        <p>{d.portrait}</p>
      </div>
      <span className="flow-kicker">AMIRE A KÉPET ALAPOZOM</span>
      {claims.map((c) => (
        <FlowRow
          key={c.id}
          icon={c.status === "retired" ? "x" : "lightbulb"}
          title={c.correction || c.text}
          subtitle={
            c.status === "retired"
              ? "Visszautasítottad — nem aktív"
              : `${c.confidence} · ${c.source}`
          }
          onClick={safe(api, "claim", { id: c.id })}
        />
      ))}
      {!claims.length && (
        <EmptyState
          title="Ez a fejezet még alakul."
          description="Egyelőre nincs elég megerősített állítás ahhoz, hogy részletesebb képet adjak."
        />
      )}
      <CompanionNote
        action="Beszélgessünk erről"
        onClick={() =>
          api.ask(`A karakterem ${d.name} részéről beszélgessünk.`)
        }
      >
        Az állításokat javíthatod. A személyes képednek veled együtt kell
        alakulnia.
      </CompanionNote>
      <FlowRow
        icon="users"
        title={`${d.expert} nézőpontja`}
        subtitle="Mit figyel és mit nem dönthet el?"
        onClick={safe(api, "expert", { id: d.chapter ? "mezo" : d.id })}
      />
    </div>
  );
}
function Claim({ api }) {
  const c = api.state.insight.claims.find(
    (c) => c.id === (api.params.id || "c1"),
  );
  const [edit, setEdit] = useState(false),
    [text, setText] = useState(c?.correction || ""),
    [error, setError] = useState("");
  if (!c) return <Unknown api={api} />;
  function judge(feedback) {
    try {
      judgeClaim(api.state.insight, c.id, feedback, text);
      api.update("insight", (s) => judgeClaim(s, c.id, feedback, text));
      api.toast(
        feedback === "reject"
          ? "Az állítást visszavontam"
          : "A visszajelzésedet megőriztem",
      );
      setError("");
      setEdit(false);
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <div className="flow-page">
      <Head eyebrow={`KARAKTER · ${c.confidence}`} title="Te is így látod?" />
      <div className="insight-quote">„{c.correction || c.text}”</div>
      <p className="evidence-note">Alapja: {c.source}</p>
      {c.feedback && (
        <div className="flow-status">
          {c.feedback === "reject"
            ? "Visszavont állítás — nem része az aktív képednek."
            : c.feedback === "refine"
              ? "A pontosításod elmentve."
              : "Jelezted, hogy talál."}
        </div>
      )}
      <div className="flow-actions">
        <button className="primary-button" onClick={() => judge("accept")}>
          Talál
        </button>
        <button className="secondary-button" onClick={() => setEdit(!edit)}>
          Pontosítom
        </button>
      </div>
      <button className="text-button" onClick={() => judge("reject")}>
        Nem igaz rám
      </button>
      {edit && (
        <div className="flow-form">
          <label className="flow-field">
            Mi jellemző rád helyette?
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={700}
            />
          </label>
          {error && (
            <p role="alert" className="flow-status">
              {error}
            </p>
          )}
          <button className="primary-button" onClick={() => judge("refine")}>
            Pontosítás elküldése
            <Icon name="send" />
          </button>
        </div>
      )}
      <Links
        api={api}
        items={[
          [
            "dimension",
            "layers",
            "A teljes nézőpont",
            "A környező állításokkal együtt",
            { id: c.dimension },
          ],
          [
            "character-sources",
            "book",
            "Alapul szolgáló naplók",
            "Az állítás forrásai",
          ],
        ]}
      />
    </div>
  );
}
const EXPERTS = [
  ...DIMENSIONS.filter((d) => !d.chapter),
  {
    id: "mezo",
    name: "A kép összerendezése",
    expert: "Boop",
    icon: "sparkles",
    portrait:
      "Összekötöm a nézőpontokat, és én beszélek veled. A csapat belső munkájába te is belenézhetsz.",
  },
];
function Team({ api, detail }) {
  const e = EXPERTS.find((x) => x.id === api.params.id) || EXPERTS[0];
  return (
    <div className="flow-page">
      <Head
        eyebrow="KARAKTER · A CSAPAT"
        title={detail ? e.expert : "Több nézőpont.<br/>Egy közös figyelem."}
        description={
          detail
            ? e.name
            : "A szakértői szerepek az AI eltérő nézőpontjai. Veled Boop beszél; ez nem valódi szakemberek konzultációja."
        }
      />
      {detail ? (
        <>
          <div className="expert-symbol">
            <Icon name={e.icon} size={48} />
          </div>
          <p className="flow-copy">{e.portrait}</p>
          <section className="flow-section">
            <h2>Amit figyel</h2>
            <p className="flow-copy">
              Kapcsolódó naplók, visszatérő szokások, a saját visszajelzéseid és
              az ellentmondó jelek.
            </p>
          </section>
          <Links
            api={api}
            items={[
              [
                "dimension",
                "layers",
                "A kapcsolódó dimenzió",
                "Állítások és bizonyítékok",
                { id: e.id === "mezo" ? "self-audit" : e.id },
              ],
              [
                "conference",
                "message",
                "Egy közös tanácskozás",
                "A nézőpontok találkozása",
              ],
            ]}
          />
        </>
      ) : (
        EXPERTS.map((e) => (
          <FlowRow
            key={e.id}
            icon={e.icon}
            title={e.expert}
            subtitle={e.name}
            onClick={safe(api, "expert", { id: e.id })}
          />
        ))
      )}
    </div>
  );
}
function Conference({ api }) {
  const [view, setView] = useState("result");
  return (
    <div className="flow-page">
      <Head
        eyebrow="KARAKTER · KONZÍLIUM"
        title="Előbb az eredmény.<br/>Aztán a miértek."
        description="A mintatanácskozásban több nézőpont ütközik, mielőtt egy állítás tartósan bekerülne a képedbe."
      />
      <p className="flow-status">
        Szeptember 8. · heti mintatanácskozás. Egy teljes, előre megírt
        beszélgetés eredményét és a mögötte álló vitát járhatod be.
      </p>
      <FlowTabs
        items={[
          ["result", "Mi változott?"],
          ["discussion", "A beszélgetés"],
        ]}
        value={view}
        onChange={setView}
      />
      {view === "result" ? (
        <>
          <div className="flow-status">
            Egy állítás pontosult, egyet tovább figyelünk.
          </div>
          <FlowRow
            icon="edit"
            title="A tervezett edzések segítenek elindulni"
            subtitle="Edzés és test · pontosított állítás"
            onClick={safe(api, "claim", { id: "c1" })}
          />
          <FlowRow
            icon="moon"
            title="Az esti séta és a pihenés kapcsolata"
            subtitle="Több adatot kérünk, nem emeltük bizonyossággá"
            onClick={safe(api, "pattern", { id: "walk-sleep" })}
          />
        </>
      ) : (
        <div className="conference-talk">
          {[
            [
              "Edző",
              "Javaslat",
              "A megtervezett napokon könnyebb volt az edzéskezdés. Az előzetes döntést érdemes a képben megtartani.",
            ],
            [
              "Szomnológus",
              "Kapcsolódás",
              "A jobb alvás is közrejátszhatott. A napirendet együtt kell néznünk a terheléssel.",
            ],
            [
              "Szkeptikus",
              "Ellenvetés",
              "Ebből még nem tudjuk, melyik okozta a változást. A személyes preferenciát és a megfigyelést válasszuk külön.",
            ],
            [
              "Boop",
              "Döntés",
              "Az előre tervezésről szóló állítást pontosítjuk. A séta és az alvás kapcsolatát tovább figyeljük, és Daniel visszajelzését kérjük.",
            ],
          ].map(([name, phase, text]) => (
            <div key={name}>
              <span className="flow-kicker">{phase}</span>
              <h2>{name}</h2>
              <p>{text}</p>
            </div>
          ))}
        </div>
      )}
      <p className="evidence-note">
        Előre megírt mintatanácskozás. Az éles funkció valódi futásának
        megjelenítési logikáját modellezi.
      </p>
    </div>
  );
}
function CharacterFeed({ api }) {
  return (
    <div className="flow-page">
      <Head eyebrow="KARAKTER · FEED" title="Így alakul a kép." />
      {api.state.insight.claims
        .filter((c) => c.feedback)
        .map((c) => (
          <FlowRow
            key={c.id}
            icon="edit"
            title={
              c.feedback === "reject"
                ? "Visszavontunk egy állítást"
                : "A te visszajelzésed is a kép része"
            }
            subtitle={c.correction || c.text}
            onClick={safe(api, "claim", { id: c.id })}
          />
        ))}
      {api.state.insight.feed.map((o) => (
        <FlowRow
          key={o.id}
          icon="lightbulb"
          title={o.text}
          subtitle={`${o.expert} · ${o.time}`}
          onClick={safe(api, "dimension", { id: o.dimension })}
        />
      ))}
      <FlowRow
        icon="message"
        title="A legutóbbi közös tanácskozás"
        subtitle="Eredmények és ellenvetések"
        onClick={safe(api, "conference")}
      />
    </div>
  );
}
function Engine({ api, page }) {
  if (page === "character-engine")
    return (
      <div className="flow-page">
        <Head
          eyebrow="A KÉP MÖGÖTT"
          title="Lásd, miből dolgozom."
          description="A működés részletei itt elérhetők. A mindennapi használathoz nem kell megismerned őket."
        />
        <Links
          api={api}
          items={[
            [
              "character-run",
              "activity",
              "Legutóbbi feldolgozás",
              "Ma 06:12 · naplókból és megfigyelésekből",
            ],
            [
              "character-sources",
              "book",
              "Adatforrások",
              "Amit naplóztál és megerősítettél",
            ],
            [
              "character-detectors",
              "search",
              "Mit figyelünk?",
              "Jelzések, lefedettség és bizonytalanság",
            ],
            [
              "memory",
              "layers",
              "Emlék és közös tudás",
              "Mi kerül a beszélgetésbe?",
            ],
          ]}
        />
      </div>
    );
  if (page === "character-run")
    return (
      <div className="flow-page">
        <Head eyebrow="MINTAFUTÁS · MA 06:12" title="Egy bejegyzés útja." />
        <div className="insight-timeline">
          {[
            "Alvásnapló és edzésadatok beolvasva",
            "A ritmusra utaló jelzések összegyűltek",
            "Az Edző és a Szomnológus nézőpontja megvizsgálta",
            "A Szkeptikus kevés összehasonlítható napot jelzett",
            "Egy állítást pontosítottunk; egyet tovább figyelünk",
          ].map((s, i) => (
            <div key={s}>
              <i />
              <p>
                <small>0{i + 1}</small>
                {s}
              </p>
            </div>
          ))}
        </div>
        <Links
          api={api}
          items={[
            [
              "character-feed",
              "activity",
              "Megnézem az eredményt",
              "A képed változásai",
            ],
            [
              "character-sources",
              "book",
              "A beolvasott források",
              "Naplók és saját visszajelzések",
            ],
          ]}
        />
      </div>
    );
  if (page === "character-sources")
    return (
      <div className="flow-page">
        <Head
          eyebrow="ADATFORRÁSOK"
          title="Amit megosztottál velem."
          description="A bemutató feltöltött mintanaplóval indul. Az új bejegyzéseid a helyi prototípusban maradnak."
        />
        <Links
          api={api}
          items={[
            [
              "me-sleep",
              "moon",
              "Alvás",
              "Időpont, minőség és esti körülmények",
            ],
            ["me-weight", "scale", "Súly", "Mérések és trend"],
            ["train", "dumbbell", "Mozgás", "Edzés, futás és sport"],
            [
              "fuel",
              "utensils",
              "Étkezés",
              "Naplózott ételek és visszajelzések",
            ],
            [
              "me-people",
              "users",
              "Kapcsolatok",
              "Az általad rögzített találkozások",
            ],
            ["journal", "book", "Saját szavaid", "Napló és reflexió"],
            [
              "knowledge",
              "check-circle",
              "Megerősített tudás",
              "Amit használhatok a válaszaimban",
            ],
          ]}
        />
      </div>
    );
  return (
    <div className="flow-page">
      <Head
        eyebrow="MIT FIGYELÜNK?"
        title="Kérdések a naplóidhoz."
        description="A mintákhoz előbb összehasonlítható napokra van szükség. A hiányzó adatot külön jelezzük."
      />
      {[
        ["Alvás és edzésteljesítmény", "12 közös nap · figyeljük", "sleep"],
        [
          "Tervezés és tényleges teljesítés",
          "21 nap · van megfigyelés",
          "body",
        ],
        ["Fehérje és edzésnapok", "9 közös nap · figyeljük", "fuel"],
        ["Kapcsolatok és közérzet", "4 bejegyzés · még gyűlik", "people"],
        [
          "Bevált és elvetett előrejelzések",
          "2 lezárt eredmény · önvizsgálat",
          "self-audit",
        ],
      ].map(([title, subtitle, id]) => (
        <FlowRow
          key={id}
          icon="search"
          title={title}
          subtitle={subtitle}
          onClick={safe(api, "dimension", { id })}
        />
      ))}
      <p className="evidence-note">
        Az éles rendszer nagyobb jelzéskatalógusából kiválasztott, szemléltető
        esetek.
      </p>
    </div>
  );
}
const sleepTime = (minutes) =>
  `${Math.floor(minutes / 60)} ó ${minutes % 60} p`;
function Week({ api, page }) {
  const [view, setView] = useState("story");
  const snapshot = weekSnapshot(api.params.period, api.state, api.nutrition);
  const { archived, period, days, completed } = snapshot;
  const averageSleep = Math.round(
    days.reduce((sum, d) => sum + d.sleepMinutes, 0) / days.length,
  );
  if (page === "week-archive")
    return (
      <div className="flow-page">
        <Head eyebrow="HETI · ARCHÍVUM" title="A ritmusod nyomai." />
        <Links
          api={api}
          items={[
            [
              "week",
              "calendar",
              "Szeptember 2–8.",
              "A legutóbbi hét nap",
              { period: "current" },
            ],
            [
              "week",
              "calendar",
              "Augusztus 26. – szeptember 1.",
              "Három edzés és egy újrakezdés",
              { period: "previous" },
            ],
          ]}
        />
      </div>
    );
  if (page === "week-day") {
    const d = days.find((d) => d.id === api.params.id);
    if (!d) return <Unknown api={api} />;
    return (
      <div className="flow-page">
        <Head
          eyebrow={`HETI · ${d.title}`}
          title={d.weekday}
          description={
            archived
              ? "A lezárt hét megőrzött napképe."
              : "A napi összkép a rögzített adataidból."
          }
        />
        {archived ? (
          <FlowRow
            icon={d.icon}
            title={d.activity}
            subtitle="A korábbi mintahét bejegyzése"
          />
        ) : d.movements.length ? (
          d.movements.map((m) => (
            <FlowRow
              key={`${m.route}:${m.id}`}
              icon={m.icon}
              title={m.title}
              subtitle={`${m.duration} perc · naplózott mozgás`}
              onClick={safe(api, m.route, m.params)}
            />
          ))
        ) : (
          <FlowRow
            icon={d.icon}
            title={d.activity}
            subtitle={
              d.id === "tue"
                ? "A terv még nem naplózott mozgás"
                : "Ezen a napon még nincs rögzített mozgás"
            }
          />
        )}
        {!archived && d.id === "tue" && !api.state.workoutFinished && (
          <FlowRow
            icon="dumbbell"
            title="A mai tervezett edzés"
            subtitle="Pull Day · megnyitás"
            onClick={safe(api, "workout")}
          />
        )}
        <FlowRow
          icon="moon"
          title={`${sleepTime(d.sleepMinutes)} alvás`}
          subtitle={
            archived ? "Megőrzött napi érték" : "Az adott nap alvásbejegyzése"
          }
          onClick={archived ? undefined : safe(api, "me-sleep-history")}
        />
        <FlowRow
          icon="utensils"
          title={`${d.kcal} kcal naplózva`}
          subtitle={
            archived
              ? "Megőrzött napi érték"
              : d.id === "tue"
                ? "A mai étkezési napló"
                : "A korábbi mintanap összesítése"
          }
          onClick={!archived && d.id === "tue" ? safe(api, "fuel") : undefined}
        />
        <Links
          api={api}
          items={[
            [
              "week",
              "calendar",
              "Vissza ehhez a héthez",
              snapshot.label,
              { period },
            ],
          ]}
        />
        {archived ? (
          <p className="evidence-note">
            Lezárt, szemléltető pillanatkép. A mai napló módosítása nem írja át
            ezt a hetet.
          </p>
        ) : (
          <CompanionNote
            action="Hozzáteszem a saját gondolatom"
            onClick={safe(api, "journal")}
          >
            A napi összképben a rögzített dolgok látszanak. A személyes
            jelentésüket te tudod hozzátenni.
          </CompanionNote>
        )}
      </div>
    );
  }
  if (page === "week-domain") {
    const domain = api.params.id || "movement";
    return (
      <div className="flow-page">
        <Head
          eyebrow={`HETI · ${snapshot.label}`}
          title={
            domain === "movement"
              ? "Mozgás, ami összeadódik."
              : domain === "sleep"
                ? "A pihenésed ritmusa."
                : "A feltöltődés mintája."
          }
        />
        <Sparkline
          values={days.map((d) =>
            domain === "sleep"
              ? d.sleepMinutes / 60
              : domain === "movement"
                ? d.movementMinutes
                : d.kcal,
          )}
          height={130}
          fill
        />
        <div className="flow-chart-caption">
          <span>{days[0].title}</span>
          <span>{days.at(-1).title}</span>
        </div>
        <p className="evidence-note">
          {domain === "sleep"
            ? "Alvásidő · óra"
            : domain === "movement"
              ? "Mozgás · perc"
              : "Naplózott energia · kcal"}{" "}
          ·{" "}
          {archived
            ? "Lezárt mintahét, változatlan értékek."
            : "A mintanapok és a mai bejegyzéseid."}
        </p>
        <Links
          api={api}
          items={[
            [
              "week",
              "calendar",
              "Vissza ehhez a héthez",
              snapshot.label,
              { period },
            ],
            ...(!archived
              ? [
                  [
                    domain === "movement"
                      ? "train"
                      : domain === "sleep"
                        ? "me-sleep"
                        : "fuel",
                    "book",
                    "Megnyitom a naplót",
                    "A rögzített adataim",
                  ],
                ]
              : []),
          ]}
        />
      </div>
    );
  }
  return (
    <div className="flow-page">
      <Head eyebrow={`HETI · ${snapshot.label}`} title={snapshot.title} />
      <FlowTabs
        items={[
          ["story", "A történet"],
          ["days", "Napról napra"],
          ["numbers", "Számok és trendek"],
        ]}
        value={view}
        onChange={setView}
      />
      {view === "story" ? (
        <>
          <div className="week-editorial">
            <span>01 / AMI ÖSSZEÁLLT</span>
            <h2>
              {completed} edzés.
              <br />
              És hely az életnek.
            </h2>
            <p>
              {archived
                ? "Rövidebb alkalmakból épült fel az újrakezdés. A hét végére már volt egy ritmus, amihez visszatérhettél."
                : "A tervezett mozgás mellett a közös programok és a lassabb esték is helyet kaptak. Ez adta a hét tartását."}
            </p>
          </div>
          <div className="week-editorial">
            <span>02 / AMIT HANGOLUNK</span>
            <h2>
              {archived
                ? "Elég egy kisebb kezdet."
                : "Kevesebb döntés, több nyugodt kezdet."}
            </h2>
            <p>
              {archived
                ? "Az első rövid edzés után könnyebb volt folytatni. A közös séta is helyet kapott a mozgás mellett."
                : "Az előre kiválasztott edzés és a kéznél lévő étel csökkentette a délutáni döntéseket. Ezt érdemes megtartanunk."}
            </p>
          </div>
          {!archived && (
            <CompanionNote
              action="Megtervezem a következő lépést"
              onClick={safe(api, "train-cycles")}
            >
              A következő hétben legyen elég tér az erőnek, a futásnak és a
              pihenésnek is.
            </CompanionNote>
          )}
        </>
      ) : view === "days" ? (
        days.map((d) => (
          <FlowRow
            key={d.id}
            icon={d.icon}
            title={`${d.weekday} · ${d.activity}`}
            subtitle={d.title}
            onClick={safe(api, "week-day", { id: d.id, period })}
          />
        ))
      ) : (
        <>
          <div className="week-stats">
            <div>
              <b>{completed}</b>
              <span>erősítő edzés</span>
            </div>
            <div>
              <b>{snapshot.distance}</b>
              <span>{archived ? "km mozgás" : "km futás"}</span>
            </div>
            <div>
              <b>
                {Math.floor(averageSleep / 60)}:
                {String(averageSleep % 60).padStart(2, "0")}
              </b>
              <span>átlagos alvás</span>
            </div>
          </div>
          <Links
            api={api}
            items={[
              [
                "week-domain",
                "activity",
                "Mozgás közelről",
                "Erősítés, futás és sport",
                { id: "movement", period },
              ],
              [
                "week-domain",
                "moon",
                "Alvás közelről",
                "Időtartam és ritmus",
                { id: "sleep", period },
              ],
              [
                "week-domain",
                "utensils",
                "Étkezés közelről",
                "Feltöltődés a napok között",
                { id: "fuel", period },
              ],
            ]}
          />
        </>
      )}
      <Links
        api={api}
        items={[
          [
            "week-archive",
            "calendar",
            "Korábbi hetek",
            "A változás hosszabb története",
          ],
          [
            "memoir",
            "book",
            "A heted személyes fejezete",
            "Boop összefűzi a megfigyeléseket",
            archived ? { id: "earlier" } : {},
          ],
        ]}
      />
      {archived && (
        <p className="evidence-note">
          Lezárt, szemléltető mintahét. A napi részletek és a diagramok ehhez az
          időszakhoz tartoznak.
        </p>
      )}
    </div>
  );
}
function Experiments({ api, detail }) {
  const e = api.state.insight.experiments.find(
    (e) => e.id === (api.params.id || "exp1"),
  );
  if (detail && !e) return <Unknown api={api} />;
  if (!detail)
    return (
      <div className="flow-page">
        <Head
          eyebrow="KÖZÖS KÍSÉRLETEK"
          title="Egy kis változtatás.<br/>A saját tapasztalatod."
          description="Előbb átnézed, aztán eldöntöd, belevágsz-e. Egyetlen javaslat sem indul el magától."
        />
        {api.state.insight.experiments.map((e) => (
          <FlowRow
            key={e.id}
            icon="leaf"
            title={e.title}
            subtitle={`${e.days} nap · ${e.status === "proposed" ? "Javaslat" : e.status === "active" ? "Folyamatban" : e.status === "done" ? "Lezárva" : "Félretéve"}`}
            onClick={safe(api, "experiment", { id: e.id })}
          />
        ))}
      </div>
    );
  return (
    <div className="flow-page">
      <Head
        eyebrow={`${e.days} NAPOS KÍSÉRLET`}
        title={e.title}
        description={e.description}
      />
      <Links
        api={api}
        items={[
          [
            "pattern",
            "chart",
            "Miért ezt javaslom?",
            "A megfigyelés, amiből kiindulunk",
            { id: e.patternId },
          ],
        ]}
      />
      {e.status === "proposed" || e.status === "declined" ? (
        <>
          <button
            className="primary-button"
            onClick={() => {
              api.update("insight", (s) => decideExperiment(s, e.id, "active"));
              api.notify({
                kind: "insight",
                title: "Elindult egy kis kísérlet",
                body: e.title,
                route: "experiment",
                params: { id: e.id },
              });
              api.celebrate();
            }}
          >
            Belevágok
          </button>
          <button
            className="secondary-button"
            onClick={() => {
              api.update("insight", (s) =>
                decideExperiment(s, e.id, "declined"),
              );
              api.toast("Félretettük; bármikor visszatérhetsz");
            }}
          >
            Most nem fér bele
          </button>
        </>
      ) : (
        <>
          <div className="experiment-days">
            {Array.from({ length: e.days }, (_, i) => (
              <button
                key={i}
                aria-label={`${i + 1}. kísérleti nap`}
                aria-pressed={e.completed.includes(i + 1)}
                onClick={() =>
                  api.update("insight", (s) => ({
                    ...s,
                    experiments: s.experiments.map((x) =>
                      x.id === e.id
                        ? {
                            ...x,
                            completed: x.completed.includes(i + 1)
                              ? x.completed.filter((n) => n !== i + 1)
                              : [...x.completed, i + 1],
                          }
                        : x,
                    ),
                  }))
                }
              >
                <span>{i + 1}</span>
                {e.completed.includes(i + 1) && <Icon name="check" size={15} />}
              </button>
            ))}
          </div>
          <span className="flow-kicker">
            {e.completed.length} / {e.days} nap jelölve
          </span>
          <button
            className="primary-button"
            disabled={!e.completed.length || e.status === "done"}
            onClick={() => {
              api.update("insight", (s) => decideExperiment(s, e.id, "done"));
              api.toast("Lezárva — a tapasztalatodat átbeszélhetjük");
            }}
          >
            {e.status === "done"
              ? "A kísérlet lezárva"
              : "Lezárom és átgondolom"}
          </button>
          {e.status === "done" && (
            <CompanionNote
              action="Átbeszélem a tapasztalatom"
              onClick={() => api.ask(`Lezártam ezt a kísérletet: ${e.title}.`)}
            >
              A kipipált napok a részvételt mutatják. Az eredmény értelmezéséhez
              a közérzeted és a naplóid is kellenek.
            </CompanionNote>
          )}
          <FlowRow
            icon="moon"
            title="Reggeli alvásnapló"
            subtitle="A következő megfigyelés alapja"
            onClick={safe(api, "me-sleep-log")}
          />
        </>
      )}
    </div>
  );
}
function Memoir({ api, archive }) {
  const chapter = api.params.id === "earlier",
    chapterId = chapter ? "earlier" : "current",
    liked = Boolean(api.state.insight.memoirLikes?.[chapterId]);
  if (archive)
    return (
      <div className="flow-page">
        <Head
          eyebrow="MEMOÁR · FEJEZETEK"
          title="A történeted nem csak számokból áll."
        />
        <Links
          api={api}
          items={[
            [
              "memoir",
              "book",
              "A kiszámítható napok csendes ereje",
              "Szeptember 8. · heti fejezet",
            ],
            [
              "memoir",
              "book",
              "Visszatalálni a mozgáshoz",
              "Szeptember 1. · korábbi fejezet",
              { id: "earlier" },
            ],
          ]}
        />
      </div>
    );
  return (
    <div className="flow-page memoir-page">
      <Head
        eyebrow={`MEMOÁR · ${chapter ? "SZEPTEMBER 1." : "SZEPTEMBER 8."}`}
        title={
          chapter
            ? "Visszatalálni<br/>a mozgáshoz."
            : "A kiszámítható napok<br/>csendes ereje."
        }
      />
      <Avatar size={66} />
      <article>
        <p>
          {chapter
            ? "Nem egy nagy elhatározással indult. Csak egy rövidebb edzéssel, aminek helyet találtál."
            : "Ezen a héten többször előre eldöntötted, mikor mozogsz. Amikor eljött az idő, már kevesebb kérdés maradt."}
        </p>
        <p>
          A naplód szerint a közös sport és az esti séta is része volt a
          hetednek. Nem minden nap alakult a terv szerint, mégis volt mihez
          visszatérned.
        </p>
        <p>
          Talán az volt a hét legfontosabb mozdulata, hogy hagytál helyet a
          folytatásnak. Ezt a történetet a saját szavaiddal teheted igazán a
          tiéddé.
        </p>
      </article>
      <button
        className="secondary-button"
        aria-pressed={liked}
        onClick={() =>
          api.update("insight", (s) => toggleMemoirLike(s, chapterId))
        }
      >
        <Icon name="heart" />
        {liked ? "Ez megszólított" : "Megszólított ez a fejezet?"}
      </button>
      <Links
        api={api}
        items={[
          [
            "journal",
            "edit",
            "Hozzáteszem a saját hangom",
            "Mi volt neked fontos a héten?",
          ],
          [
            "memoir-archive",
            "book",
            "Korábbi fejezetek",
            "A történet folytatódik",
          ],
        ]}
      />
      <p className="evidence-note">
        Előre megírt irodalmi minta, a bemutató naplójához.
      </p>
    </div>
  );
}
function Memory({ api }) {
  return (
    <div className="flow-page">
      <Head
        eyebrow="EMLÉK ÉS KÖZÖS TUDÁS"
        title="Amit tudok,<br/>annak legyen eredete."
      />
      <Links
        api={api}
        items={[
          [
            "journal",
            "book",
            "A saját szavaid",
            "Naplók, reflexiók és bejegyzések",
          ],
          [
            "knowledge",
            "check-circle",
            "Megerősített tények",
            `${api.state.insight.facts.filter((f) => f.enabled).length} használható ebben a bemutatóban`,
          ],
          [
            "character",
            "brain",
            "Összeálló kép",
            "Állítások, amelyekre visszajelezhetsz",
          ],
          [
            "character-sources",
            "layers",
            "Alapul szolgáló naplók",
            "Hol keletkezett az információ?",
          ],
          [
            "communication",
            "message",
            "A beszélgetés módja",
            "Te alakítod, hogyan szólok hozzád",
          ],
        ]}
      />
      <CompanionNote>
        Egy naplóbejegyzés emlék. Egy megerősített tény közös tudás. Egy rólad
        szóló állítás pedig javítható értelmezés.
      </CompanionNote>
    </div>
  );
}
export default function InsightFlow({ page, api }) {
  if (page === "mezo") return <Hub api={api} />;
  if (page === "patterns") return <Patterns api={api} />;
  if (page === "pattern") return <Pattern api={api} />;
  if (page === "predictions") return <Predictions api={api} />;
  if (page === "prediction") return <Prediction api={api} />;
  if (page === "knowledge") return <Knowledge api={api} />;
  if (page === "fact") return <Fact api={api} />;
  if (page.startsWith("knowledge-categor"))
    return (
      <KnowledgeCategories api={api} detail={page === "knowledge-category"} />
    );
  if (page === "communication") return <Communication api={api} />;
  if (page === "character") return <Dossier api={api} />;
  if (page === "dimensions") return <Dimensions api={api} />;
  if (page === "dimension") return <Dimension api={api} />;
  if (page === "claim") return <Claim api={api} />;
  if (page === "team" || page === "expert")
    return <Team api={api} detail={page === "expert"} />;
  if (page === "conference") return <Conference api={api} />;
  if (page === "character-feed") return <CharacterFeed api={api} />;
  if (page.startsWith("character-")) return <Engine api={api} page={page} />;
  if (page === "week" || page.startsWith("week-"))
    return <Week api={api} page={page} />;
  if (page === "experiments" || page === "experiment")
    return <Experiments api={api} detail={page === "experiment"} />;
  if (page === "memoir" || page === "memoir-archive")
    return <Memoir api={api} archive={page === "memoir-archive"} />;
  if (page === "memory") return <Memory api={api} />;
  return null;
}
