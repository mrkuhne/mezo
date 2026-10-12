// Fuel · the words of the shared label maps and sentence builders in `features/fuel/logic` (+ `sheets/learnedBaseFormat.ts`) that
// several areas read (Folyadék F5, mezo-n4wf5.5). Read at CALL time with `m().fuelLogika…` — never from a module constant.
// Owned by the foundation; an area builder reports a missing word instead of editing this file.
export const fuelLogikaHu = {
  // the four meal blocks — a planned window's name (`buildDayPlan.placeWindows`) and a recipe's category (`recipeSlotFace`)
  slot: { breakfast: 'Reggeli', lunch: 'Ebéd', snack: 'Uzsonna', dinner: 'Vacsora' },
  // logic/mealSkips.ts — the reason chips and the reason line of a skipped meal
  mealSkips: {
    reasons: {
      NOT_HUNGRY: 'Nem vagyok éhes',
      NO_TIME: 'Nincs időm',
      STOMACH: 'Gyomorrontás',
      ILLNESS: 'Beteg vagyok',
      TRAVEL: 'Úton vagyok',
      OTHER: 'Egyéb',
    },
    noReason: 'ok nélkül',
    quoted: (text: string) => `„${text}”`,
  },
  // logic/mealWindow.ts — durations, the hit word and the „Miért ekkor?” reasons
  mealWindow: {
    durHM: (h: number, min: number) => `${h} ó ${min} p`,
    durH: (h: number) => `${h} ó`,
    durM: (min: number) => `${min} p`,
    inWindow: 'Az ablakban',
    later: (dur: string) => `+${dur} később`,
    earlier: (dur: string) => `−${dur} korábban`,
    reason: {
      afterWake: {
        title: (wake: string) => `Ébredés (${wake}) után nem sokkal`,
        body: 'Az éjszakai böjt után itt töltöd fel a raktárakat.',
      },
      proteinStart: {
        title: 'A nap első fehérjeadagja',
        body: 'Ez indítja a napi fehérje-sort, nagyjából 3–4 órás lépésközzel.',
      },
      proteinSpacing: {
        title: 'Nagyjából 3–4 órára az előzőtől',
        body: 'A fehérje egyenletes elosztása segíti az izomépítést, és kordában tartja az éhséget.',
      },
      bridge: {
        title: 'Két fő étkezés között',
        body: 'Áthidalja a hosszabb szünetet, így nem esel be éhesen a következő étkezésbe.',
      },
      preTrainingMain: {
        title: (start: string | null) => `Néhány órával az edzés${start ? ` (${start})` : ''} előtt`,
        body: 'Itt jön a nap fő szénhidrátos étkezése: tele raktárral indulsz, és addigra meg is emészted.',
      },
      preTrainingSnack: {
        title: (start: string | null) => `45–90 perccel az edzés${start ? ` (${start})` : ''} előtt`,
        body: 'Könnyű, gyorsan hasznosuló szénhidrát: ne üres gyomorral, de ne is tele hassal edzz.',
      },
      postTraining: {
        title: (end: string | null) => `Az edzés${end ? ` (${end})` : ''} után fél–másfél órával`,
        body: 'Fehérje és szénhidrát segíti a regenerációt és a raktárak visszatöltését.',
      },
      beforeBed: {
        title: (bed: string) => `Lefekvés (${bed}) előtt legalább 2,5 órával`,
        body: 'Késő este ugyanaz az étel általában nagyobb vércukor-emelkedést okoz, és ronthatja az alvást.',
      },
      templateFixed: {
        title: 'A saját napi sablonod szerint',
        body: 'Ezt az időpontot a napi sablonodban rögzítetted.',
      },
      shifted: {
        // `meal` = the earlier meal's name in lower case, with its article in Hungarian (`az ebéd`), bare in English (`lunch`)
        titleAfter: (meal: string, at: string) => `Eltolva: ${meal} később volt (${at})`,
        title: 'Eltolva az előző ablak után',
        body: 'Így nagyjából másfél óra jut a két étkezés közé; a nap többi ablaka ehhez igazodik.',
      },
    },
  },
  // logic/buildDayPlan.ts — the snack windows beyond „Uzsonna” (`slot.snack`), and a supplement slot's name
  dayPlan: {
    window: {
      morningSnack: 'Tízórai',
      eveningSnack: 'Esti uzsonna',
      preWorkoutSnack: 'Edzés előtti uzsonna',
    },
    // behaviour change 1 (owner 2026-10-12): a meal logged outside every window — the block's title on Mai (step 3b)
    // and the bare name the meal page / Mezo's rating print (they add the time themselves, once)
    betweenMeals: 'Ablakon kívül',
    betweenMealsAt: (time: string) => `Ablakon kívül · ${time}`,
    // a supplement time on the day's line, and the title of its reminder (data/notification/notificationScheduleWriter)
    stack: (zone: string) => `Kiegészítők · ${zone}`,
  },
  // logic/keretHero.ts — the meal's role word and the rows of the day's equation
  keretHero: {
    role: { pre: 'EDZÉS ELŐTTI', post: 'EDZÉS UTÁNI', standard: 'STANDARD' },
    equation: { base: 'Alap', activity: 'Mozgás', goal: 'Célod', eaten: 'Étel', remaining: 'Marad' },
  },
  // logic/glycemicBand.ts — the blood sugar response: what to expect, the tip for now, the swaps for next time
  glycemic: {
    expect: {
      low: {
        energy: 'Egyenletes energia 3–4 órára',
        back: 'Kb. 2 óra múlva ér vissza az alapszintre, finoman',
        hunger: 'Az éhség későn, fokozatosan tér vissza',
      },
      mid: {
        energy: 'Stabil energia 2–3 órára',
        back: 'Kb. 2 óra múlva újra alapszinten',
        hunger: 'Az éhség 2–3 óra múlva jelentkezik',
      },
      high: {
        energy: 'Gyors löket, majd visszaesés',
        back: 'Kb. 1,5 óra múlva zuhan, az alapszint alá is eshet',
        hunger: 'A visszaesés után korán, akár 1–1,5 óra múlva újra megéhezhetsz',
      },
    },
    tip: {
      balance: {
        title: 'Szép egyensúly',
        body: 'A fehérje és a rost lassan engedi fel a vércukrot: ez a tányér magától simít.',
      },
      dress: {
        title: 'Öltöztesd fel a szénhidrátot',
        body: 'Az édes rész magában gyorsan felszívódik. Egy kis fehérje vagy zsír mellé (joghurt, dió) sokat lapít a csúcson.',
      },
      walk: {
        title: 'Egy séta most sokat ér',
        body: '10–15 perc mozgás evés után: az izmok azonnal elhasználják a glükóz egy részét, a csúcs láthatóan kisebb lesz.',
      },
      fiberFirst: {
        title: 'Rost előre',
        body: 'Pár falat zöldség vagy saláta a szénhidrát előtt lassítja a felszívódást, a domb így laposabb.',
      },
      order: {
        title: 'Jó irány, egy aprósággal',
        body: 'Ha teheted, a zöldséget és a fehérjét edd előre, a szénhidrátot utoljára: a sorrend önmagában simít a görbén.',
      },
    },
    step: {
      halfSweet: {
        title: 'Feleannyi édes rész',
        body: 'Az édes összetevőből (méz, lekvár, gyümölcslé, cukros öntet) elég a fele: ez a leggyorsabban felszívódó rész.',
      },
      smallerSide: {
        title: 'Negyeddel kisebb köret',
        body: 'A kenyérből, tésztából, rizsből vagy krumpliból negyeddel kevesebb; a helyére jöhet zöldség.',
      },
      addFiber: {
        title: 'Rost mellé',
        body: 'Egy marék zöldség, saláta vagy egy evőkanál chiamag a tányér mellé: a rost fékezi a felszívódást.',
      },
      addProtein: {
        title: 'Fehérje mellé',
        body: '150 g túró, görög joghurt vagy két tojás mellé: a fehérje lassítja a csúcsot.',
      },
    },
    facts: { ofWhichSugar: 'ebből cukor', estimated: 'becsült' },
  },
  // logic/recipeRole.ts — a recipe's meal role, and the same as an attribute of the rubric it was scored under
  recipeRole: {
    role: { standard: 'Általános', pre_workout: 'Edzés előtt', post_workout: 'Edzés után' },
    rubric: { standard: 'általános', pre_workout: 'edzés előtti', post_workout: 'edzés utáni' },
  },
  // logic/recipeSlotFace.ts — a recipe without a known block
  recipeSlotFace: { fallback: 'Étkezés' },
  // logic/buildEnergyBreakdown.ts — the two summands of the day's movement
  // (+ features/me/logic/buildTdeeBreakdown.ts: the weekly-average movement row of the Én energy sheet)
  energyBreakdown: { plannedLogged: 'Tervezett edzés · logolva', unplanned: 'Terven kívüli mozgás', plannedWeeklyAvg: 'Tervezett mozgás · heti átlag' },
  // data/fuel/stackZones.ts (`STACK_ZONE_LABEL`) + logic/projectStackDay.ts — the stack's zones and what anchors each
  stack: {
    zone: {
      wake: 'Ébredés',
      breakfast: 'Reggeli',
      pre_workout: 'Edzés előtt',
      post_workout: 'Edzés után',
      lunch: 'Ebéd',
      dinner: 'Vacsora',
      evening: 'Este',
      bedtime: 'Lefekvés',
    },
    anchor: {
      meal: 'étkezéshez kötve',
      preWorkout: (min: number) => `edzés −${min}p`,
      postWorkout: 'edzés +30p',
      evening: 'lefekvés −2 ó',
      bedtime: 'lefekvés −30p',
      block: (label: string, min: number) => `${label} · edzés −${min}p`,
    },
    deletedItem: '(törölt kamra-tétel)',
  },
  // data/fuel/fuelConfig.ts (`ZONE_LABELS`) — the four parts of the day
  dayPart: { morning: 'Reggel', midday: 'Dél', afternoon: 'Délután', evening: 'Este' },
  // sheets/learnedBaseFormat.ts — the learned base: how sure, a day's status, what a day mark did
  learned: {
    confidence: { low: 'Még tanulok', medium: 'Közepesen biztos', high: 'Biztos' },
    dayStatus: {
      usable: 'számít',
      suspicious: 'hiányosnak tűnt',
      confirmed_complete: 'te jelölted teljesnek',
      marked_incomplete: 'te jelölted hiányosnak',
      unlogged: 'nincs felírva',
    },
    changed: (delta: string) => `A keret ${delta} kcal-lal változott`,
    unchanged: 'A keret nem változott',
    savedOnly: {
      off: 'Elmentettem: a tanult érték frissült, a keretet most a képlet adja.',
      empty: 'Elmentettem: amint elég adatom lesz, beleszámolom.',
    },
  },
}
