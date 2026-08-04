\set ON_ERROR_STOP on

BEGIN;

LOCK TABLE pantry_item IN SHARE ROW EXCLUSIVE MODE;

DO $guard$
DECLARE
  total_count integer;
  active_count integer;
  deleted_count integer;
  owner_count integer;
BEGIN
  SELECT count(*),
         count(*) FILTER (WHERE NOT is_deleted),
         count(*) FILTER (WHERE is_deleted),
         count(DISTINCT created_by) FILTER (WHERE NOT is_deleted)
    INTO total_count, active_count, deleted_count, owner_count
    FROM pantry_item;

  IF (total_count, active_count, deleted_count) <> (162, 158, 4) THEN
    RAISE EXCEPTION 'Unexpected pantry baseline: total %, active %, deleted %',
      total_count, active_count, deleted_count;
  END IF;

  IF owner_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one owner among active pantry rows, found %', owner_count;
  END IF;
END
$guard$;

CREATE TEMP TABLE staple_catalog (
  id uuid PRIMARY KEY,
  fdc_id bigint NOT NULL UNIQUE,
  name text NOT NULL UNIQUE,
  category text NOT NULL,
  data_type text NOT NULL,
  source_description text NOT NULL,
  release_date text NOT NULL,
  kcal numeric NOT NULL,
  protein_g numeric NOT NULL,
  carbs_g numeric NOT NULL,
  fat_g numeric NOT NULL,
  fiber_g numeric,
  sugar_g numeric,
  saturated_fat_g numeric
) ON COMMIT DROP;

INSERT INTO staple_catalog (
  id, fdc_id, name, category, data_type, source_description, release_date,
  kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g, saturated_fat_g
) VALUES
  ('145f6444-c686-4b7b-ae3b-0bee7037464e'::uuid, 2710823, 'Spárga, nyers', 'vegetables', 'Foundation', 'Asparagus, green, raw', '2026-04-30', 23.5, 1.44, 5.10, 0.216, 1.88, NULL, NULL)
