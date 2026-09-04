import type {
  Ingredient,
  Recipe,
  RecipeLog,
  PantryCategoryMeta,
  PantryImport,
  PantrySuggestion,
  PantryScrapeDraft,
  PantryCatalogEntry,
  MealAiDraft,
  MealBreakdown,
  FuelMeal,
} from '@/data/types'
import { fuelDay } from '@/data/fuel/fuel'
import { enrichLine, computeRecipeMacros, computeRecipeNutrients } from '@/data/fuel/recipeMacros'

// pantrySources already ported in Task 4 — re-export, do not redefine.
export { pantrySources } from '@/data/pantrySources'

// === Category meta (pantry-data.js:285–295) ===
export const pantryCategoryMeta: Record<string, PantryCategoryMeta> = {
  protein: { label: 'Fehérje', color: 'var(--sage)' },
  carb: { label: 'Szénhidrát', color: '#F59E0B' },
  fat: { label: 'Zsír', color: '#A78BFA' },
  veggie: { label: 'Zöldség', color: '#34D399' },
  fruit: { label: 'Gyümölcs', color: '#F472B6' },
  dairy: { label: 'Tejtermék', color: '#60A5FA' },
  supplement: { label: 'Supplement', color: 'var(--sage)' },
  'supplement-protein': { label: 'Whey/Protein', color: 'var(--sage)' },
  'supplement-stim': { label: 'Stimuláns', color: '#F472B6' },
  // === Catalog category enum (imported catalog, mezo-zza) ===
  vegetables: { label: 'Zöldség', color: '#34D399' },
  fruits: { label: 'Gyümölcs', color: '#F472B6' },
  meat: { label: 'Hús', color: '#F87171' },
  fish: { label: 'Hal', color: '#38BDF8' },
  eggs: { label: 'Tojás', color: '#FBBF24' },
  cheese: { label: 'Sajt', color: '#FCD34D' },
  legumes: { label: 'Hüvelyes', color: '#A3E635' },
  grains: { label: 'Gabona', color: '#F59E0B' },
  pasta: { label: 'Tészta', color: '#FB923C' },
  bakery: { label: 'Pékáru', color: '#D9A066' },
  nuts_seeds: { label: 'Mag / Olajos', color: '#C084FC' },
  oils_fats: { label: 'Olaj / Zsír', color: '#A78BFA' },
  condiments: { label: 'Fűszer / Szósz', color: '#FB7185' },
  snacks: { label: 'Snack', color: '#F472B6' },
  beverages: { label: 'Ital', color: '#60A5FA' },
  other: { label: 'Egyéb', color: '#9CA3AF' },
}

