import type { GoalTimelineResponse } from '@/lib/goalLinkApi'
import type { GoalResponse } from '@/lib/goalApi'
import type { Goal, WeightEntry, WeightTrends, LinkedMeso } from './types'

export const goal: Goal = {
  id: 'goal-cut-2026',
  title: 'Fogyás · Nyári forma',
  kind: 'cut',
  status: 'active',
  startWeight: 81.4,
  currentWeight: 78.6,
  targetWeight: 73.0,
  rateTarget: { value: 0.5, unit: 'kg/hét', direction: 'down' },
  mesocycles: ['meso-hyp-04', 'meso-str-02', 'meso-maint-01'],
  identityFrame: 'Egészséges erő · nem csak alak — a teljes energiám jobb 73kg-on a Reta cycle után.',
}

// Mock raw GoalResponse — the G4b command-center hero reads the contract shape
// (trajectory/guards/window/weights) directly, so mock mode supplies the same
// envelope the backend returns. ISO dates here; the hero formats them via huMonthDay.
export const goalResponse: GoalResponse = {
  id: goal.id,
  title: goal.title,
  trajectory: 'cut',
  guards: ['strength', 'muscle'],
  status: 'active',
  startDate: '2026-04-01',
  targetDate: '2026-08-15',
  startWeightKg: goal.startWeight,
  targetWeightKg: goal.targetWeight,
  rateTargetPctPerWeek: 0.6,
  identityFrame: goal.identityFrame,
}

export const weightLog: WeightEntry[] = [
  { date: '2026-04-22', value: 81.4, note: 'Goal start · Reta cycle indul' },
  { date: '2026-04-25', value: 81.0 },
  { date: '2026-04-28', value: 80.8 },
  { date: '2026-05-01', value: 80.5 },
  { date: '2026-05-04', value: 80.2, note: 'Első hét Reta · étvágy lefulladás stabil' },
  { date: '2026-05-07', value: 79.9 },
  { date: '2026-05-09', value: 79.7 },
  { date: '2026-05-11', value: 80.3, note: 'Volleyball szombat · folyadékvesztés kalibrálás' },
  { date: '2026-05-13', value: 79.5 },
  { date: '2026-05-15', value: 79.2 },
  { date: '2026-05-17', value: 79.0 },
  { date: '2026-05-19', value: 79.4, note: 'Reta D1 reggel · hétfő reggeli súly nem reprezentatív' },
  { date: '2026-05-20', value: 78.9 },
  { date: '2026-05-21', value: 78.8 },
  { date: '2026-05-22', value: 78.6 },
]

export const weightTrends: WeightTrends = {
  last7d: { avg: 78.96, deltaVsPrev: -0.6, weeklyRate: -0.5, onTrack: true },
  last4w: { avg: 79.85, deltaVsStart: -2.8, weeklyRate: -0.7, onTrack: true },
  sinceStart: { delta: -2.8, daysIn: 30, projectedEndDate: 'Aug 12', projectedRateGap: 3 },
  factors: [
    { kind: 'positive', title: 'Reta D3-D5 alacsony étvágy', impact: '−0.4 kg várható', evidence: 'Múlt 4 ciklusban D3-D5 átlagos súlyvesztés 0.5kg', confidence: 0.84 },
    { kind: 'positive', title: 'Kalória pacing 91% target alatt', impact: '−0.3 kg/hét', evidence: 'Heti kcal 21,300 vs 23,400 target', confidence: 0.78 },
    { kind: 'neutral', title: 'Volleyball szombat folyadékvesztés', impact: '+1.0 kg vasárnap reggel torzítás', evidence: '5 mérés egymás után: vasárnap reggel pre-bathroom +1kg átlag', confidence: 0.91 },
    { kind: 'watch', title: 'Magnézium-glicinát kihagyott napok', impact: 'Lehet hogy vizesedés', evidence: 'Mg + alvás-minőség párral korrelál vizesedés-csökkentéssel', confidence: 0.62 },
  ],
  insights: [
    { type: 'milestone', text: 'Ma elértük a 78.6-ot — 30 nap alatt 2.8kg. A target tempó 0.5kg/hét, mi 0.7-en megyünk. Ha ez tart, augusztus 12-én 73kg, **3 nappal a deadline előtt**.' },
    { type: 'pattern', text: 'Friss minta: a Reta D1-D2 napokon kb. 0.3-0.5kg vízsúly-felemelkedés látható, ami D4-re visszaáll. Ezt **mindig a heti átlagban nézzük**, nem napi raw értékben.' },
    { type: 'warning', text: 'Az elmúlt 2 hétben háromszor kihagytuk a 21:00 magnézium-stack-et. Pattern P2 alapján az alvás-onset + vizesedés ezzel korrelál — érdemes lenne stabilizálni.' },
  ],
}

export const linkedMesocycles: Record<string, LinkedMeso> = {
  'meso-hyp-04': { id: 'meso-hyp-04', shortTitle: 'Hypertrophy 04', status: 'active', startDate: 'Máj 1', endDate: 'Jún 12', weeks: 6 },
  'meso-str-02': { id: 'meso-str-02', shortTitle: 'Strength 02', status: 'planned', startDate: 'Jún 16', endDate: 'Aug 4', weeks: 7 },
  'meso-maint-01': { id: 'meso-maint-01', shortTitle: 'Maintenance', status: 'planned', startDate: 'Aug 7', endDate: 'Aug 28', weeks: 3 },
}

// Static mock timeline — Decision A (G4b). Mirrors `linkedMesocycles` (the three
// gym mesocycles as `mesocycle` links) and adds a sample `running_block` link +
// an uncovered gym-lane gap so the GoalTimeline lane component renders the same
// lanes/gaps in mock mode as in real mode. `goalId` + `weeks` track the mock goal
// window (Ápr 1 → Aug 15 ≈ 20 weeks). ISO dates here — `useGoal`/the lane format
// them, matching how real `GoalTimelineResponse` arrives from the backend.
export const goalTimeline: GoalTimelineResponse = {
  goalId: goal.id,
  weeks: 20,
  links: [
    {
      id: 'link-hyp-04',
      planType: 'mesocycle',
      planId: 'meso-hyp-04',
      startWeek: 5,
      endWeek: 10,
      plan: { title: 'Hypertrophy 04', status: 'active', startDate: '2026-05-01', endDate: '2026-06-12', weeks: 6 },
    },
    {
      id: 'link-str-02',
      planType: 'mesocycle',
      planId: 'meso-str-02',
      startWeek: 11,
      endWeek: 17,
      plan: { title: 'Strength 02', status: 'planned', startDate: '2026-06-16', endDate: '2026-08-04', weeks: 7 },
    },
    {
      id: 'link-maint-01',
      planType: 'mesocycle',
      planId: 'meso-maint-01',
      startWeek: 18,
      endWeek: 20,
      plan: { title: 'Maintenance', status: 'planned', startDate: '2026-08-07', endDate: '2026-08-28', weeks: 3 },
    },
    {
      id: 'link-run-01',
      planType: 'running_block',
      planId: 'run-base-01',
      startWeek: 6,
      endWeek: 13,
      plan: { title: 'Base Build · 5K', status: 'active', startDate: '2026-05-08', endDate: '2026-07-03', weeks: 8 },
    },
  ],
  gaps: [{ fromWeek: 1, toWeek: 4 }],
}
