// Pure taxonomy — no DOM, safe for node tests. The clay symbols live in muscles.js.
// The muscle taxonomy the production app already speaks: 21 live catalog muscles in six regions.
// Each one has its own clay symbol (#i-m-<key>) — same family silhouette per region, the specific
// head lit — so a glance says "shoulder" and a second glance says "which part of it".

export const REGIONS = [
  { key: 'chest', label: 'Mell', color: '#e08a7c' },
  { key: 'back', label: 'Hát', color: '#78cfe7' },
  { key: 'shoulder', label: 'Váll', color: '#bca6f1' },
  { key: 'arm', label: 'Kar', color: '#e79ab8' },
  { key: 'leg', label: 'Láb', color: '#b3d97e' },
  { key: 'core', label: 'Core', color: '#e0bd8a' },
];

export const MUSCLES = [
  { key: 'chest-upper', label: 'Mell (felső)', region: 'chest' },
  { key: 'chest-mid', label: 'Mell (közép)', region: 'chest' },
  { key: 'chest-lower', label: 'Mell (alsó)', region: 'chest' },
  { key: 'back-wide', label: 'Hát (széles)', region: 'back' },
  { key: 'back-mid', label: 'Hát (közép)', region: 'back' },
  { key: 'back-lower', label: 'Hát (alsó)', region: 'back' },
  { key: 'traps', label: 'Trapéz', region: 'back' },
  { key: 'shoulder-front', label: 'Váll (első)', region: 'shoulder' },
  { key: 'shoulder-side', label: 'Váll (oldalsó)', region: 'shoulder' },
  { key: 'shoulder-rear', label: 'Váll (hátsó)', region: 'shoulder' },
  { key: 'biceps-long', label: 'Bicepsz (hosszú fej)', region: 'arm' },
  { key: 'biceps-short', label: 'Bicepsz (rövid fej)', region: 'arm' },
  { key: 'biceps-brachialis', label: 'Brachialis', region: 'arm' },
  { key: 'triceps-long', label: 'Tricepsz (hosszú fej)', region: 'arm' },
  { key: 'triceps-lateral', label: 'Tricepsz (oldalsó fej)', region: 'arm' },
  { key: 'triceps-medial', label: 'Tricepsz (mediális fej)', region: 'arm' },
  { key: 'quad', label: 'Comb', region: 'leg' },
  { key: 'ham', label: 'Lábhajlító', region: 'leg' },
  { key: 'glute', label: 'Far', region: 'leg' },
  { key: 'calf', label: 'Vádli', region: 'leg' },
  { key: 'core', label: 'Core', region: 'core' },
];

const byKey = Object.fromEntries(MUSCLES.map(m => [m.key, m]));
const regionByKey = Object.fromEntries(REGIONS.map(r => [r.key, r]));

export const muscle = key => byKey[key] ?? null;
export const muscleLabel = key => byKey[key]?.label ?? key;
export const muscleColor = key => regionByKey[byKey[key]?.region]?.color ?? '#9c96b0';


/**
 * Which drawable shapes carry each muscle, and on which view. The artwork is coarser than the
 * planner on purpose: the three biceps heads share one shape, the mid back rides on the upper
 * back (no rhomboid shape upstream) — where tokens share a shape, their load is summed.
 */
export const TOKEN_SHAPES = {
  'chest-upper': [['front', 'upper-chest']],
  'chest-mid': [['front', 'chest']],
  'chest-lower': [['front', 'lower-chest']],
  'back-wide': [['back', 'upper-back']],
  'back-mid': [['back', 'upper-back']],
  'back-lower': [['back', 'lower-back']],
  traps: [['back', 'trapezius']],
  'shoulder-front': [['front', 'front-deltoid']],
  'shoulder-side': [['front', 'deltoids']],
  'shoulder-rear': [['back', 'deltoids']],
  'biceps-long': [['front', 'biceps']],
  'biceps-short': [['front', 'biceps']],
  'biceps-brachialis': [['front', 'biceps']],
  'triceps-long': [['back', 'triceps']],
  'triceps-lateral': [['back', 'triceps']],
  'triceps-medial': [['back', 'triceps']],
  quad: [['front', 'quadriceps'], ['front', 'inner-quad'], ['front', 'outer-quad']],
  ham: [['back', 'hamstring']],
  glute: [['back', 'gluteal']],
  calf: [['back', 'calves']],
  core: [['front', 'abs'], ['front', 'upper-abs'], ['front', 'lower-abs'], ['front', 'obliques']],
};
