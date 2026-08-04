\set ON_ERROR_STOP on

BEGIN;

LOCK TABLE pantry_item IN SHARE ROW EXCLUSIVE MODE;

CREATE TEMP TABLE pantry_name_translation (
  old_name text PRIMARY KEY,
  new_name text NOT NULL UNIQUE
) ON COMMIT DROP;

INSERT INTO pantry_name_translation (old_name, new_name) VALUES
  ('Almond Milk', 'Mandulaital'),
  ('Apple Idared', 'Idared alma'),
  ('Avocado', 'Avokádó'),
  ('Baby Spinach', 'Bébispenót'),
  ('Bacon Lidl', 'Lidl baconszalonna'),
  ('Banana', 'Banán'),
  ('Baresa Tomato Puree Lidl', 'Baresa paradicsompüré Lidl'),
  ('Basmati Rice', 'Basmati rizs'),
  ('Belbake Flour', 'Belbake liszt'),
  ('Black Beans', 'Fekete bab'),
  ('Blueberries Frozen Lidl', 'Fagyasztott áfonya Lidl'),
  ('Broccoli', 'Brokkoli'),
  ('Brown Onion', 'Vöröshagyma'),
  ('Brown rice chips', 'Barna rizschips'),
  ('Bulgur Raw Kifli', 'Nyers bulgur Kifli'),
  ('Butter LM Lidl', 'Laktózmentes vaj Lidl'),
  ('Cacao Powder', 'Kakaópor'),
  ('Carrots', 'Sárgarépa'),
  ('Carrots Baby', 'Bébirépa'),
  ('Cashew Nuts Roasted', 'Pörkölt kesudió'),
  ('Cashews Raw', 'Nyers kesudió'),
  ('Celery Stick', 'Szárzeller'),
  ('Cheddar Cheese', 'Cheddar sajt'),
  ('Cherry Frozen Lidl', 'Fagyasztott cseresznye Lidl'),
  ('Cherry Tomatoes', 'Koktélparadicsom'),
  ('Chia Seeds', 'Chiamag'),
  ('Chicken Breast Cooked', 'Főtt csirkemell'),
  ('Chicken Ham', 'Csirkemellsonka'),
  ('Chicken Thigh Skinless Cooked', 'Főtt, bőr nélküli csirkecomb'),
  ('Chickpea Pasta', 'Csicseriborsó-tészta'),
  ('Chickpeas Canned', 'Konzerv csicseriborsó'),
  ('Chopped Tomatoes', 'Darabolt paradicsom'),
  ('Cocoa Granola Hesters Life', 'Hester''s Life kakaós granola'),
  ('Coconut Milk Light Lidl', 'Lidl light kókusztej'),
  ('Cooking Cream Milbona LM', 'Milbona laktózmentes főzőtejszín'),
  ('Corn', 'Kukorica'),
  ('Cornstarch', 'Kukoricakeményítő'),
  ('Cottage Cheese LM Lidl', 'Laktózmentes szemcsés túró Lidl'),
  ('Cucumber', 'Uborka'),
  ('Duck fat', 'Kacsazsír'),
  ('Eggs', 'Tojás'),
  ('Energy Gel', 'Energiazselé'),
  ('Fermented Cabbage', 'Fermentált káposzta'),
  ('Fermented Immune Booster', 'Fermentált immunerősítő'),
  ('Fussili Whole Wheat', 'Teljes kiőrlésű fusilli'),
  ('Garlic', 'Fokhagyma'),
  ('Ginger', 'Gyömbér'),
  ('Ginger Fresh', 'Friss gyömbér'),
  ('Greek yoghurt', 'Görög joghurt'),
  ('Green Beans', 'Zöldbab'),
  ('Green Pea Frozen Lidl', 'Fagyasztott zöldborsó Lidl'),
  ('Ground Beef', 'Darált marhahús'),
  ('Ground Pork', 'Darált sertéshús'),
  ('Ground Turkey', 'Darált pulykahús'),
  ('Ground Turkey Cooked', 'Főtt darált pulykahús'),
  ('Heinz Smokey & Rich BBQ', 'Heinz füstös BBQ-szósz'),
  ('Hesters Life Blackcherry', 'Hester''s Life fekete cseresznye'),
  ('Honey', 'Méz'),
  ('Hummus with Mango', 'Mangós hummusz'),
  ('Joghurt Blueberry High Protein LM Lidl', 'Lidl laktózmentes, magas fehérjetartalmú áfonyás joghurt'),
  ('Joghurt LM Lidl', 'Laktózmentes joghurt Lidl'),
  ('Joghurt Plain High Protein LM Lidl', 'Lidl laktózmentes, natúr, magas fehérjetartalmú joghurt'),
  ('Joghurt Strawberry High Protein LM Lidl', 'Lidl laktózmentes, magas fehérjetartalmú epres joghurt'),
  ('Kiwi', 'Kivi'),
  ('Lasagne Pasta Combino', 'Combino lasagnelap'),
  ('Lentil Salad', 'Lencsesaláta'),
  ('Lentils Happy Harvest', 'Happy Harvest lencse'),
  ('Maggi Chicken Broth', 'Maggi csirkehúsleves'),
  ('Mag Mix Lidl', 'Lidl magkeverék'),
  ('Mango', 'Mangó'),
  ('Mayo Light Lidl', 'Lidl light majonéz'),
  ('Mousse High Protein Chocolate', 'Magas fehérjetartalmú csokoládémousse'),
  ('Mozzarella LM Lidl', 'Laktózmentes mozzarella Lidl'),
  ('Mustard', 'Mustár'),
  ('Oat Flour', 'Zabliszt'),
  ('Oat Rolled', 'Zabpehely'),
  ('Olive oil', 'Olívaolaj'),
  ('Orange', 'Narancs'),
  ('Orange Juice', 'Narancslé'),
  ('Peanut Butter Homemade', 'Házi mogyoróvaj'),
  ('Peanut Butter ProteinCo', 'ProteinCo mogyoróvaj'),
  ('Pecans', 'Pekándió'),
  ('Pineapple', 'Ananász'),
  ('Pork parisian', 'Sertéspárizsi'),
  ('Pork shoulder', 'Sertéslapocka'),
  ('Potatoes Yellow', 'Sárga burgonya'),
  ('Protein Bar Cookies & Cream Lidl', 'Lidl kekszes-krémes proteinszelet'),
  ('Protein bar Crunchy Pink', 'Crunchy Pink proteinszelet'),
  ('Protein bar Peanuts', 'Mogyorós proteinszelet'),
  ('ProteinCo Biscuit Cookie', 'ProteinCo keksz'),
  ('ProteinCo Cinnamon Milk', 'ProteinCo fahéjas tej'),
  ('ProteinCo Strawberry Milkshake', 'ProteinCo epres turmix'),
  ('Pudding High Protein Chocolate', 'Magas fehérjetartalmú csokoládépuding'),
  ('Quark LM Lidl', 'Laktózmentes túró Lidl'),
  ('Rapsberries', 'Málna'),
  ('Red Beans', 'Vörösbab'),
  ('Red Lentil Pasta', 'Vöröslencse-tészta'),
  ('Red Onion', 'Lilahagyma'),
  ('Rice Pudding High Protein Lidl', 'Lidl magas fehérjetartalmú tejberizs'),
  ('Rolled Oat Crownfield', 'Crownfield zabpehely'),
  ('Rump Steak Cooked', 'Sült marhafartő'),
  ('Soy Bean Spaghetti', 'Szójababspagetti'),
  ('Soy Milk', 'Szójaital'),
  ('Soy Milk High Protein LM Lidl', 'Lidl magas fehérjetartalmú szójaital'),
  ('Soy Sauce Lidl', 'Lidl szójaszósz'),
  ('Spaghetti Combino Whole Wheat', 'Combino teljes kiőrlésű spagetti'),
  ('Strawberries Frozen Lidl', 'Fagyasztott eper Lidl'),
  ('Sweetcorn', 'Csemegekukorica'),
  ('Sweet Potato', 'Édesburgonya'),
  ('Tofu Plain', 'Natúr tofu'),
  ('Tomato Chopped Baresa', 'Baresa darabolt paradicsom'),
  ('Tomato Passata Baresa', 'Baresa passzírozott paradicsom'),
  ('Tomato passata rustica', 'Baresa rusztikus passzírozott paradicsom'),
  ('Tomato Passata Tesco', 'Tesco passzírozott paradicsom'),
  ('Tomato Puree', 'Paradicsompüré'),
  ('Tortila Wrap Penny Market', 'Penny Market tortillalap'),
  ('Tortilla Wrap Lidl', 'Lidl tortillalap'),
  ('Trikolor Pepper', 'Trikolor paprika'),
  ('Tuna In Brine', 'Tonhal sós lében'),
  ('Tuna In Oil', 'Tonhal olajban'),
  ('Turkey Liver', 'Pulykamáj'),
  ('Túrórudi High Protein Lidl', 'Lidl magas fehérjetartalmú túrórudi'),
  ('Wellness Whole Bread', 'Wellness teljes kiőrlésű kenyér'),
  ('White Beans', 'Fehérbab'),
  ('Worcestershire Sauce', 'Worcestershire-szósz'),
  ('Collagen Protein MyProtein', 'MyProtein kollagénfehérje'),
  ('Impact Whey Blueberry MyProtein', 'MyProtein Impact Whey áfonyás fehérjepor'),
  ('Iso Whey Nutriversum Chocolate', 'Nutriversum Iso Whey csokoládés fehérjepor'),
  ('Iso Whey Nutriversum Vanilla', 'Nutriversum Iso Whey vaníliás fehérjepor'),
  ('Peanut Butter Powder Nutriversum', 'Nutriversum mogyoróvajpor'),
  ('Salted Caramel Vegan Whey', 'Sós karamellás vegán fehérjepor');