// === Ingredients · scraped from grocery / supplement sites (pantry-data.js:20–157) ===
// A `kind` a szerver mezője (mezo-4orh) — a fixture-ben explicit, nem a category-ból számolt.
// A whey/kreatin/AAKG sorok szándékosan supplement/stim kinddal állnak: a mock „ingredients”
// tömbje a fixture TELJES kamrája, nem a valós szerver food-only projekciója, és a
// buildKamraItems kártya-kindjai így maradnak változatlanok.
export const ingredients: Ingredient[] = [
  // -- Proteins --
  {
    id: 'ing-csirkemell', kind: 'food', name: 'Csirkemell · friss', brand: 'Bonafarm', source: 'kifli.hu', category: 'protein', per: 100, unit: 'g',
    macros: { kcal: 110, p: 23.0, c: 0, f: 1.5 },
    fiberG: 0, sugarG: 0, saltG: 0.1, saturatedFatG: 0.4,
    price: 3290, priceUnit: 'Ft/kg', pkg: '500g tálca',
    micros: [{ name: 'B6', pct: 92 }, { name: 'Niacin', pct: 88 }, { name: 'Se', pct: 76 }],
    nova: 1, stock: { qty: 400, unit: 'g', expires: 'Máj 25' },
    lastUsed: 'tegnap', usedInRecipes: 7, scrapedAt: 'Máj 20 · 09:14',
  },
  {
    id: 'ing-turo', kind: 'food', name: 'Túró · félzsíros', brand: 'Mizo', source: 'kifli.hu', category: 'dairy', per: 100, unit: 'g',
    macros: { kcal: 130, p: 18.0, c: 3.5, f: 5.0 },
    fiberG: 0, sugarG: 3.5, saltG: 0.1, saturatedFatG: 3.2,
    price: 2190, priceUnit: 'Ft/kg', pkg: '250g pohár',
    micros: [{ name: 'Ca', pct: 92 }, { name: 'B12', pct: 88 }, { name: 'Casein', pct: 95 }],
    nova: 3, stock: { qty: 250, unit: 'g', expires: 'Máj 26' },
    lastUsed: 'ma reggel', usedInRecipes: 5, scrapedAt: 'Máj 21 · 14:02',
  },
  {
    id: 'ing-lazac', kind: 'food', name: 'Lazacfilé · norvég', brand: 'Kifli Premium', source: 'kifli.hu', category: 'protein', per: 100, unit: 'g',
    macros: { kcal: 208, p: 20.4, c: 0, f: 13.4 },
    fiberG: 0, sugarG: 0, saltG: 0.12, saturatedFatG: 2.7,
    price: 14990, priceUnit: 'Ft/kg', pkg: '300g vákuum',
    micros: [{ name: 'Omega-3', pct: 95 }, { name: 'D3', pct: 72 }, { name: 'B12', pct: 88 }],
    nova: 1, stock: { qty: 300, unit: 'g', expires: 'Máj 24', lowExpiry: true },
    lastUsed: '3 napja', usedInRecipes: 4, scrapedAt: 'Máj 21 · 14:02',
  },
  {
    id: 'ing-tojas', kind: 'food', name: 'Tojás · M-es szabadon tartott', brand: 'Erdőker', source: 'kifli.hu', category: 'protein', per: 100, unit: 'g',
    macros: { kcal: 155, p: 13.0, c: 1.1, f: 11.0 },
    price: 1890, priceUnit: 'Ft/10db', pkg: '10db doboz',
    micros: [{ name: 'B12', pct: 92 }, { name: 'Kolin', pct: 88 }, { name: 'Se', pct: 64 }],
    nova: 1, stock: { qty: 8, unit: 'db', expires: 'Jún 04' },
    lastUsed: '2 napja', usedInRecipes: 9, scrapedAt: 'Máj 18 · 11:30',
  },

  // -- Carbs --
  {
    id: 'ing-zab', kind: 'food', name: 'Zabpehely · gluténmentes', brand: 'Naturmind', source: 'kifli.hu', category: 'carb', per: 100, unit: 'g',
    macros: { kcal: 372, p: 13.5, c: 60.0, f: 7.0 },
    fiberG: 10.6, sugarG: 1.0, saltG: 0.02, saturatedFatG: 1.2,
    price: 1490, priceUnit: 'Ft/500g', pkg: '500g',
    micros: [{ name: 'Béta-glükán', pct: 95 }, { name: 'Fiber', pct: 92 }, { name: 'Mg', pct: 38 }],
    nova: 1, stock: { qty: 320, unit: 'g', expires: '2026.09' },
    lastUsed: 'ma reggel', usedInRecipes: 6, scrapedAt: 'Máj 15 · 08:42',
  },
  {
    id: 'ing-edesburg', kind: 'food', name: 'Édesburgonya', brand: 'Bio piac', source: 'kifli.hu', category: 'carb', per: 100, unit: 'g',
    macros: { kcal: 86, p: 1.6, c: 20.1, f: 0.1 },
    fiberG: 3.0, sugarG: 4.2, saltG: 0.03, saturatedFatG: 0.02,
    price: 1490, priceUnit: 'Ft/kg', pkg: '1kg',
    micros: [{ name: 'Vit A', pct: 100 }, { name: 'K', pct: 76 }, { name: 'Béta-karotin', pct: 95 }],
    nova: 1, stock: { qty: 600, unit: 'g', expires: 'Jún 05' },
    lastUsed: 'tegnap', usedInRecipes: 3, scrapedAt: 'Máj 20 · 09:14',
  },
  {
    id: 'ing-rizs', kind: 'food', name: 'Barna rizs · hosszú szemű', brand: 'Lassi Bio', source: 'tesco.hu', category: 'carb', per: 100, unit: 'g',
    macros: { kcal: 360, p: 7.4, c: 76.0, f: 2.8 },
    fiberG: 3.5, sugarG: 0.7, saltG: 0.01, saturatedFatG: 0.6,
    price: 990, priceUnit: 'Ft/500g', pkg: '500g',
    micros: [{ name: 'Mg', pct: 62 }, { name: 'B3', pct: 58 }, { name: 'Fiber', pct: 44 }],
    nova: 1, stock: { qty: 480, unit: 'g', expires: '2026.11' },
    lastUsed: '5 napja', usedInRecipes: 5, scrapedAt: 'Máj 12 · 18:22',
  },
  {
    id: 'ing-banan', kind: 'food', name: 'Banán · érett', brand: 'Eco', source: 'kifli.hu', category: 'fruit', per: 100, unit: 'g',
    macros: { kcal: 89, p: 1.1, c: 22.8, f: 0.3 },
    price: 549, priceUnit: 'Ft/kg', pkg: '5db',
    micros: [{ name: 'K', pct: 88 }, { name: 'B6', pct: 56 }, { name: 'Mg', pct: 28 }],
    nova: 1, stock: { qty: 3, unit: 'db', expires: 'Máj 24' },
    lastUsed: 'ma délután', usedInRecipes: 8, scrapedAt: 'Máj 20 · 09:14',
  },

  // -- Veggies / fats --
  {
    id: 'ing-spenot', kind: 'food', name: 'Spenót · friss', brand: 'Bio Magyarország', source: 'kifli.hu', category: 'veggie', per: 100, unit: 'g',
    macros: { kcal: 23, p: 2.9, c: 3.6, f: 0.4 },
    price: 1990, priceUnit: 'Ft/250g', pkg: '250g zacskó',
    micros: [{ name: 'Fe', pct: 78 }, { name: 'Folát', pct: 92 }, { name: 'K1', pct: 100 }],
    nova: 1, stock: { qty: 150, unit: 'g', expires: 'Máj 24', lowExpiry: true },
    lastUsed: 'tegnap', usedInRecipes: 4, scrapedAt: 'Máj 20 · 09:14',
  },
  {
    id: 'ing-brokkoli', kind: 'food', name: 'Brokkoli', brand: 'Eco', source: 'kifli.hu', category: 'veggie', per: 100, unit: 'g',
    macros: { kcal: 34, p: 2.8, c: 6.6, f: 0.4 },
    fiberG: 2.6, sugarG: 1.7, saltG: 0.08, saturatedFatG: 0.05,
    price: 1290, priceUnit: 'Ft/db', pkg: '1db ~400g',
    micros: [{ name: 'Vit C', pct: 96 }, { name: 'Folát', pct: 68 }, { name: 'Sulforaphane', pct: 92 }],
    nova: 1, stock: null,
    lastUsed: '4 napja', usedInRecipes: 3, scrapedAt: 'Máj 16 · 12:10',
  },
  {
    id: 'ing-afonya', kind: 'food', name: 'Áfonya · fagyasztott', brand: 'Frozen', source: 'kifli.hu', category: 'fruit', per: 100, unit: 'g',
    macros: { kcal: 57, p: 0.7, c: 14.5, f: 0.3 },
    fiberG: 2.4, sugarG: 9.7, saltG: 0.003, saturatedFatG: 0.03,
    price: 2490, priceUnit: 'Ft/300g', pkg: '300g zacskó',
    micros: [{ name: 'Antocianin', pct: 100 }, { name: 'Vit C', pct: 48 }, { name: 'Fiber', pct: 38 }],
    nova: 1, stock: { qty: 220, unit: 'g', expires: '2027.02' },
    lastUsed: 'ma reggel', usedInRecipes: 4, scrapedAt: 'Máj 15 · 08:42',
  },
  {
    id: 'ing-mandulav', kind: 'food', name: 'Mandulavaj · 100%', brand: 'Nutsi', source: 'kifli.hu', category: 'fat', per: 100, unit: 'g',
    macros: { kcal: 614, p: 21.0, c: 18.8, f: 55.5 },
    price: 4990, priceUnit: 'Ft/250g', pkg: '250g üveg',
    micros: [{ name: 'Vit E', pct: 88 }, { name: 'Mg', pct: 62 }, { name: 'Fiber', pct: 42 }],
    nova: 2, stock: { qty: 180, unit: 'g', expires: '2026.12' },
    lastUsed: 'ma délután', usedInRecipes: 6, scrapedAt: 'Máj 12 · 18:22',
  },
  {
    id: 'ing-olivao', kind: 'food', name: 'Olívaolaj · extra szűz', brand: 'Casa Olearia', source: 'kifli.hu', category: 'fat', per: 100, unit: 'g',
    macros: { kcal: 884, p: 0, c: 0, f: 100 },
    fiberG: 0, sugarG: 0, saltG: 0, saturatedFatG: 14.0,
    price: 5490, priceUnit: 'Ft/500ml', pkg: '500ml',
    micros: [{ name: 'Polifenolok', pct: 88 }, { name: 'Vit E', pct: 72 }],
    nova: 2, stock: { qty: 380, unit: 'ml', expires: '2027.01' },
    lastUsed: 'tegnap', usedInRecipes: 11, scrapedAt: 'Ápr 28 · 16:00',
  },
  {
    id: 'ing-mez', kind: 'food', name: 'Akácméz · hazai', brand: 'Hungaria Méz', source: 'kifli.hu', category: 'carb', per: 100, unit: 'g',
    macros: { kcal: 304, p: 0.3, c: 82.4, f: 0 },
    fiberG: 0, sugarG: 82.1, saltG: 0.01, saturatedFatG: 0,
    price: 3490, priceUnit: 'Ft/500g', pkg: '500g üveg',
    micros: [{ name: 'Antioxidánsok', pct: 42 }],
    nova: 2, stock: { qty: 320, unit: 'g', expires: '2028.03' },
    lastUsed: 'ma reggel', usedInRecipes: 4, scrapedAt: 'Ápr 28 · 16:00',
  },
  {
    id: 'ing-mandula', kind: 'food', name: 'Mandula · pörkölt', brand: 'Naturmind', source: 'kifli.hu', category: 'fat', per: 100, unit: 'g',
    macros: { kcal: 579, p: 21.2, c: 21.6, f: 49.9 },
    fiberG: 12.5, sugarG: 4.4, saltG: 0.01, saturatedFatG: 4.0,
    price: 2890, priceUnit: 'Ft/200g', pkg: '200g',
    micros: [{ name: 'Vit E', pct: 100 }, { name: 'Mg', pct: 68 }, { name: 'Fiber', pct: 52 }],
    nova: 1, stock: { qty: 120, unit: 'g', expires: '2026.08' },
    lastUsed: 'ma reggel', usedInRecipes: 3, scrapedAt: 'Máj 12 · 18:22',
  },

  // -- Supplements (linked from supplementsStash) --
  {
    id: 'ing-whey', kind: 'supplement', name: 'Impact Whey · csoki', brand: 'MyProtein', source: 'myprotein.hu', category: 'supplement-protein', per: 100, unit: 'g',
    macros: { kcal: 374, p: 82, c: 4.0, f: 7.5 },
    price: 18990, priceUnit: 'Ft/2.5kg', pkg: '2.5kg',
    micros: [{ name: 'BCAA', pct: 95 }, { name: 'Leucin', pct: 92 }],
    nova: 4, stock: { qty: 1400, unit: 'g', expires: '2027.04' },
    lastUsed: 'ma délután', usedInRecipes: 4,
    stashRefId: 'whey', scrapedAt: 'Máj 02 · 21:15',
  },
  {
    id: 'ing-kreatin', kind: 'supplement', name: 'Kreatin Monohidrát', brand: 'MyProtein', source: 'myprotein.hu', category: 'supplement', per: 100, unit: 'g',
    macros: { kcal: 0, p: 0, c: 0, f: 0 },
    price: 5990, priceUnit: 'Ft/500g', pkg: '500g',
    micros: [{ name: 'Creatine', pct: 100 }],
    nova: 4, stock: { qty: 430, unit: 'g', expires: '2027.06' },
    lastUsed: 'ma reggel', usedInRecipes: 1,
    stashRefId: 'kreatin', scrapedAt: 'Máj 02 · 21:15',
  },
  {
    id: 'ing-aakg', kind: 'stim', name: 'AAKG · L-Arginine', brand: 'MyProtein', source: 'myprotein.hu', category: 'supplement-stim', per: 100, unit: 'g',
    macros: { kcal: 0, p: 0, c: 0, f: 0 },
    price: 8990, priceUnit: 'Ft/250g', pkg: '250g',
    micros: [{ name: 'L-Arginine AKG', pct: 100 }],
    nova: 4, stock: { qty: 108, unit: 'g', expires: '2026.11' },
    lastUsed: '5 napja', usedInRecipes: 0,
    scrapedAt: 'Máj 02 · 21:15', warning: 'stim',
  },
]