, ('05f3bef3-ed18-4814-bd88-6f514c4e023d'::uuid, 169145, 'Cékla, nyers', 'vegetables', 'SR Legacy', 'Beets, raw', '2018-04', 43.0, 1.61, 9.56, 0.170, 2.80, 6.76, 0.027)
, ('dc3592b7-8f8a-4e09-b422-fee64f0f0aec'::uuid, 170383, 'Kelbimbó, nyers', 'vegetables', 'SR Legacy', 'Brussels sprouts, raw', '2018-04', 43.0, 3.38, 8.95, 0.300, 3.80, 2.20, 0.062)
, ('33a98438-51c0-4f5e-b97c-2e770de2507e'::uuid, 2346407, 'Fejes káposzta, nyers', 'vegetables', 'Foundation', 'Cabbage, green, raw', '2026-04-30', 27.9, 0.961, 6.38, 0.228, NULL, NULL, NULL)
, ('92490f70-5aac-4669-b488-010f006b29f8'::uuid, 2346408, 'Lilakáposzta, nyers', 'vegetables', 'Foundation', 'Cabbage, red, raw', '2026-04-30', 29.9, 1.24, 6.79, 0.214, NULL, NULL, NULL)
, ('fa6dc6d0-b54a-432b-9694-7c25287fed9e'::uuid, 2685573, 'Karfiol, nyers', 'vegetables', 'Foundation', 'Cauliflower, raw', '2026-04-30', 22.9, 1.64, 4.72, 0.238, 1.95, NULL, NULL)
, ('6d80c0de-e5bc-474a-808d-f0c684f6d357'::uuid, 2685577, 'Padlizsán, nyers', 'vegetables', 'Foundation', 'Eggplant, raw', '2026-04-30', 22.4, 0.852, 5.40, 0.120, 2.45, 2.35, NULL)
, ('a8209fd4-5568-4129-8dcc-63c771eea4fa'::uuid, 168421, 'Fodros kel, nyers', 'vegetables', 'SR Legacy', 'Kale, raw', '2018-04', 35.0, 2.92, 4.42, 1.49, 4.10, 0.990, 0.178)
, ('4555085e-c66d-43ff-a141-69727c83a72b'::uuid, 169246, 'Póréhagyma, nyers', 'vegetables', 'SR Legacy', 'Leeks, (bulb and lower leaf-portion), raw', '2018-04', 61.0, 1.50, 14.2, 0.300, 1.80, 3.90, 0.040)
, ('c26e0a6a-3fa5-48c2-855a-11130e22c6c8'::uuid, 2346388, 'Jégsaláta, nyers', 'vegetables', 'Foundation', 'Lettuce, iceberg, raw', '2026-04-30', 14.5, 0.742, 3.37, 0.074, NULL, NULL, NULL)
, ('4b10d35d-4ef0-4721-b8fb-9e8c626c85a0'::uuid, 2346389, 'Római saláta, nyers', 'vegetables', 'Foundation', 'Lettuce, romaine, green, raw', '2026-04-30', 17.5, 0.977, 4.06, 0.071, NULL, NULL, NULL)
, ('9feee219-b897-45d2-a3cc-43c10576d519'::uuid, 2346391, 'Zöld leveles saláta, nyers', 'vegetables', 'Foundation', 'Lettuce, leaf, green, raw', '2026-04-30', 18.5, 1.09, 4.07, 0.156, NULL, NULL, NULL)
, ('0cec05ae-846a-44ad-bd51-ea6d0a0cc8bb'::uuid, 2685568, 'Cukkini, nyers', 'vegetables', 'Foundation', 'Squash, summer, green, zucchini, includes skin, raw', '2026-04-30', 16.0, 0.984, 3.27, 0.205, 0.752, NULL, NULL)
, ('76d34919-c694-4cc4-98cf-93f75819d673'::uuid, 2685570, 'Sonkatök, nyers', 'vegetables', 'Foundation', 'Squash, winter, butternut, raw', '2026-04-30', 41.7, 1.15, 10.5, 0.168, 1.96, NULL, NULL)
, ('ddae0133-9d1b-4869-bde9-4dbf0a0ba9bb'::uuid, 168448, 'Sütőtök, nyers', 'vegetables', 'SR Legacy', 'Pumpkin, raw', '2018-04', 26.0, 1.00, 6.50, 0.100, 0.500, 2.76, 0.052)
, ('78b5e867-3f2f-4823-a0e0-d1933ef597c6'::uuid, 170427, 'Zöld kaliforniai paprika, nyers', 'vegetables', 'SR Legacy', 'Peppers, sweet, green, raw', '2018-04', 20.0, 0.860, 4.64, 0.170, 1.70, 2.40, 0.058)
, ('2dd86927-d69b-45b1-aaeb-c23b53a3dcfb'::uuid, 170108, 'Piros kaliforniai paprika, nyers', 'vegetables', 'SR Legacy', 'Peppers, sweet, red, raw', '2018-04', 26.0, 0.990, 6.03, 0.300, 2.10, 4.20, 0.059)
, ('339db201-575e-4ad7-a035-270a86fbba06'::uuid, 169383, 'Sárga kaliforniai paprika, nyers', 'vegetables', 'SR Legacy', 'Peppers, sweet, yellow, raw', '2018-04', 27.0, 1.00, 6.32, 0.210, 0.900, NULL, 0.031)
, ('08dfaa95-ded5-41f1-87ee-ecca80abf31f'::uuid, 169276, 'Retek, nyers', 'vegetables', 'SR Legacy', 'Radishes, raw', '2018-04', 16.0, 0.680, 3.40, 0.100, 1.60, 1.86, 0.032)
, ('fbcc402e-58c6-4614-bb0d-e8cf8d1d9ea6'::uuid, 170417, 'Paszternák, nyers', 'vegetables', 'SR Legacy', 'Parsnips, raw', '2018-04', 75.0, 1.20, 18.0, 0.300, 4.90, 4.80, 0.050)
, ('f87153aa-8825-46d5-bb64-f9d4f85f5635'::uuid, 170457, 'Paradicsom, nyers', 'vegetables', 'SR Legacy', 'Tomatoes, red, ripe, raw, year round average', '2018-04', 18.0, 0.880, 3.89, 0.200, 1.20, 2.63, 0.028)
, ('cae82860-30ea-4358-83b6-821534afad19'::uuid, 2747655, 'Édeskömény, nyers', 'vegetables', 'Foundation', 'Fennel, bulb, raw', '2026-04-30', 26.9, 0.922, 5.49, 0.140, 2.05, 3.20, NULL)
, ('ce637b46-3ad6-4755-b24b-cf214451a156'::uuid, 168424, 'Karalábé, nyers', 'vegetables', 'SR Legacy', 'Kohlrabi, raw', '2018-04', 27.0, 1.70, 6.20, 0.100, 3.60, 2.60, 0.013)
, ('0891ecbf-ae06-420d-a443-d14526adf977'::uuid, 170400, 'Zellergumó, nyers', 'vegetables', 'SR Legacy', 'Celeriac, raw', '2018-04', 42.0, 1.50, 9.20, 0.300, 1.80, 1.60, 0.079)
, ('6b48bacc-a0b1-44d8-85cf-cda698825901'::uuid, 169118, 'Körte, nyers', 'fruits', 'SR Legacy', 'Pears, raw', '2018-04', 57.0, 0.360, 15.2, 0.140, 3.10, 9.75, 0.022)
, ('a928695f-91e6-4177-8404-6be51b2c2658'::uuid, 174683, 'Szőlő, nyers', 'fruits', 'SR Legacy', 'Grapes, red or green (European type, such as Thompson seedless), raw', '2018-04', 69.0, 0.720, 18.1, 0.160, 0.900, 15.5, 0.054)
, ('31cd6ffc-5703-440b-80e0-0f181693e872'::uuid, 173033, 'Grapefruit, nyers', 'fruits', 'SR Legacy', 'Grapefruit, raw, pink and red and white, all areas', '2018-04', 32.0, 0.630, 8.08, 0.100, 1.10, 6.98, 0.014)
, ('ed439a6d-0ba1-4a2c-ac52-f561cba5aa79'::uuid, 167746, 'Citrom, nyers', 'fruits', 'SR Legacy', 'Lemons, raw, without peel', '2018-04', 29.0, 1.10, 9.32, 0.300, 2.80, 2.50, 0.039)
, ('aa61d9d8-7aea-43e7-b87e-774d61d396c7'::uuid, 168155, 'Zöldcitrom, nyers', 'fruits', 'SR Legacy', 'Limes, raw', '2018-04', 30.0, 0.700, 10.5, 0.200, 2.80, 1.69, 0.022)
, ('81852010-1c26-427c-a558-b9ca22f4ea8b'::uuid, 167765, 'Görögdinnye, nyers', 'fruits', 'SR Legacy', 'Watermelon, raw', '2018-04', 30.0, 0.610, 7.55, 0.150, 0.400, 6.20, 0.016)
, ('7412c6fc-41be-42c9-970a-698b20f0eccc'::uuid, 169092, 'Sárgadinnye, nyers', 'fruits', 'SR Legacy', 'Melons, cantaloupe, raw', '2018-04', 34.0, 0.840, 8.16, 0.190, 0.900, 7.86, 0.051)
, ('8b7fdab0-855d-4c3e-ba47-2cf34da77c52'::uuid, 169949, 'Szilva, nyers', 'fruits', 'SR Legacy', 'Plums, raw', '2018-04', 46.0, 0.700, 11.4, 0.280, 1.40, 9.92, 0.017)
, ('3f958d4c-7f64-4369-b0a5-8fba05cf2718'::uuid, 2710815, 'Sárgabarack, nyers', 'fruits', 'Foundation', 'Apricot, with skin, raw', '2026-04-30', 43.5, 0.961, 10.2, 0.405, 1.51, 6.25, NULL)
, ('adc94c5a-c867-4f49-b8d1-0e0d4aa4d941'::uuid, 169134, 'Gránátalma, nyers', 'fruits', 'SR Legacy', 'Pomegranates, raw', '2018-04', 83.0, 1.67, 18.7, 1.17, 4.00, 13.7, 0.120)
, ('3e5a251c-3c7f-476b-b760-908571841e67'::uuid, 171722, 'Tőzegáfonya, nyers', 'fruits', 'SR Legacy', 'Cranberries, raw', '2018-04', 46.0, 0.460, 12.0, 0.130, 3.60, 4.27, 0.008)
, ('8ec3fd2f-c8a0-47b4-a291-696723ba47b4'::uuid, 173946, 'Szeder, nyers', 'fruits', 'SR Legacy', 'Blackberries, raw', '2018-04', 43.0, 1.39, 9.61, 0.490, 5.30, 4.88, 0.014)
, ('58737c96-2435-4e98-8dbe-7a92ea71085d'::uuid, 173963, 'Fekete ribizli, nyers', 'fruits', 'SR Legacy', 'Currants, european black, raw', '2018-04', 63.0, 1.40, 15.4, 0.410, NULL, NULL, 0.034)
, ('d3ce1118-f698-4d4b-b671-0e776bef08bb'::uuid, 171719, 'Cseresznye, nyers', 'fruits', 'SR Legacy', 'Cherries, sweet, raw', '2018-04', 63.0, 1.06, 16.0, 0.200, 2.10, 12.8, 0.038)
, ('9056c8d3-bc2f-4138-b6b4-e6431b1d374c'::uuid, 167762, 'Eper, nyers', 'fruits', 'SR Legacy', 'Strawberries, raw', '2018-04', 32.0, 0.670, 7.68, 0.300, 2.00, 4.89, 0.015)
, ('8cc2d636-8ffc-4f45-9c87-f8b43a20b36d'::uuid, 171711, 'Áfonya, nyers', 'fruits', 'SR Legacy', 'Blueberries, raw', '2018-04', 57.0, 0.740, 14.5, 0.330, 2.40, 9.96, 0.028)
, ('32353de8-79be-479c-936f-39cbac25652f'::uuid, 173021, 'Füge, nyers', 'fruits', 'SR Legacy', 'Figs, raw', '2018-04', 74.0, 0.750, 19.2, 0.300, 2.90, 16.3, 0.060)
, ('86df6039-61f3-4875-a586-8b35338a0b1e'::uuid, 169914, 'Nektarin, nyers', 'fruits', 'SR Legacy', 'Nectarines, raw', '2018-04', 44.0, 1.06, 10.6, 0.320, 1.70, 7.89, 0.025)
, ('cc5eedcf-d1a4-4527-b8f4-64a3c83fd2aa'::uuid, 169941, 'Datolyaszilva, nyers', 'fruits', 'SR Legacy', 'Persimmons, japanese, raw', '2018-04', 70.0, 0.580, 18.6, 0.190, 3.60, 12.5, 0.020)
, ('db70bfd3-ceeb-4702-8524-5f39079f8f1f'::uuid, 2710832, 'Mandarin, nyers', 'fruits', 'Foundation', 'Mandarin, seedless, peeled, raw', '2026-04-30', 55.6, 1.04, 13.4, 0.458, 1.33, 9.12, NULL)
, ('72e1eb41-3290-4857-83b5-0396e296169e'::uuid, 2646171, 'Csirkecombfilé, nyers', 'meat', 'Foundation', 'Chicken, thigh, boneless, skinless, raw', '2026-04-30', 149, 18.6, 0.000, 7.92, NULL, NULL, 1.66)
, ('b25875a7-6cc5-4843-a761-6aa888cf6769'::uuid, 172388, 'Csirkecombfilé, sült', 'meat', 'SR Legacy', 'Chicken, broilers or fryers, thigh, meat only, cooked, roasted', '2018-04', 179, 24.8, 0.000, 8.15, 0.000, 0.000, 2.31)
, ('274ec4b6-3a3b-47f1-872b-19c1a80b61a3'::uuid, 172373, 'Csirke alsócomb bőrrel, nyers', 'meat', 'SR Legacy', 'Chicken, broilers or fryers, drumstick, meat and skin, raw', '2018-04', 161, 18.1, 0.110, 9.20, 0.000, 0.000, 2.46)
, ('ab00f04e-af1a-4bd2-9ce0-c47dc6b3e4fd'::uuid, 173612, 'Csirke alsócomb bőrrel, sült', 'meat', 'SR Legacy', 'Chicken, broilers or fryers, drumstick, meat and skin, cooked, roasted', '2018-04', 191, 23.4, 0.000, 10.2, 0.000, 0.000, 2.74)
, ('5094f9c4-0d98-4da2-a3ed-5f7aa6b9c7a4'::uuid, 171093, 'Pulykamell bőrrel, nyers', 'meat', 'SR Legacy', 'Turkey, all classes, breast, meat and skin, raw', '2018-04', 157, 21.9, 0.000, 7.02, 0.000, NULL, 1.91)
, ('0ea9ae6c-9de2-488d-afb3-caf462fc64b1'::uuid, 171492, 'Pulykamell bőrrel, sült', 'meat', 'SR Legacy', 'Turkey, all classes, breast, meat and skin, cooked, roasted', '2018-04', 189, 28.7, 0.000, 7.41, 0.000, NULL, 2.10)
, ('3ab82803-3149-4d19-acaf-a78c8b146cdf'::uuid, 171531, 'Pulykacomb bőr nélkül, nyers', 'meat', 'SR Legacy', 'Turkey, thigh, from whole bird, meat only, raw', '2018-04', 108, 21.3, 0.150, 2.50, 0.000, 0.100, 0.683)
, ('50624df0-a668-4c2c-b0f3-3a2b3d7061b7'::uuid, 171532, 'Pulykacomb bőr nélkül, sült', 'meat', 'SR Legacy', 'Turkey, thigh, from whole bird, meat only, roasted', '2018-04', 165, 27.7, 0.000, 6.04, 0.000, 0.000, 1.81)
, ('7b5481b5-0331-4e93-8094-d1c88ddfabe2'::uuid, 172410, 'Kacsahús bőr nélkül, nyers', 'meat', 'SR Legacy', 'Duck, domesticated, meat only, raw', '2018-04', 135, 18.3, 0.940, 5.95, 0.000, 0.000, 2.32)
, ('73c4c93e-d36a-4911-81f9-df1e3e566894'::uuid, 172411, 'Kacsahús bőr nélkül, sült', 'meat', 'SR Legacy', 'Duck, domesticated, meat only, cooked, roasted', '2018-04', 201, 23.5, 0.000, 11.2, 0.000, 0.000, 3.95)
, ('a5f4dc2d-a8fa-44fd-82d1-f5d8e75aa043'::uuid, 171765, 'Marhabélszín, nyers', 'meat', 'SR Legacy', 'Beef, loin, tenderloin roast, boneless, separable lean only, trimmed to 0" fat, all grades, raw', '2018-04', 139, 21.9, 0.000, 5.74, 0.000, 0.000, 1.96)
, ('38f77fb9-235d-4dc3-8a72-697467e7c295'::uuid, 174004, 'Marhabélszín, sült', 'meat', 'SR Legacy', 'Beef, loin, tenderloin roast, boneless, separable lean only, trimmed to 0" fat, all grades, cooked, roasted', '2018-04', 177, 27.5, 0.000, 7.49, 0.000, 0.000, 2.99)
, ('72e84684-8398-4a47-b594-cf93dc8bc5b7'::uuid, 171760, 'Marhafelsál, nyers', 'meat', 'SR Legacy', 'Beef, round, top round roast, boneless, separable lean only, trimmed to 0" fat, all grades, raw', '2018-04', 121, 23.6, 0.000, 2.94, 0.000, 0.000, 1.12)
, ('5bd18c1c-5748-4517-bf86-72c7a0df14a7'::uuid, 174007, 'Marhafelsál, sült', 'meat', 'SR Legacy', 'Beef, round, top round roast, boneless, separable lean only, trimmed to 0" fat, all grades, cooked, roasted', '2018-04', 162, 30.1, 0.000, 3.77, 0.000, 0.000, 1.38)
, ('71d56c48-d0ca-4e6c-895d-9a5eaff35c36'::uuid, 168230, 'Sertéskaraj sovány, nyers', 'meat', 'SR Legacy', 'Pork, fresh, loin, whole, separable lean only, raw', '2018-04', 143, 21.4, 0.000, 5.66, 0.000, 0.000, 1.95)
, ('092a0bef-4880-4c5b-8889-d82a5b40f967'::uuid, 168233, 'Sertéskaraj sovány, sült', 'meat', 'SR Legacy', 'Pork, fresh, loin, whole, separable lean only, cooked, roasted', '2018-04', 209, 28.6, 0.000, 9.63, 0.000, 0.000, 3.51)
, ('f7e75e08-3d55-48b2-9758-8f359ba54447'::uuid, 168249, 'Sertésszűz, nyers', 'meat', 'SR Legacy', 'Pork, fresh, loin, tenderloin, separable lean only, raw', '2018-04', 109, 21.0, 0.000, 2.17, 0.000, 0.000, 0.698)
, ('c92e9f4a-2017-444a-b4b3-ee0ba2ac2dc8'::uuid, 168250, 'Sertésszűz, sült', 'meat', 'SR Legacy', 'Pork, fresh, loin, tenderloin, separable lean only, cooked, roasted', '2018-04', 143, 26.2, 0.000, 3.51, 0.000, 0.000, 1.20)
, ('2a4a2a40-34e3-4ab0-af74-9a833be03142'::uuid, 174313, 'Báránycomb sovány, nyers', 'meat', 'SR Legacy', 'Lamb, leg, whole (shank and sirloin), separable lean only, trimmed to 1/4" fat, choice, raw', '2018-04', 128, 20.6, 0.000, 4.51, 0.000, NULL, 1.61)
, ('82141c64-d7e9-4afc-b7db-5c5c1d0cc6ea'::uuid, 174314, 'Báránycomb sovány, sült', 'meat', 'SR Legacy', 'Lamb, leg, whole (shank and sirloin), separable lean only, trimmed to 1/4" fat, choice, cooked, roasted', '2018-04', 191, 28.3, 0.000, 7.74, 0.000, 0.000, 2.76)
, ('d5c7d74d-4c43-4b04-ad3a-bb7dbb5bb4aa'::uuid, 171955, 'Atlanti tőkehal, nyers', 'fish', 'SR Legacy', 'Fish, cod, Atlantic, raw', '2018-04', 82.0, 17.8, 0.000, 0.670, 0.000, 0.000, 0.131)
, ('bb4e7bda-fd8d-409d-b9af-159d1254b6bf'::uuid, 171956, 'Atlanti tőkehal, sült', 'fish', 'SR Legacy', 'Fish, cod, Atlantic, cooked, dry heat', '2018-04', 105, 22.8, 0.000, 0.860, 0.000, 0.000, 0.168)
, ('1054e3aa-3462-4b21-896a-616f595af767'::uuid, 175167, 'Atlanti lazac, tenyésztett, nyers', 'fish', 'SR Legacy', 'Fish, salmon, Atlantic, farmed, raw', '2018-04', 208, 20.4, 0.000, 13.4, 0.000, 0.000, 3.05)
, ('4840b731-1924-47c5-a850-74969245571f'::uuid, 175168, 'Atlanti lazac, tenyésztett, sült', 'fish', 'SR Legacy', 'Fish, salmon, Atlantic, farmed, cooked, dry heat', '2018-04', 206, 22.1, 0.000, 12.4, 0.000, 0.000, 2.40)
, ('000b77ac-3179-4c97-964b-431fed1cc5d5'::uuid, 175176, 'Tilápia, nyers', 'fish', 'SR Legacy', 'Fish, tilapia, raw', '2018-04', 96.0, 20.1, 0.000, 1.70, 0.000, 0.000, 0.585)
, ('b904005e-3491-46fb-a76a-65e42779adf4'::uuid, 175177, 'Tilápia, sült', 'fish', 'SR Legacy', 'Fish, tilapia, cooked, dry heat', '2018-04', 128, 26.2, 0.000, 2.65, 0.000, 0.000, 0.940)
, ('5fa8a4b6-3b7b-4989-a1ec-b9284306bcef'::uuid, 173717, 'Szivárványos pisztráng, tenyésztett, nyers', 'fish', 'SR Legacy', 'Fish, trout, rainbow, farmed, raw', '2018-04', 141, 19.9, 0.000, 6.18, 0.000, 0.000, 1.38)
, ('12c198e4-10dc-4000-8046-22b68400dd5d'::uuid, 173718, 'Szivárványos pisztráng, tenyésztett, sült', 'fish', 'SR Legacy', 'Fish, trout, rainbow, farmed, cooked, dry heat', '2018-04', 168, 23.8, 0.000, 7.38, 0.000, 0.000, 1.65)
, ('e4f0929f-6ca4-4fbc-8648-a69ac3147ee0'::uuid, 175119, 'Atlanti makréla, nyers', 'fish', 'SR Legacy', 'Fish, mackerel, Atlantic, raw', '2018-04', 205, 18.6, 0.000, 13.9, 0.000, 0.000, 3.26)
, ('7e0b65f7-3fcd-4dd8-8275-894a4034d9c2'::uuid, 175120, 'Atlanti makréla, sült', 'fish', 'SR Legacy', 'Fish, mackerel, Atlantic, cooked, dry heat', '2018-04', 262, 23.8, 0.000, 17.8, 0.000, NULL, 4.18)
, ('a615db0d-5d09-41b1-93b9-e2582dae93c1'::uuid, 173424, 'Tojás, keményre főtt', 'eggs', 'SR Legacy', 'Egg, whole, cooked, hard-boiled', '2018-04', 155, 12.6, 1.12, 10.6, 0.000, 1.12, 3.27)
, ('44809f2f-a0b9-4765-ad0a-4af6998b75a8'::uuid, 172183, 'Tojásfehérje, nyers', 'eggs', 'SR Legacy', 'Egg, white, raw, fresh', '2018-04', 52.0, 10.9, 0.730, 0.170, 0.000, 0.710, 0.000)
, ('b31c1a36-3bbe-4c9e-8223-261b1e0873d6'::uuid, 172184, 'Tojássárgája, nyers', 'eggs', 'SR Legacy', 'Egg, yolk, raw, fresh', '2018-04', 322, 15.9, 3.59, 26.5, 0.000, 0.560, 9.55)
, ('2d545760-ea6b-467e-855f-fb6b98d4eeee'::uuid, 173756, 'Csicseriborsó, száraz', 'legumes', 'SR Legacy', 'Chickpeas (garbanzo beans, bengal gram), mature seeds, raw', '2018-04', 378, 20.5, 63.0, 6.04, 12.2, 10.7, 0.603)
, ('664de190-844a-4ab9-8300-2241c3974585'::uuid, 173757, 'Csicseriborsó, főtt', 'legumes', 'SR Legacy', 'Chickpeas (garbanzo beans, bengal gram), mature seeds, cooked, boiled, without salt', '2018-04', 164, 8.86, 27.4, 2.59, 7.60, 4.80, 0.269)
, ('c57659e8-86f9-45fa-85e3-c3a04f6a6c86'::uuid, 174252, 'Limabab, száraz', 'legumes', 'SR Legacy', 'Lima beans, large, mature seeds, raw', '2018-04', 338, 21.5, 63.4, 0.690, 19.0, 8.50, 0.161)
, ('d5d24cb2-0907-4ed3-a93a-eb506004f16d'::uuid, 174253, 'Limabab, főtt', 'legumes', 'SR Legacy', 'Lima beans, large, mature seeds, cooked, boiled, without salt', '2018-04', 115, 7.80, 20.9, 0.380, 7.00, 2.90, 0.089)
, ('2c0047c1-b986-40e3-9c3d-c39c1dcd4507'::uuid, 174256, 'Mungóbab, száraz', 'legumes', 'SR Legacy', 'Mung beans, mature seeds, raw', '2018-04', 347, 23.9, 62.6, 1.15, 16.3, 6.60, 0.348)
, ('ea6a8d41-f2ce-4c86-8876-84adaf45f91c'::uuid, 174257, 'Mungóbab, főtt', 'legumes', 'SR Legacy', 'Mung beans, mature seeds, cooked, boiled, without salt', '2018-04', 105, 7.02, 19.2, 0.380, 7.60, 2.00, 0.116)
, ('3cba2292-e90f-4de8-a025-5ad37a06102a'::uuid, 175199, 'Pintóbab, száraz', 'legumes', 'SR Legacy', 'Beans, pinto, mature seeds, raw (Includes foods for USDA''s Food Distribution Program)', '2018-04', 347, 21.4, 62.6, 1.23, 15.5, 2.11, 0.235)
, ('850574e1-d4d3-4aa4-9ea1-83ecd8215e9c'::uuid, 175200, 'Pintóbab, főtt', 'legumes', 'SR Legacy', 'Beans, pinto, mature seeds, cooked, boiled, without salt', '2018-04', 143, 9.01, 26.2, 0.650, 9.00, 0.340, 0.136)
, ('ad32374a-e4f4-4bf5-b56a-b3c767975288'::uuid, 173758, 'Feketeszemű bab, száraz', 'legumes', 'SR Legacy', 'Cowpeas, common (blackeyes, crowder, southern), mature seeds, raw', '2018-04', 336, 23.5, 60.0, 1.26, 10.6, 6.90, 0.331)
, ('2cb9b7ec-fc49-4cd4-a3e5-11f5d6068ff6'::uuid, 173759, 'Feketeszemű bab, főtt', 'legumes', 'SR Legacy', 'Cowpeas, common (blackeyes, crowder, southern), mature seeds, cooked, boiled, without salt', '2018-04', 116, 7.73, 20.8, 0.530, 6.50, 3.30, 0.138)
, ('cf818913-85d1-4b5a-87eb-96356134bcd3'::uuid, 169703, 'Barna rizs, száraz', 'grains', 'SR Legacy', 'Rice, brown, long-grain, raw (Includes foods for USDA''s Food Distribution Program)', '2018-04', 367, 7.54, 76.2, 3.20, 3.60, 0.660, 0.591)
, ('47f4ac7a-ab3a-4f3c-b078-eaa16a99ec72'::uuid, 169704, 'Barna rizs, főtt', 'grains', 'SR Legacy', 'Rice, brown, long-grain, cooked (Includes foods for USDA''s Food Distribution Program)', '2018-04', 123, 2.74, 25.6, 0.970, 1.60, 0.240, 0.260)
, ('f09ae260-2cfd-4858-b417-be145efecb86'::uuid, 168874, 'Quinoa, száraz', 'grains', 'SR Legacy', 'Quinoa, uncooked', '2018-04', 368, 14.1, 64.2, 6.07, 7.00, NULL, 0.706)
, ('76ab020a-def1-40b5-9aaf-3f6ec9f02c2f'::uuid, 168917, 'Quinoa, főtt', 'grains', 'SR Legacy', 'Quinoa, cooked', '2018-04', 120, 4.40, 21.3, 1.92, 2.80, 0.870, 0.231)
, ('2a6b747e-e698-4c78-8910-58703a38a075'::uuid, 170685, 'Hajdina, száraz', 'grains', 'SR Legacy', 'Buckwheat groats, roasted, dry', '2018-04', 346, 11.7, 75.0, 2.71, 10.3, NULL, 0.591)
, ('eab85c6d-5c3f-4baf-95ad-997e047aea93'::uuid, 170686, 'Hajdina, főtt', 'grains', 'SR Legacy', 'Buckwheat groats, roasted, cooked', '2018-04', 92.0, 3.38, 19.9, 0.620, 2.70, 0.900, 0.134)
, ('7918d2fb-cebd-40b3-9a93-eec3d202c871'::uuid, 170284, 'Árpagyöngy, száraz', 'grains', 'SR Legacy', 'Barley, pearled, raw', '2018-04', 352, 9.91, 77.7, 1.16, 15.6, 0.800, 0.244)
, ('71a331a2-29eb-4779-af7c-53c39be14fc8'::uuid, 170285, 'Árpagyöngy, főtt', 'grains', 'SR Legacy', 'Barley, pearled, cooked', '2018-04', 123, 2.26, 28.2, 0.440, 3.80, 0.280, 0.093)
, ('d4b41144-e3f8-4807-8194-925517f1d56c'::uuid, 169702, 'Köles, száraz', 'grains', 'SR Legacy', 'Millet, raw', '2018-04', 378, 11.0, 72.8, 4.22, 8.50, NULL, 0.723)
, ('74483316-1794-4241-80d9-7a938fc01aa3'::uuid, 168871, 'Köles, főtt', 'grains', 'SR Legacy', 'Millet, cooked', '2018-04', 119, 3.51, 23.7, 1.00, 1.30, 0.130, 0.172)
, ('f2a33f46-849e-4874-bb10-914dd457a535'::uuid, 169699, 'Kuszkusz, száraz', 'grains', 'SR Legacy', 'Couscous, dry', '2018-04', 376, 12.8, 77.4, 0.640, 5.00, NULL, 0.117)
, ('3beb1b8d-e624-42da-aca1-14e84601f557'::uuid, 169700, 'Kuszkusz, főtt', 'grains', 'SR Legacy', 'Couscous, cooked', '2018-04', 112, 3.79, 23.2, 0.160, 1.40, 0.100, 0.029)
;