DO $$
DECLARE
  expected_count constant integer := 131;
  mapping_count integer;
  resolved_count integer;
BEGIN
  SELECT count(*) INTO mapping_count FROM pantry_name_translation;
  IF mapping_count <> expected_count THEN
    RAISE EXCEPTION 'translation map count %, expected %', mapping_count, expected_count;
  END IF;

  SELECT count(*) INTO resolved_count
  FROM pantry_item p
  JOIN pantry_name_translation m ON m.old_name = p.name
  WHERE p.is_deleted = false;

  IF resolved_count <> expected_count THEN
    RAISE EXCEPTION 'active source rows resolved %, expected %', resolved_count, expected_count;
  END IF;
END
$$;

CREATE TEMP TABLE pantry_name_translation_resolved ON COMMIT DROP AS
SELECT p.id, m.old_name, m.new_name
FROM pantry_item p
JOIN pantry_name_translation m ON m.old_name = p.name
WHERE p.is_deleted = false;

DO $$
DECLARE
  affected_count integer;
BEGIN
  UPDATE pantry_item p
  SET name = r.new_name
  FROM pantry_name_translation_resolved r
  WHERE p.id = r.id
    AND p.is_deleted = false
    AND p.name = r.old_name;

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  IF affected_count <> 131 THEN
    RAISE EXCEPTION 'updated rows %, expected 131', affected_count;
  END IF;
END
$$;

DO $$
DECLARE
  translated_count integer;
  old_name_count integer;
BEGIN
  SELECT count(*) INTO translated_count
  FROM pantry_item p
  JOIN pantry_name_translation_resolved r ON r.id = p.id AND r.new_name = p.name
  WHERE p.is_deleted = false;

  SELECT count(*) INTO old_name_count
  FROM pantry_item p
  JOIN pantry_name_translation m ON m.old_name = p.name
  WHERE p.is_deleted = false;

  IF translated_count <> 131 OR old_name_count <> 0 THEN
    RAISE EXCEPTION 'post-update translated %, old-name %, expected 131/0', translated_count, old_name_count;
  END IF;
END
$$;

SELECT count(*) AS translated_rows
FROM pantry_item p
JOIN pantry_name_translation_resolved r ON r.id = p.id AND r.new_name = p.name
WHERE p.is_deleted = false;

COMMIT;