// === Saved recipes · composed of ingredient refs (pantry-data.js:160–267) ===
const recipesBase: Recipe[] = [
  {
    id: 'rec-1', name: 'Túrós zabkása · áfonyával',
    slot: 'Reggeli', category: 'breakfast',
    createdDate: 'Ápr 14', timesLogged: 12, avgScore: 0.92,
    lastLogged: 'ma 07:15',
    servings: 1, prepMins: 5, cookMins: 3,
    tags: ['pre-workout', 'high-protein', 'slow-release'],
    ingredients: [
      { refId: 'ing-zab', amount: 70, unit: 'g' },
      { refId: 'ing-turo', amount: 200, unit: 'g' },
      { refId: 'ing-afonya', amount: 80, unit: 'g' },
      { refId: 'ing-mez', amount: 12, unit: 'g' },
      { refId: 'ing-mandula', amount: 15, unit: 'g' },
    ],
    macros: { kcal: 580, p: 42, c: 78, f: 12 },
    novaDominant: 1,
    mezoFit: { score: null, fitsFor: ['Pre Pull Day · T-10h', 'Reggel · Gyógyszer D3'] },
    starred: true,
    // The one non-standard seed (mezo-uavr): carb-dominant breakfast, so mock mode exercises
    // the pre-workout rubric overlay and its chip.
    role: 'pre_workout',
  },
  {
    id: 'rec-2', name: 'Csirke + édesburgonya + spenót',
    slot: 'Ebéd · pre-workout', category: 'lunch',
    createdDate: 'Már 22', timesLogged: 18, avgScore: 0.88,
    lastLogged: 'ma 13:30',
    servings: 1, prepMins: 8, cookMins: 22,
    tags: ['pre-workout', 'whole-foods'],
    ingredients: [
      { refId: 'ing-csirkemell', amount: 200, unit: 'g' },
      { refId: 'ing-edesburg', amount: 250, unit: 'g' },
      { refId: 'ing-spenot', amount: 100, unit: 'g' },
      { refId: 'ing-olivao', amount: 8, unit: 'g' },
    ],
    macros: { kcal: 720, p: 58, c: 74, f: 18 },
    novaDominant: 1,
    mezoFit: { score: null, fitsFor: ['Pre-workout · T-3.5h', 'Magas mikro-density'] },
    starred: true,
    role: 'standard',
  },
  {
    id: 'rec-3', name: 'Lazac + barna rizs + brokkoli',
    slot: 'Vacsora', category: 'dinner',
    createdDate: 'Feb 08', timesLogged: 24, avgScore: 0.94,
    lastLogged: 'tegnap 21:00',
    servings: 1, prepMins: 5, cookMins: 18,
    tags: ['post-workout', 'omega-3'],
    ingredients: [
      { refId: 'ing-lazac', amount: 180, unit: 'g' },
      { refId: 'ing-rizs', amount: 80, unit: 'g', note: 'főtt: ~220g' },
      { refId: 'ing-brokkoli', amount: 200, unit: 'g' },
      { refId: 'ing-olivao', amount: 10, unit: 'g' },
    ],
    macros: { kcal: 760, p: 48, c: 72, f: 28 },
    novaDominant: 1,
    mezoFit: { score: null, fitsFor: ['Post-workout · este', 'Omega-3 hét'] },
    starred: true,
    role: 'standard',
  },
  {
    id: 'rec-4', name: 'Whey + banán + mandulavaj',
    slot: 'Snack · pre-workout', category: 'snack',
    createdDate: 'Ápr 30', timesLogged: 22, avgScore: 0.84,
    lastLogged: 'ma 16:00',
    servings: 1, prepMins: 2, cookMins: 0,
    tags: ['pre-workout', 'fast-digest'],
    ingredients: [
      { refId: 'ing-whey', amount: 40, unit: 'g' },
      { refId: 'ing-banan', amount: 1, unit: 'db' },
      { refId: 'ing-mandulav', amount: 15, unit: 'g' },
    ],
    macros: { kcal: 340, p: 42, c: 36, f: 4 },
    novaDominant: 4,
    mezoFit: { score: null, fitsFor: ['Pre-workout · T-1h', 'Ciklus-tudatos snack'] },
    starred: false,
    role: 'standard',
  },
  {
    id: 'rec-5', name: 'Tojásrántotta · spenóttal',
    slot: 'Reggeli', category: 'breakfast',
    createdDate: 'Ápr 02', timesLogged: 8, avgScore: 0.86,
    lastLogged: '4 napja',
    servings: 1, prepMins: 3, cookMins: 5,
    tags: ['high-protein', 'low-carb'],
    ingredients: [
      { refId: 'ing-tojas', amount: 3, unit: 'db' },
      { refId: 'ing-spenot', amount: 60, unit: 'g' },
      { refId: 'ing-olivao', amount: 6, unit: 'g' },
    ],
    macros: { kcal: 320, p: 24, c: 2, f: 24 },
    novaDominant: 1,
    mezoFit: { score: null, fitsFor: ['Alacsony-C reggel', 'Rest day'] },
    starred: false,
    role: 'standard',
  },
  {
    id: 'rec-6', name: 'Túró · áfonya · méz quick',
    slot: 'Snack', category: 'snack',
    createdDate: 'Ápr 18', timesLogged: 14, avgScore: 0.89,
    lastLogged: '2 napja',
    servings: 1, prepMins: 2, cookMins: 0,
    tags: ['high-protein', 'evening'],
    ingredients: [
      { refId: 'ing-turo', amount: 200, unit: 'g' },
      { refId: 'ing-afonya', amount: 60, unit: 'g' },
      { refId: 'ing-mez', amount: 10, unit: 'g' },
    ],
    macros: { kcal: 310, p: 37, c: 30, f: 10 },
    novaDominant: 3,
    mezoFit: { score: null, fitsFor: ['Casein · esti', 'Magas protein density'] },
    starred: false,
    role: 'standard',
  },
]

