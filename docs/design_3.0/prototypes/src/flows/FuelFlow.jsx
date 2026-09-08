import React, { useState } from "react";
import { Icon, FoodArt, Ring } from "../shared.jsx";
import {
  FlowHead,
  FlowTabs,
  FlowRow,
  CompanionNote,
  EmptyState,
} from "./FlowUI.jsx";
import {
  draftFromText,
  draftTotals,
  mealFromDraft,
  recipeNeeds,
  addRecipeShopping,
  purchaseShopping,
  savePantryItem,
  consumeRecipe,
  saveRecipe,
} from "./fuel-state.mjs";
import "./fuel-flow.css";

export const FUEL_ROUTES = {
  fuel: { title: "Fuel", parent: "home" },
  "fuel-log": { title: "Étkezés hozzáadása", parent: "fuel" },
  "fuel-review": { title: "Adag ellenőrzése", parent: "fuel-log" },
  "fuel-meal": { title: "Étkezés", parent: "fuel" },
  "fuel-evaluation": { title: "Mezo értékelése", parent: "fuel-meal" },
  "fuel-pantry": { title: "Kamra", parent: "fuel" },
  "fuel-item": { title: "A kamrádban", parent: "fuel-pantry" },
  "fuel-item-edit": { title: "Kamra szerkesztése", parent: "fuel-pantry" },
  "fuel-stock": { title: "Készletellenőrzés", parent: "fuel-pantry" },
  "fuel-recipes": { title: "Receptek", parent: "fuel" },
  "fuel-recipe": { title: "Recept", parent: "fuel-recipes" },
  "fuel-recipe-edit": { title: "Recept szerkesztése", parent: "fuel-recipes" },
  "fuel-cook": { title: "Főzzünk együtt", parent: "fuel-recipe" },
  "fuel-shopping": { title: "Bevásárlólista", parent: "fuel-pantry" },
  "fuel-plan": { title: "Étkezési ritmus", parent: "fuel" },
  "fuel-settings": { title: "Fuel beállítások", parent: "fuel" },
};
const uid = () =>
  `fuel-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const number = (n) => Math.round(n).toLocaleString("hu-HU");
function Action({
  children,
  onClick,
  secondary = false,
  disabled = false,
  type = "button",
}) {
  return (
    <button
      type={type}
      className={secondary ? "secondary-button" : "primary-button"}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
function Macros({ values }) {
  return (
    <div className="fuel-macros">
      {[
        ["kcal", "kcal"],
        ["protein", "g fehérje"],
        ["carbs", "g szénhidrát"],
        ["fat", "g zsír"],
      ].map(([key, label]) => (
        <div key={key}>
          <strong>{number(values[key] || 0)}</strong>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}
function Field({ label, children }) {
  return (
    <label className="flow-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Section({ title, action, children }) {
  return (
    <section className="flow-section">
      <div className="flow-section-heading">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
function Portion({ value, onChange }) {
  return (
    <div className="fuel-portion">
      <span>Adag</span>
      <button
        aria-label="Kevesebb adag"
        disabled={value <= 0.5}
        onClick={() => onChange(Math.max(0.5, value - 0.5))}
      >
        −
      </button>
      <strong>{value.toLocaleString("hu-HU")}</strong>
      <button
        aria-label="Több adag"
        disabled={value >= 12}
        onClick={() => onChange(Math.min(12, value + 0.5))}
      >
        +
      </button>
    </div>
  );
}
function Unavailable({ api, title = "Ez az elem már nincs itt." }) {
  return (
    <EmptyState
      title={title}
      description="A kamrában vagy a recepttárban választhatsz másikat."
      action="Vissza a Fuelhez"
      onClick={() => api.go("fuel")}
    />
  );
}
function startRecipe(api, recipe, portions = 1) {
  const draft = {
    name: recipe.name,
    kind: recipe.kind,
    time: "19:00",
    slot: recipe.category,
    source: "Saját recept · minta tápanyagadatok",
    recipeId: recipe.id,
    ingredients: recipe.ingredients.map((i) => ({
      ...i,
      amount: Math.round((i.amount * portions) / recipe.servings),
    })),
  };
  api.update("fuel", (s) => ({ ...s, draft }));
  api.go("fuel-review");
}
function Hub({ api }) {
  const s = api.state.fuel,
    n = api.nutrition,
    target = s.targets;
  const remaining = Math.max(0, target.kcal - n.kcal);
  return (
    <>
      <FlowHead
        eyebrow="KEDD, SZEPTEMBER 8."
        title={
          api.variant === "companion"
            ? "Tápláld a napodat."
            : "A mai egyensúlyod."
        }
        description={
          api.variant === "companion"
            ? "A naplód, a kamrád és néhány jó ötlet. Egy helyen."
            : "A kis döntésekből áll össze egy jó nap."
        }
      />
      <div className="fuel-energy">
        <Ring value={n.kcal} max={target.kcal} size={192} width={8} />
        <div>
          <span>Még a napi keretből</span>
          <strong>{number(remaining)}</strong>
          <small>kcal · {number(n.kcal)} elfogyasztva</small>
        </div>
      </div>
      <div className="fuel-targets">
        {[
          ["protein", "Fehérje"],
          ["carbs", "Szénhidrát"],
          ["fat", "Zsír"],
        ].map(([k, l]) => (
          <div key={k}>
            <span>{l}</span>
            <strong>
              {n[k]} <small>/ {target[k]} g</small>
            </strong>
            <progress aria-label={l} value={n[k]} max={target[k]} />
          </div>
        ))}
      </div>
      <div className="flow-actions">
        <Action onClick={() => api.go("fuel-log")}>
          <Icon name="plus" />
          Étkezés hozzáadása
        </Action>
      </div>
      {api.variant === "companion" && (
        <CompanionNote
          action="Nézzük a vacsorát"
          onClick={() => api.go("fuel-recipe", { id: "salmon-bowl" })}
        >
          A mai edzés mellé egy egyszerű vacsorát készítettünk elő. A
          lazactálhoz a kamrádat is megnézheted.
        </CompanionNote>
      )}
      <Section
        title="Mai étkezések"
        action={
          <button className="text-button" onClick={() => api.go("fuel-plan")}>
            A ritmusom
            <Icon name="arrow-right" size={15} />
          </button>
        }
      >
        <div className="fuel-meal-list">
          {api.state.meals.map((m) => (
            <button
              key={m.id}
              className="fuel-meal-row"
              onClick={() => api.go("fuel-meal", { id: m.id })}
            >
              <FoodArt kind={m.kind} />
              <span>
                <small>
                  {m.time} · {m.slot || "Naplózott étkezés"}
                </small>
                <strong>{m.name}</strong>
                <span>
                  {m.kcal} kcal · {m.protein} g fehérje
                </span>
              </span>
              <Icon name="chevron-right" size={17} />
            </button>
          ))}
        </div>
      </Section>
      <div className="fuel-water">
        <span className="fuel-water-icon">
          <Icon name="droplet" size={25} />
        </span>
        <div>
          <strong>
            {(api.state.water / 1000).toLocaleString("hu-HU")} /{" "}
            {target.water / 1000} l
          </strong>
          <span>Víz a mai naplóban</span>
        </div>
        <button aria-label="250 milliliter víz hozzáadása" onClick={api.water}>
          + 250 ml
        </button>
      </div>
      <Section title="Jó alapok">
        <div className="fuel-doors">
          <button onClick={() => api.go("fuel-recipes")}>
            <FoodArt kind="salmon" />
            <span className="flow-kicker">ÖTLETBŐL VACSORA</span>
            <strong>Receptek</strong>
            <span>
              {s.recipes.length} saját ötlet
              <Icon name="arrow-up-right" size={17} />
            </span>
          </button>
          <button onClick={() => api.go("fuel-pantry")}>
            <div className="fuel-shelf-art">
              <i />
              <i />
              <i />
              <i />
            </div>
            <span className="flow-kicker">AMI OTTHON VAN</span>
            <strong>Kamra</strong>
            <span>
              {s.pantry.length} alapanyag
              <Icon name="arrow-up-right" size={17} />
            </span>
          </button>
        </div>
      </Section>
      <div className="flow-list">
        <FlowRow
          icon="box"
          title="Bevásárlólista"
          subtitle={`${s.shopping.filter((i) => !i.bought).length} tétel vár beszerzésre`}
          onClick={() => api.go("fuel-shopping")}
        />
        <FlowRow
          icon="settings"
          title="Keret és tápanyagcélok"
          onClick={() => api.go("fuel-settings")}
        />
      </div>
    </>
  );
}
function Log({ api }) {
  const [mode, setMode] = useState("text"),
    [text, setText] = useState(""),
    [query, setQuery] = useState("");
  const s = api.state.fuel;
  function draft(t, source) {
    api.update("fuel", (current) => ({
      ...current,
      draft: draftFromText(current, t, source),
    }));
    api.go("fuel-review");
  }
  return (
    <>
      <FlowHead
        eyebrow="EGY KIS FIGYELEM MAGADRA"
        title="Mit ettél?"
        description="Mondd el a saját szavaiddal, vagy válassz a már ismert ételeidből."
      />
      <FlowTabs
        items={[
          ["text", "Leírom"],
          ["photo", "Fotópélda"],
          ["pantry", "Kamrából"],
        ]}
        value={mode}
        onChange={setMode}
      />
      {mode === "text" ? (
        <>
          <Field label="Az étkezésed">
            <textarea
              rows={4}
              placeholder="Például: 150 g lazac, 180 g rizs, 150 g brokkoli"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </Field>
          <div className="fuel-example">
            <button
              onClick={() => setText("150 g lazac, 180 g rizs, 150 g brokkoli")}
            >
              Lazacos vacsora
            </button>
            <button
              onClick={() => setText("60 g zab, 150 g joghurt, 80 g áfonya")}
            >
              Reggeli zabkása
            </button>
          </div>
          <p className="fuel-honesty">
            <Icon name="sparkles" size={16} />
            Mintaértelmezés: a kamrában ismert neveket és grammokat keresi. Nem
            fut külső AI.
          </p>
          <Action
            disabled={!text.trim()}
            onClick={() => draft(text, "Szöveges mintaértelmezés")}
          >
            Adagok áttekintése
            <Icon name="arrow-right" />
          </Action>
        </>
      ) : mode === "photo" ? (
        <>
          <div className="fuel-photo">
            <FoodArt kind="salmon" />
            <span>Illusztrált mintatányér · nem feltöltött fotó</span>
          </div>
          <h2>Nézzünk meg egy példát.</h2>
          <p className="flow-copy">
            A fotós folyamatot ezen az előre elkészített mintán próbálhatod ki.
            A becsült adagokat mentés előtt javíthatod.
          </p>
          <Action
            onClick={() =>
              draft(
                "150 g lazac, 180 g rizs, 150 g brokkoli",
                "Fotópélda · előre megírt becslés",
              )
            }
          >
            Fotópélda kipróbálása
            <Icon name="camera" />
          </Action>
        </>
      ) : (
        <>
          <Field label="Alapanyag keresése">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Név a kamrából"
            />
          </Field>
          <div className="flow-list">
            {s.pantry
              .filter((i) =>
                i.name
                  .toLocaleLowerCase("hu")
                  .includes(query.toLocaleLowerCase("hu")),
              )
              .map((i) => (
                <FlowRow
                  key={i.id}
                  icon="box"
                  title={i.name}
                  subtitle={`${i.kcal} kcal / 100 g`}
                  onClick={() => {
                    api.update("fuel", (current) => ({
                      ...current,
                      draft: {
                        name: i.name,
                        kind: "bowl",
                        time: "19:00",
                        slot: "Kisétkezés",
                        source: "Saját kamra · mintaadat",
                        ingredients: [{ id: i.id, amount: 100 }],
                      },
                    }));
                    api.go("fuel-review");
                  }}
                />
              ))}
          </div>
        </>
      )}
      <Section title="A saját receptjeimből">
        <div className="flow-list">
          {s.recipes.slice(0, 3).map((r) => (
            <FlowRow
              key={r.id}
              icon="chef"
              title={r.name}
              subtitle={`${r.minutes} perc`}
              onClick={() => startRecipe(api, r)}
            />
          ))}
        </div>
      </Section>
    </>
  );
}
function Review({ api }) {
  const s = api.state.fuel,
    d = s.draft;
  const [pick, setPick] = useState(""),
    [error, setError] = useState("");
  if (!d) return <Unavailable api={api} title="Kezdjünk egy étkezéssel." />;
  const update = (patch) =>
    api.update("fuel", (current) => ({
      ...current,
      draft: { ...current.draft, ...patch },
    }));
  function save() {
    try {
      const m = mealFromDraft(s, d, d.editId || uid());
      if (d.editId)
        api.update("meals", (meals) =>
          meals.map((old) => (old.id === d.editId ? m : old)),
        );
      else api.addMeal(m);
      api.update("fuel", (current) => ({ ...current, draft: null }));
      api.celebrate();
      api.go("fuel-meal", { id: m.id });
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <>
      <FlowHead
        eyebrow="ELLENŐRZÉS · MENTÉS ELŐTT"
        title="A te tányérod, pontosabban."
        description="A mennyiség becslés. Javítsd arra, amit tényleg ettél."
      />
      <Field label="Étkezés neve">
        <input
          value={d.name}
          maxLength={70}
          onChange={(e) => update({ name: e.target.value })}
        />
      </Field>
      <div className="flow-grid">
        <Field label="Étkezés">
          <select
            value={d.slot}
            onChange={(e) => update({ slot: e.target.value })}
          >
            {["Reggeli", "Ebéd", "Vacsora", "Kisétkezés"].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Időpont">
          <input
            type="time"
            value={d.time}
            onChange={(e) => update({ time: e.target.value })}
          />
        </Field>
      </div>
      <Section title="Mi került bele?">
        {!d.ingredients.length && (
          <p className="fuel-message">
            Ezt a szöveget a próba nem ismerte fel. Válassz alapanyagot alább,
            vagy vedd fel a kamrába.
          </p>
        )}
        <div className="fuel-ingredients">
          {d.ingredients.map((i) => (
            <div className="fuel-ingredient" key={i.id}>
              <div>
                <strong>{s.pantry.find((p) => p.id === i.id)?.name}</strong>
                <small>
                  {Math.round(
                    ((s.pantry.find((p) => p.id === i.id)?.kcal || 0) *
                      i.amount) /
                      100,
                  )}{" "}
                  kcal · mintaadat
                </small>
              </div>
              <label>
                <input
                  aria-label={`${s.pantry.find((p) => p.id === i.id)?.name} mennyisége gramm`}
                  type="number"
                  min="1"
                  max="5000"
                  value={i.amount}
                  onChange={(e) => {
                    const amount = e.target.value;
                    update({
                      ingredients: d.ingredients.map((row) =>
                        row.id === i.id
                          ? {
                              ...row,
                              amount: amount === "" ? "" : Number(amount),
                            }
                          : row,
                      ),
                    });
                  }}
                />
                <span>g</span>
              </label>
              <button
                className="fuel-icon-button"
                aria-label="Hozzávaló eltávolítása"
                onClick={() =>
                  update({
                    ingredients: d.ingredients.filter((row) => row.id !== i.id),
                  })
                }
              >
                <Icon name="x" size={17} />
              </button>
            </div>
          ))}
        </div>
        <Field label="További hozzávaló">
          <select
            value={pick}
            onChange={(e) => {
              const id = e.target.value;
              setPick("");
              if (id)
                update({
                  ingredients: [...d.ingredients, { id, amount: 100 }],
                });
            }}
          >
            <option value="">+ Válassz a kamrából</option>
            {s.pantry
              .filter((p) => !d.ingredients.some((i) => i.id === p.id))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </Field>
        <button
          className="text-button"
          onClick={() => api.go("fuel-item-edit", { return: "review" })}
        >
          Hiányzó alapanyag felvétele
          <Icon name="plus" size={16} />
        </button>
      </Section>
      <Macros values={draftTotals(s, d)} />
      <p className="fuel-honesty">
        <Icon name="info" size={17} />
        {d.source}. A tápanyagok a szerkeszthető mintaadatbázisból számolódnak.
      </p>
      {error && (
        <p role="alert" className="fuel-error">
          {error}
        </p>
      )}
      <Action
        disabled={
          !d.name.trim() ||
          !d.ingredients.length ||
          d.ingredients.some((i) => !(Number(i.amount) > 0)) ||
          !d.time
        }
        onClick={save}
      >
        <Icon name="check" />
        {d.editId ? "Javítás mentése" : "Étkezés mentése"}
      </Action>
    </>
  );
}
function Meal({ api, evaluation = false }) {
  const m =
    api.state.meals.find((m) => m.id === api.params.id) ||
    (!api.params.id ? api.state.meals.at(-1) : null);
  if (!m) return <Unavailable api={api} />;
  const high = m.protein >= 25;
  function edit() {
    api.update("fuel", (s) => ({
      ...s,
      draft: {
        name: m.name,
        kind: m.kind,
        time: m.time,
        slot: m.slot || "Ebéd",
        source: m.assessment?.source || "Korábbi napló · mintaadat",
        ingredients:
          m.ingredients?.map((i) => ({ id: i.id, amount: i.amount })) ||
          draftFromText(s, m.name).ingredients,
        editId: m.id,
      },
    }));
    api.go("fuel-review");
  }
  return (
    <>
      <FlowHead
        eyebrow={
          evaluation ? "MEZO · ÉTKEZÉSI OLVASAT" : `${m.time} · MAI NAPLÓ`
        }
        title={evaluation ? "Mit ad ez a tányér?" : m.name}
        description={evaluation ? m.name : undefined}
      />
      {!evaluation && (
        <div className="fuel-dish-hero">
          <FoodArt kind={m.kind} />
        </div>
      )}
      <Macros values={m} />
      {evaluation ? (
        <>
          <CompanionNote state="attentive">
            {high
              ? `Ebben az étkezésben ${m.protein} g fehérje van a napló szerint. A mennyiség és az összetevők pontosítása segít értelmezni a teljes napot.`
              : "Egy étkezésnek nem kell mindent tudnia. Nézzük meg, mit ad hozzá a napodhoz, és mire van még kedved."}
          </CompanionNote>
          <Section title="Három nézőpont">
            <FlowRow
              icon="activity"
              title="Tápanyagok"
              subtitle={`${m.protein} g fehérje, ${m.carbs} g szénhidrát és ${m.fat} g zsír a naplózott adagban.`}
            />
            <FlowRow
              icon="clock"
              title="Időzítés"
              subtitle={`${m.time}-kor naplóztad. A napod ritmusával együtt érdemes nézni.`}
            />
            <FlowRow
              icon="leaf"
              title="Összetétel"
              subtitle={
                m.ingredients?.some((i) => i.id === "broccoli")
                  ? "A brokkoli zöldséget ad ehhez a tányérhoz."
                  : "A változatosságot a teljes napi étkezéseid mutatják meg."
              }
            />
          </Section>
          <Section title="Egy következő lépés">
            <div className="fuel-suggestion">
              <span className="flow-kicker">KIPRÓBÁLHATÓ ÖTLET</span>
              <h2>
                {high
                  ? "Legyen egyszerű a következő étkezés."
                  : "Nézz meg egy joghurtos ötletet."}
              </h2>
              <p>
                A receptet a saját adagodra alakíthatod, és megnézheted, mi van
                hozzá otthon.
              </p>
              <button
                className="text-button"
                onClick={() =>
                  api.go("fuel-recipe", {
                    id: high ? "salmon-bowl" : "banana-yogurt",
                  })
                }
              >
                Recept megnyitása
                <Icon name="arrow-right" size={17} />
              </button>
            </div>
          </Section>
          <Section title="Miből készült az olvasat?">
            <div className="fuel-sources">
              <p>
                <strong>Forrás</strong>
                <span>
                  {m.assessment?.source || "Prototípus étkezési napló"}
                </span>
              </p>
              <p>
                <strong>Bizonyosság</strong>
                <span>
                  {m.ingredients
                    ? "A mennyiségek szerkeszthetők; a tápanyagadatok minták."
                    : "Magértékek a mintanaplóból; a hozzávalók nincsenek részletezve."}
                </span>
              </p>
              <p>
                <strong>Korlát</strong>
                <span>
                  Szabályalapú próbaolvasat. Nem fut AI, nem klinikai értékelés.
                </span>
              </p>
            </div>
          </Section>
          <Action secondary onClick={edit}>
            Adatok pontosítása
            <Icon name="edit" />
          </Action>
          <button
            className="text-button fuel-ask"
            onClick={() =>
              api.ask(
                `Beszéljük át ezt az étkezést: ${m.name}, ${m.kcal} kcal, ${m.protein} g fehérje.`,
              )
            }
          >
            Beszéljük át Mezoval
            <Icon name="message" size={17} />
          </button>
        </>
      ) : (
        <>
          <div className="flow-actions">
            <Action onClick={() => api.go("fuel-evaluation", { id: m.id })}>
              <Icon name="sparkles" />
              Mezo olvasata
            </Action>
            <Action secondary onClick={edit}>
              <Icon name="edit" />
              Adag javítása
            </Action>
          </div>
          <Section title="Hozzávalók">
            {m.ingredients?.length ? (
              <div className="flow-list">
                {m.ingredients.map((i) => (
                  <FlowRow
                    key={i.id}
                    title={
                      i.name ||
                      api.state.fuel.pantry.find((p) => p.id === i.id)?.name ||
                      i.id
                    }
                    value={`${i.amount} g`}
                    onClick={() => api.go("fuel-item", { id: i.id })}
                  />
                ))}
              </div>
            ) : (
              <p className="flow-copy">
                Ez a mintanapló csak összesített tápanyagokat tartalmaz. Az adag
                javításakor hozzáadhatod a pontos hozzávalókat.
              </p>
            )}
          </Section>
          <FlowRow
            icon="calendar"
            title="Vissza a mai naphoz"
            subtitle={`${api.state.meals.length} étkezés a naplóban`}
            onClick={() => api.go("fuel")}
          />
        </>
      )}
    </>
  );
}
function Pantry({ api }) {
  const [filter, setFilter] = useState("Mind"),
    [query, setQuery] = useState("");
  const s = api.state.fuel;
  const items = s.pantry.filter(
    (i) =>
      (filter === "Mind" ||
        (filter === "Kevés" ? i.stock < 150 : i.category === filter)) &&
      i.name.toLocaleLowerCase("hu").includes(query.toLocaleLowerCase("hu")),
  );
  return (
    <>
      <FlowHead
        eyebrow="A KONYHÁD KIS TÉRKÉPE"
        title="Amiből jó lesz főzni."
        description={`${s.pantry.length} alapanyag. Az itt megadott készlet a recepteknél is megjelenik.`}
      />
      <div className="flow-actions">
        <Action onClick={() => api.go("fuel-item-edit")}>
          <Icon name="plus" />
          Új alapanyag
        </Action>
        <Action secondary onClick={() => api.go("fuel-stock")}>
          Készletellenőrzés
        </Action>
      </div>
      <Field label="Keresés a kamrában">
        <input
          placeholder="Rizs, joghurt, áfonya…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </Field>
      <FlowTabs
        items={["Mind", "Kevés", "Fehérje", "Gabonák", "Zöldség"].map((v) => [
          v,
          v,
        ])}
        value={filter}
        onChange={setFilter}
      />
      <div className="flow-list">
        {items.map((i) => (
          <FlowRow
            key={i.id}
            icon={
              i.category === "Fehérje"
                ? "utensils"
                : i.category === "Gabonák"
                  ? "box"
                  : "leaf"
            }
            title={i.name}
            subtitle={`${i.category}${i.expiry ? ` · lejár: ${i.expiry.slice(5).replace("-", ". ")}.` : ""}`}
            value={
              <span className={i.stock < 150 ? "fuel-stock-low" : ""}>
                {i.stock} g
              </span>
            }
            onClick={() => api.go("fuel-item", { id: i.id })}
          />
        ))}
      </div>
      {!items.length && (
        <EmptyState
          title="Ilyet még nem tettél a polcra."
          action="Új alapanyag"
          onClick={() => api.go("fuel-item-edit")}
        />
      )}
      <Section title="Kapcsolódik a napodhoz">
        <FlowRow
          icon="chef"
          title="Mit főzhetek belőle?"
          onClick={() => api.go("fuel-recipes", { filter: "available" })}
        />
        <FlowRow
          icon="box"
          title="Bevásárlólista"
          value={s.shopping.filter((i) => !i.bought).length}
          onClick={() => api.go("fuel-shopping")}
        />
      </Section>
    </>
  );
}
function PantryItem({ api }) {
  const s = api.state.fuel,
    i = s.pantry.find((i) => i.id === api.params.id);
  if (!i) return <Unavailable api={api} />;
  const recipes = s.recipes.filter((r) =>
    r.ingredients.some((row) => row.id === i.id),
  );
  return (
    <>
      <FlowHead eyebrow={i.category} title={i.name} />
      <div className="fuel-stock-hero">
        <Icon name="box" size={38} />
        <strong>
          {i.stock}
          <small> g</small>
        </strong>
        <span>Jelenleg a kamrában</span>
      </div>
      <div className="flow-actions">
        <Action onClick={() => api.go("fuel-item-edit", { id: i.id })}>
          Készlet és adatok szerkesztése
          <Icon name="edit" />
        </Action>
        <Action
          secondary
          onClick={() => {
            api.update("fuel", (current) => ({
              ...current,
              draft: {
                name: i.name,
                time: "19:00",
                slot: "Kisétkezés",
                source: i.source,
                ingredients: [{ id: i.id, amount: 100 }],
              },
            }));
            api.go("fuel-review");
          }}
        >
          Étkezéshez adom
          <Icon name="plus" />
        </Action>
      </div>
      <Section title="Tápanyagok · 100 g">
        <Macros values={i} />
        <p className="fuel-honesty">{i.source}</p>
      </Section>
      <div className="flow-list">
        <FlowRow
          icon="calendar"
          title="Lejárat"
          value={i.expiry || "Nincs megadva"}
        />
        <FlowRow
          icon="book"
          title="Saját megjegyzés"
          subtitle={i.notes || "Még nincs megjegyzés."}
        />
      </div>
      <Section title="Ezekhez használod">
        {recipes.length ? (
          recipes.map((r) => (
            <FlowRow
              key={r.id}
              icon="chef"
              title={r.name}
              onClick={() => api.go("fuel-recipe", { id: r.id })}
            />
          ))
        ) : (
          <p className="flow-copy">Még nincs recepthez kapcsolva.</p>
        )}
      </Section>
    </>
  );
}
function PantryEdit({ api }) {
  const s = api.state.fuel,
    existing = s.pantry.find((i) => i.id === api.params.id);
  const [form, setForm] = useState(
      existing || {
        id: uid(),
        name: "",
        category: "Zöldség",
        stock: 100,
        unit: "g",
        kcal: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        expiry: "",
        notes: "",
        source: "Saját kézi adat · 100 g",
        aliases: [],
      },
    ),
    [error, setError] = useState("");
  const put = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  function save(e) {
    e.preventDefault();
    try {
      savePantryItem(s, form);
      api.update("fuel", (current) => {
        const next = savePantryItem(current, form);
        if (api.params.return === "review" && next.draft)
          return {
            ...next,
            draft: {
              ...next.draft,
              ingredients: [
                ...next.draft.ingredients,
                { id: form.id, amount: 100 },
              ],
            },
          };
        return next;
      });
      api.go(
        api.params.return === "review" ? "fuel-review" : "fuel-item",
        api.params.return === "review" ? {} : { id: form.id },
      );
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <>
      <FlowHead
        eyebrow={existing ? "A KAMRÁDBAN" : "ÚJ ALAPANYAG"}
        title={existing ? "Tartsuk naprakészen." : "Kerüljön a polcra."}
        description="A tápanyagokat 100 grammra add meg. A címkén szereplő adatokkal pontosíthatod."
      />
      <form className="flow-form" onSubmit={save}>
        <Field label="Alapanyag neve">
          <input
            required
            maxLength={80}
            value={form.name}
            onChange={(e) => put("name", e.target.value)}
          />
        </Field>
        <Field label="Kategória">
          <select
            value={form.category}
            onChange={(e) => put("category", e.target.value)}
          >
            {[
              "Fehérje",
              "Gabonák",
              "Zöldség",
              "Gyümölcs",
              "Tejtermék",
              "Magvak",
              "Egyéb",
            ].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </Field>
        <div className="flow-grid">
          <Field label="Készlet · g">
            <input
              required
              type="number"
              min="0"
              value={form.stock}
              onChange={(e) => put("stock", e.target.value)}
            />
          </Field>
          <Field label="Lejárat">
            <input
              type="date"
              value={form.expiry}
              onChange={(e) => put("expiry", e.target.value)}
            />
          </Field>
        </div>
        <h2>Tápanyagok 100 g-ban</h2>
        <div className="flow-grid">
          {[
            ["kcal", "Energia · kcal"],
            ["protein", "Fehérje · g"],
            ["carbs", "Szénhidrát · g"],
            ["fat", "Zsír · g"],
          ].map(([k, l]) => (
            <Field key={k} label={l}>
              <input
                type="number"
                required
                min="0"
                step="0.1"
                value={form[k]}
                onChange={(e) => put(k, e.target.value)}
              />
            </Field>
          ))}
        </div>
        <Field label="Saját megjegyzés">
          <textarea
            value={form.notes}
            rows={2}
            onChange={(e) => put("notes", e.target.value)}
          />
        </Field>
        {error && (
          <p className="fuel-error" role="alert">
            {error}
          </p>
        )}
        <Action type="submit">
          <Icon name="check" />
          Mentés a kamrába
        </Action>
      </form>
    </>
  );
}
function Stock({ api }) {
  const s = api.state.fuel,
    [values, setValues] = useState(
      Object.fromEntries(s.pantry.map((i) => [i.id, i.stock])),
    ),
    [saved, setSaved] = useState(false);
  const valid = Object.values(values).every((v) => v !== "" && Number(v) >= 0);
  return (
    <>
      <FlowHead
        eyebrow="EGY PERC A KONYHÁBAN"
        title="Mi van még otthon?"
        description="Nézz rá a polcra, és írd be a megmaradt mennyiséget. A receptjeid elérhetősége is frissül."
      />
      <div className="fuel-ingredients">
        {s.pantry.map((i) => (
          <div key={i.id} className="fuel-ingredient">
            <div>
              <strong>{i.name}</strong>
              <small>Legutóbb: {i.stock} g</small>
            </div>
            <label>
              <input
                aria-label={`${i.name} készlete`}
                type="number"
                min="0"
                value={values[i.id]}
                onChange={(e) => {
                  setSaved(false);
                  setValues((v) => ({ ...v, [i.id]: e.target.value }));
                }}
              />
              <span>g</span>
            </label>
          </div>
        ))}
      </div>
      <Action
        disabled={!valid}
        onClick={() => {
          api.update("fuel", (current) => ({
            ...current,
            pantry: current.pantry.map((i) => ({
              ...i,
              stock: Number(values[i.id] ?? i.stock),
            })),
          }));
          setSaved(true);
        }}
      >
        Készlet frissítése
        <Icon name="check" />
      </Action>
      {saved && (
        <div className="fuel-message" role="status">
          A kamrád frissült.
          <button
            className="text-button"
            onClick={() => api.go("fuel-recipes", { filter: "available" })}
          >
            Mit főzhetek most?
            <Icon name="arrow-right" size={16} />
          </button>
        </div>
      )}
    </>
  );
}
function Recipes({ api }) {
  const s = api.state.fuel,
    [filter, setFilter] = useState(api.params.filter || "all"),
    [query, setQuery] = useState("");
  const list = s.recipes.filter(
    (r) =>
      (filter === "all" ||
        (filter === "quick" && r.minutes <= 15) ||
        (filter === "saved" && r.saved) ||
        (filter === "available" &&
          recipeNeeds(s, r).every((i) => !i.missing))) &&
      r.name.toLocaleLowerCase("hu").includes(query.toLocaleLowerCase("hu")),
  );
  return (
    <>
      <FlowHead
        eyebrow="A SAJÁT RECEPTTÁRAD"
        title={
          api.variant === "companion"
            ? "Valami, ami jól esne."
            : "Jó ötlet a következőre."
        }
        description="Ismerős alapanyagok, a te adagodra alakítva."
      />
      <Field label="Recept keresése">
        <input
          placeholder="Mire ennél szívesen?"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </Field>
      <FlowTabs
        items={[
          ["all", "Mind"],
          ["quick", "15 perc alatt"],
          ["available", "Van hozzá"],
          ["saved", "Kedvencek"],
        ]}
        value={filter}
        onChange={setFilter}
      />
      <div className="fuel-recipe-library">
        {list.map((r) => {
          const needs = recipeNeeds(s, r),
            ready = needs.filter((i) => !i.missing).length;
          return (
            <button
              className="fuel-recipe-card"
              key={r.id}
              onClick={() => api.go("fuel-recipe", { id: r.id })}
            >
              <div className={`fuel-recipe-picture ${r.kind}`}>
                <FoodArt kind={r.kind} />
                <span>{r.minutes} perc</span>
              </div>
              <div>
                <span className="flow-kicker">
                  {r.category} ·{" "}
                  {ready === needs.length
                    ? "MINDEN VAN HOZZÁ"
                    : `${ready}/${needs.length} HOZZÁVALÓ MEGVAN`}
                </span>
                <h2>{r.name}</h2>
                <p>
                  {(draftTotals(s, { ingredients: r.ingredients }).kcal /
                    r.servings) |
                    0}{" "}
                  kcal / adag <Icon name="arrow-up-right" size={18} />
                </p>
              </div>
            </button>
          );
        })}
      </div>
      {!list.length && (
        <EmptyState
          title="Most nincs ilyen recept."
          description="Nézd meg a többi ötletet, vagy egészítsd ki a kamrádat."
          action="Minden recept"
          onClick={() => {
            setFilter("all");
            setQuery("");
          }}
        />
      )}
      <div className="flow-actions">
        <Action secondary onClick={() => api.go("fuel-recipe-edit")}>
          <Icon name="plus" />
          Saját recept hozzáadása
        </Action>
      </div>
    </>
  );
}
function Recipe({ api }) {
  const s = api.state.fuel,
    r = s.recipes.find((r) => r.id === api.params.id),
    [portions, setPortions] = useState(1);
  if (!r) return <Unavailable api={api} />;
  const needs = recipeNeeds(s, r, portions),
    missing = needs.filter((i) => i.missing);
  const totals = draftTotals(s, {
    ingredients: needs.map((i) => ({ id: i.id, amount: i.required })),
  });
  return (
    <>
      <div className="fuel-recipe-detail-art">
        <FoodArt kind={r.kind} />
        <button
          className={`fuel-save ${r.saved ? "active" : ""}`}
          aria-label={
            r.saved
              ? "Eltávolítás a kedvencekből"
              : "Recept mentése a kedvencekhez"
          }
          aria-pressed={r.saved}
          onClick={() =>
            api.update("fuel", (current) => ({
              ...current,
              recipes: current.recipes.map((item) =>
                item.id === r.id ? { ...item, saved: !item.saved } : item,
              ),
            }))
          }
        >
          <Icon name="heart" />
        </button>
      </div>
      <FlowHead
        eyebrow={`${r.category} · ${r.minutes} PERC`}
        title={r.name}
        description={r.description}
      />
      <Portion value={portions} onChange={setPortions} />
      <Macros values={totals} />
      <div className="flow-actions">
        <Action
          onClick={() =>
            api.go("fuel-cook", { id: r.id, portions: String(portions) })
          }
        >
          <Icon name="play" />
          Elkészítem
        </Action>
        <Action secondary onClick={() => startRecipe(api, r, portions)}>
          Ezt ettem · adag ellenőrzése
        </Action>
      </div>
      <Section
        title="Hozzávalók"
        action={
          <button
            className="text-button"
            onClick={() => api.go("fuel-recipe-edit", { id: r.id })}
          >
            Szerkesztés
          </button>
        }
      >
        <div className="flow-list">
          {needs.map((i) => (
            <FlowRow
              key={i.id}
              icon={i.missing ? "box" : "check"}
              title={i.name}
              subtitle={
                i.missing
                  ? `${i.missing} g hiányzik · otthon ${i.stock} g`
                  : `Megvan · otthon ${i.stock} g`
              }
              value={`${i.required} g`}
              onClick={() => api.go("fuel-item", { id: i.id })}
            />
          ))}
        </div>
        {missing.length > 0 ? (
          <Action
            secondary
            onClick={() => {
              api.update("fuel", (current) =>
                addRecipeShopping(current, r.id, portions),
              );
              api.go("fuel-shopping");
            }}
          >
            {missing.length} hiányzó tétel a listára
            <Icon name="plus" />
          </Action>
        ) : (
          <p className="fuel-message">
            <Icon name="check-circle" size={18} />
            Minden megvan hozzá a kamrádban.
          </p>
        )}
      </Section>
      <CompanionNote
        action="Beszéljük át"
        onClick={() =>
          api.ask(
            `A ${r.name} receptet nézem ${portions} adaggal. Hogyan illik a napomba?`,
          )
        }
      >
        Ez a recept {totals.protein} g fehérjét tartalmaz a kiválasztott
        mennyiségben. A saját éhségedhez és napodhoz igazíthatod.
      </CompanionNote>
      <Section title="Így készül">
        <ol className="fuel-step-preview">
          {r.steps.map((step, index) => (
            <li key={index}>
              <span>{index + 1}</span>
              <div>
                <strong>{step.title}</strong>
                <p>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>
      <p className="fuel-honesty">
        Saját prototípusrecept · szerkeszthető minta tápanyagértékek. A főzés
        végén külön döntesz a készlet levonásáról.
      </p>
    </>
  );
}
function RecipeEdit({ api }) {
  const s = api.state.fuel,
    existing = s.recipes.find((r) => r.id === api.params.id),
    [r, setR] = useState(
      existing || {
        id: uid(),
        name: "",
        description: "Saját recept a kamrámból.",
        kind: "bowl",
        category: "Ebéd",
        minutes: 20,
        servings: 1,
        saved: false,
        ingredients: [],
        steps: [{ title: "Elkészítés", body: "", minutes: 20 }],
      },
    ),
    [error, setError] = useState("");
  const put = (k, v) => setR((c) => ({ ...c, [k]: v }));
  function save(e) {
    e.preventDefault();
    try {
      saveRecipe(s, r);
      api.update("fuel", (current) => saveRecipe(current, r));
      api.go("fuel-recipe", { id: r.id });
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <>
      <FlowHead
        eyebrow="SAJÁT RECEPT"
        title={existing ? "Alakítsd magadra." : "Egy új kedvenc kezdete."}
        description="A hozzávalók a kamrádból jönnek. Az itt megadott mennyiség az egész receptre vonatkozik."
      />
      <form className="flow-form" onSubmit={save}>
        <Field label="Recept neve">
          <input
            required
            value={r.name}
            onChange={(e) => put("name", e.target.value)}
          />
        </Field>
        <div className="flow-grid">
          <Field label="Összes adag">
            <input
              required
              type="number"
              min="0.5"
              step="0.5"
              value={r.servings}
              onChange={(e) => put("servings", Number(e.target.value))}
            />
          </Field>
          <Field label="Elkészítés · perc">
            <input
              required
              type="number"
              min="1"
              max="240"
              value={r.minutes}
              onChange={(e) => put("minutes", Number(e.target.value))}
            />
          </Field>
        </div>
        <Field label="Étkezés">
          <select
            value={r.category}
            onChange={(e) => put("category", e.target.value)}
          >
            {["Reggeli", "Ebéd", "Vacsora", "Kisétkezés"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Rövid leírás">
          <textarea
            value={r.description}
            rows={2}
            onChange={(e) => put("description", e.target.value)}
          />
        </Field>
        <h2>Hozzávalók · teljes recept</h2>
        <div className="fuel-ingredients">
          {r.ingredients.map((i) => (
            <div className="fuel-ingredient" key={i.id}>
              <strong>{s.pantry.find((p) => p.id === i.id)?.name}</strong>
              <label>
                <input
                  aria-label={`${s.pantry.find((p) => p.id === i.id)?.name} mennyisége`}
                  type="number"
                  required
                  min="1"
                  value={i.amount}
                  onChange={(e) =>
                    put(
                      "ingredients",
                      r.ingredients.map((row) =>
                        row.id === i.id
                          ? { ...row, amount: Number(e.target.value) }
                          : row,
                      ),
                    )
                  }
                />
                <span>g</span>
              </label>
              <button
                type="button"
                className="fuel-icon-button"
                aria-label="Hozzávaló eltávolítása"
                onClick={() =>
                  put(
                    "ingredients",
                    r.ingredients.filter((row) => row.id !== i.id),
                  )
                }
              >
                <Icon name="x" size={17} />
              </button>
            </div>
          ))}
        </div>
        <Field label="Hozzávaló hozzáadása">
          <select
            value=""
            onChange={(e) =>
              e.target.value &&
              put("ingredients", [
                ...r.ingredients,
                { id: e.target.value, amount: 100 },
              ])
            }
          >
            <option value="">Válassz a kamrából</option>
            {s.pantry
              .filter((p) => !r.ingredients.some((i) => i.id === p.id))
              .map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
          </select>
        </Field>
        <h2>Elkészítési lépések</h2>
        {r.steps.map((step, index) => (
          <Field key={index} label={`${index + 1}. ${step.title}`}>
            <textarea
              required
              rows={3}
              value={step.body}
              onChange={(e) =>
                put(
                  "steps",
                  r.steps.map((row, j) =>
                    j === index ? { ...row, body: e.target.value } : row,
                  ),
                )
              }
            />
          </Field>
        ))}
        <button
          type="button"
          className="text-button"
          onClick={() =>
            put("steps", [
              ...r.steps,
              { title: `Következő lépés`, body: "", minutes: 5 },
            ])
          }
        >
          <Icon name="plus" size={16} />
          Új lépés
        </button>
        {error && (
          <p role="alert" className="fuel-error">
            {error}
          </p>
        )}
        <Action type="submit">
          Recept mentése
          <Icon name="check" />
        </Action>
      </form>
    </>
  );
}
function Cook({ api }) {
  const s = api.state.fuel,
    r = s.recipes.find((r) => r.id === api.params.id),
    portions = Math.max(0.5, Math.min(12, Number(api.params.portions) || 1));
  const [step, setStep] = useState(0),
    [deduct, setDeduct] = useState(true),
    [finished, setFinished] = useState(false),
    [error, setError] = useState("");
  if (!r) return <Unavailable api={api} />;
  const current = r.steps[step],
    missing = recipeNeeds(s, r, portions).filter((i) => i.missing);
  if (finished)
    return (
      <>
        <div className="fuel-cook-finished">
          <FoodArt kind={r.kind} />
          <span className="flow-kicker">ELKÉSZÜLT · {portions} ADAG</span>
          <h1>Jó étvágyat.</h1>
          <p>
            {deduct
              ? "A felhasznált mennyiségeket levontuk a kamrából."
              : "A kamra készletét most nem módosítottuk."}
          </p>
        </div>
        <Action onClick={() => startRecipe(api, r, portions)}>
          Ezt ettem · naplózás
          <Icon name="plus" />
        </Action>
        <div className="flow-actions">
          <Action secondary onClick={() => api.go("fuel")}>
            Vissza a napomhoz
          </Action>
        </div>
      </>
    );
  return (
    <>
      <FlowHead
        eyebrow={`${r.name} · ${portions} ADAG`}
        title="Egy lépés egyszerre."
      />
      <div className="fuel-cook-progress">
        {r.steps.map((_, i) => (
          <span key={i} className={i <= step ? "active" : ""} />
        ))}
      </div>
      <div className="fuel-cook-step">
        <span className="fuel-step-number">
          {String(step + 1).padStart(2, "0")}
        </span>
        <span className="flow-kicker">
          {step + 1} / {r.steps.length} LÉPÉS · KB. {current.minutes} PERC
        </span>
        <h2>{current.title}</h2>
        <p>{current.body}</p>
      </div>
      <div className="fuel-cook-ingredients">
        <span className="flow-kicker">KIKÉSZÍTVE</span>
        {recipeNeeds(s, r, portions).map((i) => (
          <span key={i.id}>
            {i.name}
            <strong>{i.required} g</strong>
          </span>
        ))}
      </div>
      {step === r.steps.length - 1 && (
        <>
          <label className="fuel-checkbox">
            <input
              type="checkbox"
              checked={deduct}
              onChange={(e) => setDeduct(e.target.checked)}
            />
            <span>Felhasznált mennyiségek levonása a kamrából</span>
          </label>
          {deduct && missing.length > 0 && (
            <div className="fuel-message">
              A készlet szerint {missing.length} hozzávaló hiányos. Frissítsd a
              kamrát, vagy kapcsold ki a levonást.
              <button
                className="text-button"
                onClick={() => api.go("fuel-stock")}
              >
                Készlet ellenőrzése
                <Icon name="arrow-right" size={16} />
              </button>
            </div>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="fuel-error">
          {error}
        </p>
      )}
      <div className="flow-actions">
        <Action
          disabled={step === r.steps.length - 1 && deduct && missing.length > 0}
          onClick={() => {
            if (step < r.steps.length - 1) setStep(step + 1);
            else
              try {
                if (deduct) {
                  consumeRecipe(s, r.id, portions);
                  api.update("fuel", (current) =>
                    consumeRecipe(current, r.id, portions),
                  );
                } else
                  api.update("fuel", (current) => ({
                    ...current,
                    cooked: [
                      ...current.cooked,
                      { recipeId: r.id, portions, time: "Most" },
                    ],
                  }));
                setFinished(true);
                api.celebrate();
              } catch (e) {
                setError(e.message);
              }
          }}
        >
          {step === r.steps.length - 1 ? "Elkészült" : "Következő lépés"}
          <Icon name={step === r.steps.length - 1 ? "check" : "arrow-right"} />
        </Action>
        {step > 0 && (
          <Action secondary onClick={() => setStep(step - 1)}>
            Előző lépés
          </Action>
        )}
      </div>
    </>
  );
}
function Shopping({ api }) {
  const s = api.state.fuel,
    [pick, setPick] = useState("");
  const pending = s.shopping.filter((i) => !i.bought),
    done = s.shopping.filter((i) => i.bought);
  return (
    <>
      <FlowHead
        eyebrow="A KAMRÁD KIEGÉSZÍTÉSE"
        title="Ami még kell hozzá."
        description="Ha megvetted, jelöld késznek. A megadott mennyiség rögtön a kamrádba kerül."
      />
      {!s.shopping.length && (
        <EmptyState
          icon="box"
          title="Most üres a listád."
          description="A recepteknél egy érintéssel hozzáadhatod a hiányzó alapanyagokat."
          action="Recepteket nézek"
          onClick={() => api.go("fuel-recipes")}
        />
      )}
      <div className="fuel-shopping-list">
        {pending.map((i) => (
          <div className="fuel-shopping-row" key={i.id}>
            <button
              className="fuel-shopping-check"
              aria-label={`${i.name} megvásárolva`}
              onClick={() =>
                api.update("fuel", (current) => purchaseShopping(current, i.id))
              }
            >
              <Icon name="check" size={18} />
            </button>
            <div>
              <strong>{i.name}</strong>
              <span>
                {i.amount} {i.unit}
              </span>
            </div>
            <button
              className="fuel-icon-button"
              aria-label={`${i.name} eltávolítása a listáról`}
              onClick={() =>
                api.update("fuel", (current) => ({
                  ...current,
                  shopping: current.shopping.filter((row) => row.id !== i.id),
                }))
              }
            >
              <Icon name="x" size={17} />
            </button>
          </div>
        ))}
      </div>
      <Field label="Kézi hozzáadás · 100 g">
        <select
          value={pick}
          onChange={(e) => {
            const id = e.target.value;
            setPick("");
            if (id)
              api.update("fuel", (current) => {
                const item = current.pantry.find((i) => i.id === id),
                  old = current.shopping.find((i) => i.id === id);
                return {
                  ...current,
                  shopping: [
                    ...current.shopping.filter((i) => i.id !== id),
                    {
                      id,
                      name: item.name,
                      amount: old && !old.bought ? old.amount + 100 : 100,
                      unit: "g",
                      bought: false,
                    },
                  ],
                };
              });
          }}
        >
          <option value="">Válassz alapanyagot</option>
          {s.pantry.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </Field>
      {done.length > 0 && (
        <Section title="Már a kamrában">
          <div className="flow-list">
            {done.map((i) => (
              <FlowRow
                key={i.id}
                icon="check-circle"
                title={i.name}
                value={`+${i.amount} g`}
              />
            ))}
          </div>
          <button
            className="text-button"
            onClick={() =>
              api.update("fuel", (current) => ({
                ...current,
                shopping: current.shopping.filter((i) => !i.bought),
              }))
            }
          >
            Kész tételek elrejtése
          </button>
        </Section>
      )}
      <Section title="Minden összekapcsolódik">
        <FlowRow
          icon="box"
          title="Megnézem a kamrámat"
          onClick={() => api.go("fuel-pantry")}
        />
        <FlowRow
          icon="chef"
          title="Mit főzhetek most?"
          onClick={() => api.go("fuel-recipes", { filter: "available" })}
        />
      </Section>
    </>
  );
}
function Plan({ api }) {
  const s = api.state.fuel,
    [rows, setRows] = useState(s.plan),
    [saved, setSaved] = useState(false);
  return (
    <>
      <FlowHead
        eyebrow="MAI RITMUS · MINTANAP"
        title="Hagyj helyet az étkezésnek."
        description="Egy könnyen alakítható kiindulópont. Válassz időpontot és receptet, a napodhoz igazítva."
      />
      <div className="fuel-plan">
        {rows.map((row, index) => (
          <section key={row.id}>
            <span className="flow-kicker">
              0{index + 1} · {row.name}
            </span>
            <div className="flow-grid">
              <Field label="Időpont">
                <input
                  type="time"
                  value={row.time}
                  onChange={(e) => {
                    setSaved(false);
                    setRows((v) =>
                      v.map((r) =>
                        r.id === row.id ? { ...r, time: e.target.value } : r,
                      ),
                    );
                  }}
                />
              </Field>
              <Field label="Recept">
                <select
                  value={row.recipeId}
                  onChange={(e) => {
                    setSaved(false);
                    setRows((v) =>
                      v.map((r) =>
                        r.id === row.id
                          ? { ...r, recipeId: e.target.value }
                          : r,
                      ),
                    );
                  }}
                >
                  {s.recipes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <button
              className="text-button"
              onClick={() => api.go("fuel-recipe", { id: row.recipeId })}
            >
              Recept és hozzávalók
              <Icon name="arrow-right" size={16} />
            </button>
          </section>
        ))}
      </div>
      <Action
        disabled={rows.some((r) => !r.time)}
        onClick={() => {
          api.update("fuel", (current) => ({ ...current, plan: rows }));
          setSaved(true);
        }}
      >
        Ritmus mentése
        <Icon name="check" />
      </Action>
      {saved && (
        <p role="status" className="fuel-message">
          A mai étkezési ritmusod frissült.
        </p>
      )}
      <CompanionNote
        action="Beszéljük át a napomat"
        onClick={() =>
          api.ask("Nézzük át a mai étkezési ritmusomat az edzésemmel együtt.")
        }
      >
        Ez a terved, nem kötelező menetrend. A naplóba akkor kerül étkezés,
        amikor rögzíted.
      </CompanionNote>
    </>
  );
}
function Settings({ api }) {
  const [values, setValues] = useState(api.state.fuel.targets),
    [saved, setSaved] = useState(false);
  return (
    <>
      <FlowHead
        eyebrow="A TE KIINDULÓPONTOD"
        title="Keret, ami hozzád igazodik."
        description="Ezek szerkeszthető prototípuscélok. A napi Fuel nézet ezekhez viszonyítja a naplódat."
      />
      <form
        className="flow-form"
        onSubmit={(e) => {
          e.preventDefault();
          api.update("fuel", (current) => ({
            ...current,
            targets: Object.fromEntries(
              Object.entries(values).map(([k, v]) => [k, Number(v)]),
            ),
          }));
          setSaved(true);
        }}
      >
        {[
          ["kcal", "Napi energia · kcal"],
          ["protein", "Fehérje · g"],
          ["carbs", "Szénhidrát · g"],
          ["fat", "Zsír · g"],
          ["water", "Víz · ml"],
        ].map(([k, l]) => (
          <Field key={k} label={l}>
            <input
              type="number"
              required
              min="1"
              max={k === "water" ? 10000 : k === "kcal" ? 10000 : 1000}
              value={values[k]}
              onChange={(e) => {
                setSaved(false);
                setValues((v) => ({ ...v, [k]: e.target.value }));
              }}
            />
          </Field>
        ))}
        <Action type="submit">
          Célok mentése
          <Icon name="check" />
        </Action>
        {saved && (
          <p role="status" className="fuel-message">
            A Fuel összesítője mostantól az új céljaidat mutatja.
          </p>
        )}
      </form>
      <FlowRow
        icon="clock"
        title="Étkezési ritmus"
        onClick={() => api.go("fuel-plan")}
      />
    </>
  );
}
export default function FuelFlow({ page, api }) {
  const views = {
    fuel: Hub,
    "fuel-log": Log,
    "fuel-review": Review,
    "fuel-meal": Meal,
    "fuel-evaluation": Meal,
    "fuel-pantry": Pantry,
    "fuel-item": PantryItem,
    "fuel-item-edit": PantryEdit,
    "fuel-stock": Stock,
    "fuel-recipes": Recipes,
    "fuel-recipe": Recipe,
    "fuel-recipe-edit": RecipeEdit,
    "fuel-cook": Cook,
    "fuel-shopping": Shopping,
    "fuel-plan": Plan,
    "fuel-settings": Settings,
  };
  const View = views[page] || Hub;
  return (
    <div className="flow-page fuel-flow">
      <View
        key={`${page}-${api.params.id || ""}`}
        api={api}
        evaluation={page === "fuel-evaluation"}
      />
    </div>
  );
}
