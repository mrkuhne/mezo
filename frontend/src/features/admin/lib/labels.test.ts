import { describe, expect, it } from 'vitest'
import { FEATURE_LABELS, featureLabel, screenLabel, tableLabel } from './labels'

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
})