// === Recent import / scrape activity feed (pantry-data.js:270–275) ===
export const pantryImports: PantryImport[] = [
  { id: 'imp-1', source: 'kifli.hu', when: 'ma · 09:14', items: 4, status: 'synced', ofWhat: 'csirkemell, édesburgonya, spenót, banán' },
  { id: 'imp-2', source: 'myprotein.hu', when: 'Máj 02', items: 5, status: 'synced', ofWhat: 'Whey, Kreatin, AAKG, Beta-Alanin, Caffeine' },
  { id: 'imp-3', source: 'kifli.hu', when: 'Máj 12', items: 3, status: 'synced', ofWhat: 'rizs, mandulavaj, mandula' },
  { id: 'imp-4', source: 'tesco.hu', when: 'Ápr 28', items: 2, status: 'manual-review', ofWhat: 'olivaolaj, méz · ár-egyeztetés' },
]

// === Suggested imports — "ezt is megtaláltuk" feed (pantry-data.js:278–282) ===
export const pantrySuggestions: PantrySuggestion[] = [
  { name: 'Görög joghurt 10% · 500g', source: 'kifli.hu', price: '1790 Ft', reason: 'Stack-illeszkedés · esti casein +2 recipe' },
  { name: 'Mogyoróvaj 100% · 500g', source: 'kifli.hu', price: '2490 Ft', reason: 'Olcsóbb fat-source mint mandulavaj' },
  { name: 'Creapure Kreatin · 500g', source: 'myprotein.hu', price: '7990 Ft', reason: 'Stash → 25 nap múlva fogy ki' },
]