DO $catalog_guard$
DECLARE
  catalog_count integer;
  id_collisions integer;
  name_collisions integer;
BEGIN
  SELECT count(*) INTO catalog_count FROM staple_catalog;
  IF catalog_count <> 99 THEN
    RAISE EXCEPTION 'Expected 99 catalog rows, found %', catalog_count;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM staple_catalog
     WHERE category NOT IN ('vegetables', 'fruits', 'meat', 'fish', 'eggs', 'legumes', 'grains')
        OR kcal < 0 OR protein_g < 0 OR carbs_g < 0 OR fat_g < 0
        OR coalesce(fiber_g, 0) < 0
        OR coalesce(sugar_g, 0) < 0
        OR coalesce(saturated_fat_g, 0) < 0
  ) THEN
    RAISE EXCEPTION 'Catalog contains an invalid category or negative nutrition value';
  END IF;

  SELECT count(*) INTO id_collisions
    FROM staple_catalog c
    JOIN pantry_item p ON p.id = c.id;
  IF id_collisions <> 0 THEN
    RAISE EXCEPTION 'Catalog UUID collision count: %', id_collisions;
  END IF;

  SELECT count(*) INTO name_collisions
    FROM staple_catalog c
    JOIN pantry_item p ON lower(btrim(p.name)) = lower(btrim(c.name));
  IF name_collisions <> 0 THEN
    RAISE EXCEPTION 'Catalog name collision count: %', name_collisions;
  END IF;
