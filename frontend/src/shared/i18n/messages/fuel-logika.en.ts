// Fuel · the English of the shared label maps and sentence builders (`fuel-logika.hu.ts`). Wording = the approved prototype's
// `L(hu, en)` pairs (docs/design_2.0/prototypes/vilagos/fuel.js) wherever the Hungarian has one.
import type { Shape } from '../shape'
import type { fuelLogikaHu } from './fuel-logika.hu'

export const fuelLogikaEn: Shape<typeof fuelLogikaHu> = {
  slot: { breakfast: 'Breakfast', lunch: 'Lunch', snack: 'Snack', dinner: 'Dinner' },
  mealSkips: {
    reasons: {
      NOT_HUNGRY: 'Not hungry',
      NO_TIME: 'No time',
      STOMACH: 'Stomach bug',
      ILLNESS: 'I’m ill',
      TRAVEL: 'Travelling',
      OTHER: 'Other',
    },
    noReason: 'no reason given',
    quoted: (text) => `“${text}”`,
  },
  mealWindow: {
    durHM: (h, min) => `${h} h ${min} min`,
    durH: (h) => `${h} h`,
    durM: (min) => `${min} min`,
    inWindow: 'In the window',
    later: (dur) => `+${dur} later`,
    earlier: (dur) => `−${dur} earlier`,
    reason: {
      afterWake: {
        title: (wake) => `Soon after waking (${wake})`,
        body: 'After the night’s fast this is where you refill your stores.',
      },
      proteinStart: {
        title: 'The first protein of the day',
        body: 'It starts the day’s run of protein, roughly every 3–4 hours.',
      },
      proteinSpacing: {
        title: 'Roughly 3–4 hours after the last one',
        body: 'Spreading protein evenly helps build muscle and keeps hunger in check.',
      },
      bridge: {
        title: 'Between two main meals',
        body: 'It bridges the longer gap, so you do not arrive at the next meal starving.',
      },
      preTrainingMain: {
        title: (start) => `A few hours before training${start ? ` (${start})` : ''}`,
        body: 'This is the day’s main carb meal: you start with full stores, and it is digested by then.',
      },
      preTrainingSnack: {
        title: (start) => `45–90 minutes before training${start ? ` (${start})` : ''}`,
        body: 'Light, fast carbs: do not train on an empty stomach, or on a full one.',
      },
      postTraining: {
        title: (end) => `Half an hour to an hour and a half after training${end ? ` (${end})` : ''}`,
        body: 'Protein and carbs help recovery and refill your stores.',
      },
      beforeBed: {
        title: (bed) => `At least 2.5 hours before bed (${bed})`,
        body: 'Late in the evening the same food usually raises blood sugar more and can hurt your sleep.',
      },
      templateFixed: {
        title: 'From your own day template',
        body: 'You fixed this time in your day template.',
      },
      shifted: {
        titleAfter: (meal, at) => `Moved: ${meal} was later (${at})`,
        title: 'Moved after the previous window',
        body: 'This leaves about an hour and a half between the two meals, and the day’s other windows follow.',
      },
    },
  },
  dayPlan: {
    window: {
      morningSnack: 'Morning snack',
      eveningSnack: 'Evening snack',
      preWorkoutSnack: 'Pre-workout snack',
    },
    betweenMeals: 'Between meals',
    betweenMealsAt: (time) => `Between meals · ${time}`,
    stack: (zone) => `Supplements · ${zone}`,
  },
  keretHero: {
    role: { pre: 'BEFORE TRAINING', post: 'AFTER TRAINING', standard: 'STANDARD' },
    equation: { base: 'Base', activity: 'Movement', goal: 'Your goal', eaten: 'Food', remaining: 'Left' },
  },
  glycemic: {
    expect: {
      low: {
        energy: 'Steady energy for 3–4 hours',
        back: 'Back to baseline in about 2 hours, gently',
        hunger: 'Hunger returns late and gradually',
      },
      mid: {
        energy: 'Stable energy for 2–3 hours',
        back: 'Back at baseline in about 2 hours',
        hunger: 'Hunger shows up in 2–3 hours',
      },
      high: {
        energy: 'A quick boost, then a dip',
        back: 'Drops in about 1.5 hours and may fall below baseline',
        hunger: 'After the dip you may be hungry again early, in 1–1.5 hours',
      },
    },
    tip: {
      balance: {
        title: 'A good balance',
        body: 'Protein and fibre release the sugar slowly: this plate evens itself out.',
      },
      dress: {
        title: 'Dress the carbs',
        body: 'The sweet part is absorbed fast on its own. A little protein or fat with it (yoghurt, nuts) flattens the peak a lot.',
      },
      walk: {
        title: 'A walk now helps a lot',
        body: '10–15 minutes of movement after eating: your muscles use some of the glucose at once, and the peak gets visibly smaller.',
      },
      fiberFirst: {
        title: 'Fibre first',
        body: 'A few bites of vegetables or salad before the carbs slow the absorption, so the hill is flatter.',
      },
      order: {
        title: 'Good direction, with one small thing',
        body: 'If you can, eat the vegetables and the protein first and the carbs last: the order alone smooths the curve.',
      },
    },
    step: {
      halfSweet: {
        title: 'Half the sweet part',
        body: 'Half of the sweet ingredient (honey, jam, juice, sugary dressing) is enough: it is the part absorbed fastest.',
      },
      smallerSide: {
        title: 'A quarter less of the side',
        body: 'A quarter less bread, pasta, rice or potato; vegetables can take its place.',
      },
      addFiber: {
        title: 'Add fibre',
        body: 'A handful of vegetables, salad or a tablespoon of chia seeds on the side: fibre slows the absorption.',
      },
      addProtein: {
        title: 'Add protein',
        body: '150 g of cottage cheese, Greek yoghurt or two eggs with it: protein slows the peak.',
      },
    },
    facts: { ofWhichSugar: 'of which sugar', estimated: 'estimated' },
  },
  recipeRole: {
    role: { standard: 'General', pre_workout: 'Before training', post_workout: 'After training' },
    rubric: { standard: 'general', pre_workout: 'before training', post_workout: 'after training' },
  },
  recipeSlotFace: { fallback: 'Meal' },
  energyBreakdown: { plannedLogged: 'Planned workout · logged', unplanned: 'Unplanned movement', plannedWeeklyAvg: 'Planned movement · weekly average' },
  stack: {
    zone: {
      wake: 'Wake-up',
      breakfast: 'Breakfast',
      pre_workout: 'Pre-workout',
      post_workout: 'Post-workout',
      lunch: 'Lunch',
      dinner: 'Dinner',
      evening: 'Evening',
      bedtime: 'Bedtime',
    },
    anchor: {
      meal: 'with a meal',
      preWorkout: (min) => `training −${min} min`,
      postWorkout: 'training +30 min',
      evening: 'bed −2 h',
      bedtime: 'bed −30 min',
      block: (label, min) => `${label} · training −${min} min`,
    },
    deletedItem: '(deleted pantry item)',
  },
  dayPart: { morning: 'Morning', midday: 'Midday', afternoon: 'Afternoon', evening: 'Evening' },
  learned: {
    confidence: { low: 'Still learning', medium: 'Fairly sure', high: 'Sure' },
    dayStatus: {
      usable: 'counts',
      suspicious: 'looked incomplete',
      confirmed_complete: 'you marked it complete',
      marked_incomplete: 'you marked it incomplete',
      unlogged: 'not logged',
    },
    changed: (delta) => `The budget changed by ${delta} kcal`,
    unchanged: 'The budget did not change',
    savedOnly: {
      off: 'Saved. The learned value is updated; for now the formula sets your budget.',
      empty: 'Saved. I will count it in as soon as I have enough data.',
    },
  },
}