// === Mock URL-scrape draft (P8, mezo-8vum) — what the demo Link-mode scrape "extracts" ===
export const MOCK_SCRAPE_DRAFT: PantryScrapeDraft = {
  name: 'Impact Whey Protein · vanília', brand: 'Myprotein', per: 100, unit: 'g',
  kcal: 412, proteinG: 82, carbsG: 4, fatG: 7.5, fiberG: null, sugarG: 4, saltG: 0.5,
  saturatedFatG: 5, nova: 4, category: 'supplement', priceHuf: 24990, priceUnit: '/kg',
  source: 'myprotein.hu', sourceUrl: 'https://www.myprotein.hu/p/impact-whey/10530943/',
  confidence: 1, needsReview: false, barcode: null,
}

// === Mock photo-import draft (mezo-d8tr) — what the demo Fotó-mode "reads" off a label ===
export const MOCK_PHOTO_DRAFT: PantryScrapeDraft = {
  name: 'Skyr · epres', brand: 'Milbona', per: 100, unit: 'g',
  kcal: 62, proteinG: 10, carbsG: 4, fatG: 0.2, fiberG: null, sugarG: 3.9, saltG: 0.1,
  saturatedFatG: 0.1, nova: 2, category: 'dairy', priceHuf: null, priceUnit: null,
  source: 'photo', sourceUrl: null, confidence: 1, needsReview: false, barcode: null,
}

// === Mock AI meal draft (Fuel P8, mezo-78rn) — what the demo AiLogSheet "parses" from text/photo ===
// One name-matched pantry line (references a REAL Kamra seed so the badge + tap-through resolve;
// needsReview=true is the realistic shape of a deterministic name match, mezo-qrks) + one
// low-confidence estimate line (needsReview → the review-chip path). `_aiSeed` is the first food seed.
const _aiSeed = ingredients[0]
export const MOCK_AI_MEAL_DRAFT: MealAiDraft = {
  slot: 'lunch',
  title: 'Csirkés wrap + latte',
  note: null,
  items: [
    {
      source: 'pantry', pantryItemId: _aiSeed.id, recipeId: null, name: _aiSeed.name,
      amount: 60, unit: _aiSeed.unit, per: _aiSeed.per, basisUnit: _aiSeed.unit,
      kcal: _aiSeed.macros.kcal ?? 0, proteinG: _aiSeed.macros.p ?? 0, carbsG: _aiSeed.macros.c ?? 0, fatG: _aiSeed.macros.f ?? 0,
      nova: _aiSeed.nova, confidence: 1, needsReview: true,
    },
    {
      source: 'estimate', pantryItemId: null, recipeId: null, name: 'Csirkés wrap',
      amount: 1, unit: 'db', per: 1, basisUnit: 'db',
      kcal: 450, proteinG: 28, carbsG: 40, fatG: 18,
      nova: null, confidence: 0.6, needsReview: true,
    },
  ],
}