END
$catalog_guard$;

DO $insert_rows$
DECLARE
  affected_count integer;
BEGIN
  INSERT INTO pantry_item (
    id, created_by, is_deleted, kind, name, brand, source, category, notes,
    serving_amount, serving_unit, kcal, protein_g, carbs_g, fat_g,
    fiber_g, sugar_g, saturated_fat_g, salt_g, nova, taken
  )
  SELECT c.id,
         o.created_by,
         false,
         'food',
         c.name,
         NULL,
         'web',
         c.category,
         format(
           'USDA FoodData Central | FDC ID %s | %s | "%s" | release %s',
           c.fdc_id, c.data_type, c.source_description, c.release_date
         ),
         100,
         'g',
         c.kcal,
         c.protein_g,
         c.carbs_g,
         c.fat_g,
         c.fiber_g,
         c.sugar_g,
         c.saturated_fat_g,
         NULL,
         1,
         false
    FROM staple_catalog c
    CROSS JOIN (
      SELECT (array_agg(DISTINCT created_by))[1] AS created_by
        FROM pantry_item
       WHERE NOT is_deleted
    ) o;

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  IF affected_count <> 99 THEN
    RAISE EXCEPTION 'Expected to insert 99 rows, inserted %', affected_count;
  END IF;
END
$insert_rows$;

DO $post_guard$
DECLARE
  matched_count integer;
BEGIN
  SELECT count(*) INTO matched_count
    FROM staple_catalog c
    JOIN pantry_item p ON p.id = c.id
   WHERE NOT p.is_deleted
     AND p.kind = 'food'
     AND p.source = 'web'
     AND p.serving_amount = 100
     AND p.serving_unit = 'g'
     AND p.nova = 1;

  IF matched_count <> 99 THEN
    RAISE EXCEPTION 'Only % of 99 inserted rows passed post-insert validation', matched_count;
  END IF;
END
$post_guard$;

SELECT c.category, count(*) AS inserted_count
  FROM pantry_item p
  JOIN staple_catalog c USING (id)
 GROUP BY c.category
 ORDER BY c.category;

COMMIT;
