# Live Pantry Name Translation Implementation Plan

> **For agentic workers:** Execute inline with `superpowers:executing-plans`. Beads issue `mezo-8t51` is the source of task status.

**Goal:** Translate English text in the `name` column of active production `pantry_item` rows into natural Hungarian without changing any other data.

**Architecture:** Use an explicit old-name → new-name map, resolve it against active production rows, preserve the original names in a local rollback CSV, and perform the update in one guarded PostgreSQL transaction. Verification compares row counts, deleted-row names, mapping coverage, and the changed-column projection before an API smoke check.

**Tech Stack:** Tailscale, kubectl, PostgreSQL 16 (`psql`), mezo pantry API

## Global constraints

- Update only `pantry_item.name` where `is_deleted = false`.
- Preserve UUIDs, ownership, brands, nutrition, enums, stock, prices, relationships, timestamps, and deleted rows.
- Use natural Hungarian wording and word order.
- Preserve brand and product-line identity while translating generic descriptors and flavours.
- Abort and roll back if the live old-name set does not match the explicit map exactly.

## Translation map

| Current name | New name |
|---|---|
| Almond Milk | Mandulaital |
| Apple Idared | Idared alma |
| Avocado | Avokádó |
| Baby Spinach | Bébispenót |
| Bacon Lidl | Lidl baconszalonna |
| Banana | Banán |
| Baresa Tomato Puree Lidl | Baresa paradicsompüré Lidl |
| Basmati Rice | Basmati rizs |
| Belbake Flour | Belbake liszt |
| Black Beans | Fekete bab |
| Blueberries Frozen Lidl | Fagyasztott áfonya Lidl |
| Broccoli | Brokkoli |
| Brown Onion | Vöröshagyma |
| Brown rice chips | Barna rizschips |
| Bulgur Raw Kifli | Nyers bulgur Kifli |
| Butter LM Lidl | Laktózmentes vaj Lidl |
| Cacao Powder | Kakaópor |
| Carrots | Sárgarépa |
| Carrots Baby | Bébirépa |
| Cashew Nuts Roasted | Pörkölt kesudió |
| Cashews Raw | Nyers kesudió |
| Celery Stick | Szárzeller |
| Cheddar Cheese | Cheddar sajt |
| Cherry Frozen Lidl | Fagyasztott cseresznye Lidl |
| Cherry Tomatoes | Koktélparadicsom |
| Chia Seeds | Chiamag |
| Chicken Breast Cooked | Főtt csirkemell |
| Chicken Ham | Csirkemellsonka |
| Chicken Thigh Skinless Cooked | Főtt, bőr nélküli csirkecomb |
| Chickpea Pasta | Csicseriborsó-tészta |
| Chickpeas Canned | Konzerv csicseriborsó |
| Chopped Tomatoes | Darabolt paradicsom |
| Cocoa Granola Hesters Life | Hester's Life kakaós granola |
| Coconut Milk Light Lidl | Lidl light kókusztej |
| Cooking Cream Milbona LM | Milbona laktózmentes főzőtejszín |
| Corn | Kukorica |
| Cornstarch | Kukoricakeményítő |
| Cottage Cheese LM Lidl | Laktózmentes szemcsés túró Lidl |
| Cucumber | Uborka |
| Duck fat | Kacsazsír |
| Eggs | Tojás |
| Energy Gel | Energiazselé |
| Fermented Cabbage | Fermentált káposzta |
| Fermented Immune Booster | Fermentált immunerősítő |
| Fussili Whole Wheat | Teljes kiőrlésű fusilli |
| Garlic | Fokhagyma |
| Ginger | Gyömbér |
| Ginger Fresh | Friss gyömbér |
| Greek yoghurt | Görög joghurt |
| Green Beans | Zöldbab |
| Green Pea Frozen Lidl | Fagyasztott zöldborsó Lidl |
| Ground Beef | Darált marhahús |
| Ground Pork | Darált sertéshús |
| Ground Turkey | Darált pulykahús |
| Ground Turkey Cooked | Főtt darált pulykahús |
| Heinz Smokey & Rich BBQ | Heinz füstös BBQ-szósz |
| Hesters Life Blackcherry | Hester's Life fekete cseresznye |
| Honey | Méz |
| Hummus with Mango | Mangós hummusz |
| Joghurt Blueberry High Protein LM Lidl | Lidl laktózmentes, magas fehérjetartalmú áfonyás joghurt |
| Joghurt LM Lidl | Laktózmentes joghurt Lidl |
| Joghurt Plain High Protein LM Lidl | Lidl laktózmentes, natúr, magas fehérjetartalmú joghurt |
| Joghurt Strawberry High Protein LM Lidl | Lidl laktózmentes, magas fehérjetartalmú epres joghurt |
| Kiwi | Kivi |
| Lasagne Pasta Combino | Combino lasagnelap |
| Lentil Salad | Lencsesaláta |
| Lentils Happy Harvest | Happy Harvest lencse |
| Maggi Chicken Broth | Maggi csirkehúsleves |
| Mag Mix Lidl | Lidl magkeverék |
| Mango | Mangó |
| Mayo Light Lidl | Lidl light majonéz |
| Mousse High Protein Chocolate | Magas fehérjetartalmú csokoládémousse |
| Mozzarella LM Lidl | Laktózmentes mozzarella Lidl |
| Mustard | Mustár |
| Oat Flour | Zabliszt |
| Oat Rolled | Zabpehely |
| Olive oil | Olívaolaj |
| Orange | Narancs |
| Orange Juice | Narancslé |
| Peanut Butter Homemade | Házi mogyoróvaj |
| Peanut Butter ProteinCo | ProteinCo mogyoróvaj |
| Pecans | Pekándió |
| Pineapple | Ananász |
| Pork parisian | Sertéspárizsi |
| Pork shoulder | Sertéslapocka |
| Potatoes Yellow | Sárga burgonya |
| Protein Bar Cookies & Cream Lidl | Lidl kekszes-krémes proteinszelet |
| Protein bar Crunchy Pink | Crunchy Pink proteinszelet |
| Protein bar Peanuts | Mogyorós proteinszelet |
| ProteinCo Biscuit Cookie | ProteinCo keksz |
| ProteinCo Cinnamon Milk | ProteinCo fahéjas tej |
| ProteinCo Strawberry Milkshake | ProteinCo epres turmix |
| Pudding High Protein Chocolate | Magas fehérjetartalmú csokoládépuding |
| Quark LM Lidl | Laktózmentes túró Lidl |
| Rapsberries | Málna |
| Red Beans | Vörösbab |
| Red Lentil Pasta | Vöröslencse-tészta |
| Red Onion | Lilahagyma |
| Rice Pudding High Protein Lidl | Lidl magas fehérjetartalmú tejberizs |
| Rolled Oat Crownfield | Crownfield zabpehely |
| Rump Steak Cooked | Sült marhafartő |
| Soy Bean Spaghetti | Szójababspagetti |
| Soy Milk | Szójaital |
| Soy Milk High Protein LM Lidl | Lidl magas fehérjetartalmú szójaital |
| Soy Sauce Lidl | Lidl szójaszósz |
| Spaghetti Combino Whole Wheat | Combino teljes kiőrlésű spagetti |
| Strawberries Frozen Lidl | Fagyasztott eper Lidl |
| Sweetcorn | Csemegekukorica |
| Sweet Potato | Édesburgonya |
| Tofu Plain | Natúr tofu |
| Tomato Chopped Baresa | Baresa darabolt paradicsom |
| Tomato Passata Baresa | Baresa passzírozott paradicsom |
| Tomato passata rustica | Baresa rusztikus passzírozott paradicsom |
| Tomato Passata Tesco | Tesco passzírozott paradicsom |
| Tomato Puree | Paradicsompüré |
| Tortila Wrap Penny Market | Penny Market tortillalap |
| Tortilla Wrap Lidl | Lidl tortillalap |
| Trikolor Pepper | Trikolor paprika |
| Tuna In Brine | Tonhal sós lében |
| Tuna In Oil | Tonhal olajban |
| Turkey Liver | Pulykamáj |
| Túrórudi High Protein Lidl | Lidl magas fehérjetartalmú túrórudi |
| Wellness Whole Bread | Wellness teljes kiőrlésű kenyér |
| White Beans | Fehérbab |
| Worcestershire Sauce | Worcestershire-szósz |
| Collagen Protein MyProtein | MyProtein kollagénfehérje |
| Impact Whey Blueberry MyProtein | MyProtein Impact Whey áfonyás fehérjepor |
| Iso Whey Nutriversum Chocolate | Nutriversum Iso Whey csokoládés fehérjepor |
| Iso Whey Nutriversum Vanilla | Nutriversum Iso Whey vaníliás fehérjepor |
| Peanut Butter Powder Nutriversum | Nutriversum mogyoróvajpor |
| Salted Caramel Vegan Whey | Sós karamellás vegán fehérjepor |