// === Standalone template breakdowns for orphan recipes (pantry-data.js:335–530) ===
const recipeTemplateBreakdowns: Record<string, MealBreakdown> = {
  'rec-3': {
    confidence: 0.86,
    tagline: null,
    summary:
      'Esti omega-3 sztori. Lazac D3 + EPA/DHA, barna rizs slow-release, brokkoli sulforaphane — három szövet-szintű hatás egy tálban. Heti 2× kötelező a post-workout vacsorához.',
    dimensions: [
      {
        id: 'macro', label: 'Kcal & makró arány', weight: 0.22, score: 0.92,
        color: 'var(--coral)',
        detail:
          'P/C/F 25/38/37%. Vacsora-profil — magas fat (omega-3-ra szándékos), elegendő carb a glikogén-pótlásra a post-workout ablakban.',
        macroRatio: { p: 25, c: 38, f: 37 },
        macroTargets: { p: '20–30%', c: '35–45%', f: '30–40%' },
        kcalShareOfDay: 24.5,
      },
      {
        id: 'micro', label: 'Rost & mikro', weight: 0.10, score: 0.96,
        color: 'var(--cat-physiology)',
        detail: 'Rost 8.4g egy adagban — barna rizs + brokkoli adja, a napi rostcél kb. 70%-a.',
        micros: [
          { name: 'Rost', value: '8.4g', pct: 70, status: 'good' },
        ],
      },
      { id: 'who', label: 'Ajánlások · WHO', weight: 0.14, score: 0.9, color: 'var(--sky)', detail: 'Cukor az energia 6%-a (WHO ≤10%) · só a keret 55%-án.', context: [ { label: 'Cukor', value: '6 E% / 10 E% limit' }, { label: 'Só', value: '0.8 g / 1.5 g keret' } ] },
      { id: 'fat_quality', label: 'Zsírminőség', weight: 0.10, score: 0.85, color: 'var(--amber-deep)', detail: 'Telített zsír az energia 5%-a · az összzsír 24%-a.', context: [ { label: 'Telített E%', value: '5% / 10% limit' }, { label: 'Telített/összzsír', value: '24% (ref. 33%)' } ] },
      {
        id: 'nova', label: 'Feldolgozottság · NOVA', weight: 0.18, score: 0.96,
        color: 'var(--cat-tendency)',
        detail: '100% whole foods, olívaolaj az egyetlen NOVA 2. Ideális vacsora-profil.',
        nova: {
          dominant: 1,
          stack: [
            { nova: 1, pct: 92, label: 'Lazac · brokkoli · rizs' },
            { nova: 2, pct: 8, label: 'Olívaolaj' },
            { nova: 3, pct: 0, label: '—' },
            { nova: 4, pct: 0, label: '—' },
          ],
          items: [
            { name: 'Lazacfilé 180g', nova: 1 },
            { name: 'Barna rizs 80g', nova: 1 },
            { name: 'Brokkoli 200g', nova: 1 },
            { name: 'Olívaolaj 10g', nova: 2 },
          ],
        },
      },
      { id: 'plant_diversity', label: 'Növényi diverzitás', weight: 0.08, score: 1.0, color: 'var(--sage-deep)', detail: '3 különböző növényi kategória a 3-s célhoz.', context: [ { label: 'Növényi kategóriák', value: 'grains · fruits · nuts_seeds' }, { label: 'Összesen', value: '3 / 3 cél' } ] },
      { id: 'energy_density', label: 'Energia-sűrűség', weight: 0.06, score: 0.78, color: 'var(--lav)', detail: '182 kcal/100g (150 alatt teljes pont, 400 felett nulla).', context: [ { label: 'Sűrűség', value: '182 kcal/100g' }, { label: 'Lefedettség', value: '100% gramm-alapú' } ] },
      { id: 'portion', label: 'Adag-arány', weight: 0.12, score: 0.95, color: 'var(--coral-deep)', detail: 'Egy adag a vacsora büdzsé 89%-a.', context: [ { label: 'Adag kcal', value: '689 kcal' }, { label: 'Slot-büdzsé', value: '775 kcal (vacsora 25%)' } ] },
    ],
    improve: [
      { text: 'Ha rest-day vacsora: rizs csökkenthető 50g-ra (kcal share 24% → 19%).', impact: 'context-adj' },
      { text: '+½ avokádó esetén Mg 48% → 78%, F arány stabil.', impact: '+0.02 score' },
    ],
    tools: [
      { type: 'read', name: 'lookupNutrients(items=4)' },
      { type: 'compute', name: 'classifyNOVA(items=4)' },
      { type: 'compute', name: 'evaluateRecipeFit(recipe, profile)' },
    ],
  },
  'rec-5': {
    confidence: 0.82,
    tagline: null,
    summary:
      'Egyszerű, fehérje-súlyos, alacsony-carb reggeli. Rest-day vagy alacsony-volumen napra ideális — alacsony-C reggel + spenót K1 + tojás kolin együtt jó cognitive-load napra.',
    dimensions: [
      {
        id: 'macro', label: 'Kcal & makró arány', weight: 0.22, score: 0.84,
        color: 'var(--coral)',
        detail:
          'P/C/F 30/3/67%. Extrém alacsony-carb reggeli. Edzés-nap reggelire nem ideális, rest-day-re viszont igen.',
        macroRatio: { p: 30, c: 3, f: 67 },
        macroTargets: { p: '25–35%', c: '30–50%', f: '20–35%' },
        kcalShareOfDay: 10.3,
        notes: 'Magas F arány — rest-day reggelire OK, edzés-napra emelni a C-t.',
      },
      {
        id: 'micro', label: 'Rost & mikro', weight: 0.10, score: 0.92,
        color: 'var(--cat-physiology)',
        detail: 'Rost 3.9g — a spenótból, a napi rostcél kb. 33%-a. A kolin/K1/folát a WHO-dimenzió alá esik.',
        micros: [
          { name: 'Rost', value: '3.9g', pct: 33, status: 'ok' },
        ],
      },
      { id: 'who', label: 'Ajánlások · WHO', weight: 0.14, score: 0.9, color: 'var(--sky)', detail: 'Cukor az energia 6%-a (WHO ≤10%) · só a keret 55%-án.', context: [ { label: 'Cukor', value: '6 E% / 10 E% limit' }, { label: 'Só', value: '0.8 g / 1.5 g keret' } ] },
      { id: 'fat_quality', label: 'Zsírminőség', weight: 0.10, score: 0.85, color: 'var(--amber-deep)', detail: 'Telített zsír az energia 5%-a · az összzsír 24%-a.', context: [ { label: 'Telített E%', value: '5% / 10% limit' }, { label: 'Telített/összzsír', value: '24% (ref. 33%)' } ] },
      {
        id: 'nova', label: 'Feldolgozottság · NOVA', weight: 0.18, score: 0.96,
        color: 'var(--cat-tendency)',
        detail: '100% whole foods. Tojás, spenót, olívaolaj — ennél tisztább reggeli nem létezik.',
        nova: {
          dominant: 1,
          stack: [
            { nova: 1, pct: 92, label: 'Tojás · spenót' },
            { nova: 2, pct: 8, label: 'Olívaolaj' },
            { nova: 3, pct: 0, label: '—' },
            { nova: 4, pct: 0, label: '—' },
          ],
          items: [
            { name: 'Tojás 3db', nova: 1 },
            { name: 'Spenót 60g', nova: 1 },
            { name: 'Olívaolaj 6g', nova: 2 },
          ],
        },
      },
      { id: 'plant_diversity', label: 'Növényi diverzitás', weight: 0.08, score: 1.0, color: 'var(--sage-deep)', detail: '3 különböző növényi kategória a 3-s célhoz.', context: [ { label: 'Növényi kategóriák', value: 'grains · fruits · nuts_seeds' }, { label: 'Összesen', value: '3 / 3 cél' } ] },
      { id: 'energy_density', label: 'Energia-sűrűség', weight: 0.06, score: 0.78, color: 'var(--lav)', detail: '182 kcal/100g (150 alatt teljes pont, 400 felett nulla).', context: [ { label: 'Sűrűség', value: '182 kcal/100g' }, { label: 'Lefedettség', value: '100% gramm-alapú' } ] },
      { id: 'portion', label: 'Adag-arány', weight: 0.12, score: 0.95, color: 'var(--coral-deep)', detail: 'Egy adag a reggeli büdzsé 89%-a.', context: [ { label: 'Adag kcal', value: '689 kcal' }, { label: 'Slot-büdzsé', value: '775 kcal (reggeli 25%)' } ] },
    ],
    improve: [
      { text: '+1 szelet teljes kiőrlésű kenyér edzés-nap reggelin → C 3% → 28%.', impact: 'context-adj' },
      { text: '+1 db paradicsom = lycopene + Vit C + Fiber.', impact: '+0.02 score' },
    ],
    tools: [
      { type: 'read', name: 'lookupNutrients(items=3)' },
      { type: 'compute', name: 'evaluateRecipeFit(recipe, profile)' },
    ],
  },
  'rec-6': {
    confidence: 0.88,
    tagline: null,
    summary:
      'Esti casein-bomba. 37g protein, slow-digest, alacsony-fat — pont az amit a 21:00 esti étkezésre vársz gyógyszer-ciklus alatt. Áfonya antocianin + méz minimális glikémia-bump.',
    dimensions: [
      {
        id: 'macro', label: 'Kcal & makró arány', weight: 0.22, score: 0.92,
        color: 'var(--coral)',
        detail:
          'P/C/F 48/39/13%. Esti casein-súlyos snack. Kalória-density alacsony — gyógyszer-ciklus alatt pont a protein-target tartására.',
        macroRatio: { p: 48, c: 39, f: 13 },
        macroTargets: { p: '30–55% snack', c: '30–50%', f: '10–25%' },
        kcalShareOfDay: 10.0,
      },
      {
        id: 'micro', label: 'Rost & mikro', weight: 0.10, score: 0.84,
        color: 'var(--cat-physiology)',
        detail: 'Rost 2.1g — az áfonyából, a napi rostcél kb. 18%-a; a túró rostszegény. Ca/B12 a WHO-dimenzió alá esik.',
        micros: [
          { name: 'Rost', value: '2.1g', pct: 18, status: 'low' },
        ],
      },
      { id: 'who', label: 'Ajánlások · WHO', weight: 0.14, score: 0.9, color: 'var(--sky)', detail: 'Cukor az energia 6%-a (WHO ≤10%) · só a keret 55%-án.', context: [ { label: 'Cukor', value: '6 E% / 10 E% limit' }, { label: 'Só', value: '0.8 g / 1.5 g keret' } ] },
      { id: 'fat_quality', label: 'Zsírminőség', weight: 0.10, score: 0.85, color: 'var(--amber-deep)', detail: 'Telített zsír az energia 5%-a · az összzsír 24%-a.', context: [ { label: 'Telített E%', value: '5% / 10% limit' }, { label: 'Telített/összzsír', value: '24% (ref. 33%)' } ] },
      {
        id: 'nova', label: 'Feldolgozottság · NOVA', weight: 0.18, score: 0.84,
        color: 'var(--cat-tendency)',
        detail: "Túró NOVA 3 (kulturált tejtermék — élelmiszerként ez nem 'ultra'). Méz NOVA 2.",
        nova: {
          dominant: 3,
          stack: [
            { nova: 1, pct: 22, label: 'Áfonya' },
            { nova: 2, pct: 4, label: 'Méz' },
            { nova: 3, pct: 74, label: 'Túró' },
            { nova: 4, pct: 0, label: '—' },
          ],
          items: [
            { name: 'Túró 200g', nova: 3 },
            { name: 'Áfonya 60g', nova: 1 },
            { name: 'Méz 10g', nova: 2 },
          ],
        },
      },
      { id: 'plant_diversity', label: 'Növényi diverzitás', weight: 0.08, score: 1.0, color: 'var(--sage-deep)', detail: '3 különböző növényi kategória a 3-s célhoz.', context: [ { label: 'Növényi kategóriák', value: 'grains · fruits · nuts_seeds' }, { label: 'Összesen', value: '3 / 3 cél' } ] },
      { id: 'energy_density', label: 'Energia-sűrűség', weight: 0.06, score: 0.78, color: 'var(--lav)', detail: '182 kcal/100g (150 alatt teljes pont, 400 felett nulla).', context: [ { label: 'Sűrűség', value: '182 kcal/100g' }, { label: 'Lefedettség', value: '100% gramm-alapú' } ] },
      { id: 'portion', label: 'Adag-arány', weight: 0.12, score: 0.95, color: 'var(--coral-deep)', detail: 'Egy adag az esti snack büdzsé 89%-a.', context: [ { label: 'Adag kcal', value: '689 kcal' }, { label: 'Slot-büdzsé', value: '775 kcal (snack 25%)' } ] },
    ],
    improve: [
      { text: '+½ ek tökmag → Mg 14% → 48%, NOVA stack változatlan.', impact: '+0.03 score' },
      { text: 'Méz → fahéj swap esti vércukor-stability esetén.', impact: '+0.01 score' },
    ],
    tools: [
      { type: 'read', name: 'lookupNutrients(items=3)' },
      { type: 'compute', name: 'classifyNOVA(items=3)' },
    ],
  },
}

