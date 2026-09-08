import { describe, expect, it } from 'vitest'
import { FEATURE_LABELS, featureLabel, feedbackReasonLabel, screenLabel, surfaceLabel, tableLabel } from './labels'

describe('admin label dictionary', () => {
  it('maps LLM feature slugs to Hungarian labels', () => {
    expect(featureLabel('companion_chat').label).toBe('Beszélgetés a társsal')
    expect(featureLabel('meal_draft').label).toBe('Étel-felismerés')
    expect(featureLabel('train_meso_plan').label).toBe('Edzésterv-készítés')
    expect(featureLabel('companion_chat').missing).toBeUndefined()
  })

  it('maps the activity-domain keys of the admin feature-map', () => {
    for (const key of ['train', 'food', 'sleep', 'journal', 'habits', 'water', 'weight']) {
      expect(featureLabel(key).missing, `domain key ${key}`).toBeUndefined()
    }
  })

  it('falls back honestly on unknown keys', () => {
    const l = featureLabel('brand_new_slug')
    expect(l.label).toBe('brand_new_slug')
    expect(l.missing).toBe(true)
  })

  it('labels screens and tables with the same fallback contract', () => {
    expect(screenLabel('/admin/users/:id').missing).toBeUndefined()
    expect(screenLabel('/never/seen').missing).toBe(true)
    expect(tableLabel('workout_session').label).toBe('Edzések')
    expect(tableLabel('mystery_table').missing).toBe(true)
  })

  it('every entry has a non-empty Hungarian label', () => {
    for (const [key, v] of Object.entries(FEATURE_LABELS)) {
      expect(v.label.trim().length, key).toBeGreaterThan(0)
      expect(v.label, key).not.toBe(key)
    }
  })

  // mezo-kxnn Task 3 — the feature detail page's downReasons list.
  it('maps the 4 message-feedback down-reason keys to Hungarian labels', () => {
    expect(feedbackReasonLabel('inaccurate').label).toBe('Pontatlan')
    expect(feedbackReasonLabel('too_much').label).toBe('Túl sok')
    expect(feedbackReasonLabel('bad_timing').label).toBe('Rossz időzítés')
    expect(feedbackReasonLabel('not_about_me').label).toBe('Nem rólam szól')
    expect(feedbackReasonLabel('inaccurate').missing).toBeUndefined()
  })

  it('falls back honestly on an unknown down-reason key', () => {
    const l = feedbackReasonLabel('brand_new_reason')
    expect(l.label).toBe('brand_new_reason')
    expect(l.missing).toBe(true)
  })

  // mezo-zde2 Task 3 — the Emberek detail's Visszajelzések tab surface names.
  it('maps the 7 companion feedback surface kinds to Hungarian labels', () => {
    expect(surfaceLabel('chat_message').label).toBe('Beszélgetés')
    expect(surfaceLabel('feed_message').label).toBe('Üzenőfal')
    expect(surfaceLabel('weekly_suggestion').label).toBe('Heti javaslat')
    expect(surfaceLabel('weekly_review').label).toBe('Heti értékelés')
    expect(surfaceLabel('memoir').label).toBe('Memoár')
    expect(surfaceLabel('prediction').label).toBe('Előrejelzés')
    expect(surfaceLabel('day_review').label).toBe('Napi értékelés')
    expect(surfaceLabel('chat_message').missing).toBeUndefined()
  })

  it('falls back honestly on an unknown surface kind', () => {
    const l = surfaceLabel('brand_new_kind')
    expect(l.label).toBe('brand_new_kind')
    expect(l.missing).toBe(true)
  })
})
