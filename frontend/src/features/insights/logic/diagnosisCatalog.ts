/**
 * The diagnosis question catalog (mezo-po3y) — the FE face of the backend's DiagnosisRecipe
 * list. A new live question is one entry here (+ its backend recipe); it leaves UPCOMING by
 * arriving in LIVE_QUESTIONS.
 */
export interface DiagnosisQuestion {
  phenomenon: string
  question: string
  blurb: string
}

export const LIVE_QUESTIONS: DiagnosisQuestion[] = [
  {
    phenomenon: 'fatigue',
    question: 'Miért vagyok fáradt?',
    blurb:
      'A Mezo az utolsó 14 nap adatait veti össze az előző négy héttel — alvás, energia, terhelés, fuel —, és rangsorolt gyanúsítottakat ad, mindet mért evidenciával.',
  },
  {
    phenomenon: 'sleep',
    question: 'Miért alszom rosszul?',
    blurb:
      'Az alvásod két hete a viselkedési oldal ellen fut: késői étkezés, esti stressz, terhelés, lefekvés-szórás — a Mezo megnézi, melyik viszi el.',
  },
]

export const UPCOMING_QUESTIONS: string[] = [
  'Miért nem mozdul a súlyom?',
  'Kell most deload?',
  'Havi Mezo Riport',
]

/** phenomenon → the question title (the detail hero); falls back to the wire value. */
export function questionOf(phenomenon: string): string {
  return LIVE_QUESTIONS.find((q) => q.phenomenon === phenomenon)?.question ?? phenomenon
}