// ============================================================
// Runtime links — replicate pantry-data.js:301–332 + 532–536.
// Recipe ↔ meal mapping: m1↔rec-1, m2↔rec-2. (The m3↔rec-4 snack link was dropped with the
// partial-day seed, mezo-1oy5 — the 16:00 snack is a future/unlogged window now, so rec-4 carries
// no recentLog today.)
// The fuelDay object is NOT mutated; recipeId/loggedAt are derived locally.
// ============================================================
const recipeLinks: { mealId: string; recipeId: string }[] = [
  { mealId: 'm1', recipeId: 'rec-1' }, // Túrós zabkása reggel
  { mealId: 'm2', recipeId: 'rec-2' }, // Csirke + édesburgonya
]

// Historical per-log scores. The live fuelDay.meals[].score now ships NULL behind the
// pending-sparkle placeholder (meal scoring is Phase-3), but a recipe's PAST recentLogs
// retain the score they earned when logged — these feed RecipeLogsList. Decoupled from the
// (nulled) display score so nulling the day view does not erase the recipe log history.
const recentLogScore: Record<string, number> = { m1: 0.92, m2: 0.88 }

// pantry-data.js:310 — loggedAt = "ma · " + (meal.slot.split("· ")[1] || meal.slot)
function deriveLoggedAt(slot: string): string {
  return 'ma · ' + (slot.split('· ')[1] || slot)
}