## Task 1: Build and validate the guarded SQL

**Files:**
- Create during execution: `docs/superpowers/plans/assets/2026-08-04-live-pantry-name-translation.sql`

The SQL creates a temporary `(old_name, new_name)` table containing the exact map above. It asserts that every old name resolves to exactly one active UUID, creates a UUID-keyed resolved mapping, performs `UPDATE pantry_item SET name = ...` inside `BEGIN`, checks the affected row count against the mapping count, and commits only after the checks pass.

Validation commands:

```bash
rg -c '^  \(' docs/superpowers/plans/assets/2026-08-04-live-pantry-name-translation.sql
kubectl --kubeconfig /Users/mrkuhne/.kube/mezo-k3s.yaml -n mezo exec -i postgres-0 -- \
  psql -X -U mezo -d mezo -v ON_ERROR_STOP=1 \
  < docs/superpowers/plans/assets/2026-08-04-live-pantry-name-translation.sql
```

The first command must equal the mapping size encoded in the SQL. `psql` must finish with `COMMIT`; any missing, duplicate, or deleted-only old name raises an exception and rolls back.

## Task 2: Preserve rollback data and execute

Before the update, export all columns of all 162 `pantry_item` rows to `/tmp/mezo-8t51-pantry-item-before.csv` inside `postgres-0`, then copy it without overwrite to `/Users/mrkuhne/MrKuhne/mezo-live-backups/20260804-mezo-8t51-pantry-item-before.csv`. Verify that the CSV has 163 lines including its header and record its SHA-256 checksum. Also record a deterministic PostgreSQL hash of the ordered non-`name` column projection; the same query must return the same hash after the update.

Run the guarded SQL once. Do not retry blindly if it fails; inspect the failed assertion and leave production unchanged.

## Task 3: Verify production and smoke-test the app

Query production to prove:

- total rows remain 162, active rows remain 158, and deleted rows remain 4;
- the number of active rows with translated target names equals the mapping size;
- no active row retains a mapped English old name;
- the four deleted UUID/name pairs still match the rollback CSV;
- the projection of every non-name column matches the rollback-time projection recorded before execution.

Finally call the authenticated pantry API or inspect the Kamra UI and spot-check at least `Tojás`, `Főtt csirkemell`, `Mandulaital`, `Lidl magas fehérjetartalmú tejberizs`, and one translated supplement name.

Close `mezo-8t51` only after all database assertions and the application smoke check pass.