// Local view of meals with their derived recipeId + loggedAt (does not mutate fuelDay).
interface LinkedMeal { meal: FuelMeal; recipeId: string; loggedAt: string }
const linkedMeals: LinkedMeal[] = recipeLinks
  .map(link => {
    const meal = fuelDay.meals.find(m => m.id === link.mealId)
    if (!meal) return null
    return { meal, recipeId: link.recipeId, loggedAt: deriveLoggedAt(meal.slot) }
  })
  .filter((x): x is LinkedMeal => x !== null)

export const recipes: Recipe[] = recipesBase.map(r => {
  // pantry-data.js:316–324 — mirror logged meals (with breakdowns) onto the recipe.
  const recentLogs: RecipeLog[] = linkedMeals.flatMap(lm => {
    const score = recentLogScore[lm.meal.id]
    if (lm.recipeId !== r.id || score == null) return []
    return [{
      mealId: lm.meal.id,
      slot: lm.meal.slot,
      score,
      delta: +(score - (r.mezoFit.score ?? 0)).toFixed(2),
      loggedAt: lm.loggedAt,
      kcal: lm.meal.kcal,
      p: lm.meal.p,
      c: lm.meal.c,
      f: lm.meal.f,
    }]
  })

  // pantry-data.js:326–331 — baseline template = the most recent linked meal's breakdown.
  const sourceMeal = linkedMeals.find(lm => lm.recipeId === r.id && lm.meal.breakdown)
  // pantry-data.js:532–536 — orphan recipes (rec-3/5/6) get standalone breakdowns.
  const templateBreakdown: MealBreakdown | undefined =
    sourceMeal?.meal.breakdown ?? recipeTemplateBreakdowns[r.id]

  // Enrich each line with snapshot name + contribution, then roll the whole-recipe macros up
  // from those contributions — IDENTICAL to what the backend RecipeMapper produces, so the
  // mock seed and the API agree byte-for-byte (the shared recipeMacros formula).
  const enrichedIngredients = r.ingredients.map(line =>
    enrichLine(line, ingredients.find(i => i.id === line.refId)),
  )
  const macros = computeRecipeMacros(enrichedIngredients)
  const nutrients = computeRecipeNutrients(enrichedIngredients)

  return { ...r, ingredients: enrichedIngredients, macros, nutrients, recentLogs, templateBreakdown }
})

// === Mock shared catalog (S4, mezo-qw37.4) — what "Hozzáadás a közösből" searches in demo mode ===
export const pantryCatalogFixture: PantryCatalogEntry[] = [
  { id: 'cat-skyr', kind: 'food', name: 'Skyr natúr', brand: 'Ehrmann', source: 'manual', category: 'dairy', per: 100, unit: 'g', kcal: 63, proteinG: 10.6, carbsG: 4, fatG: 0.2, sugarG: 3.9, saltG: 0.09, saturatedFatG: 0.1, nova: 1, authorName: 'Anna' },
  { id: 'cat-bulgur', kind: 'food', name: 'Bulgur Raw Kifli', brand: null, source: 'kifli.hu', category: 'grains', per: 100, unit: 'g', kcal: 331, proteinG: 11, carbsG: 63, fatG: 1, fiberG: 13, nova: 1, authorName: null },
  { id: 'cat-kreatin', kind: 'supplement', name: 'Creatine Monohydrate', brand: 'MyProtein', source: 'myprotein.hu', category: 'supplement', per: 100, unit: 'g', kcal: 0, form: 'por', authorName: 'Béla' },
]
