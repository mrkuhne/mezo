import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { Toggle } from '@/shared/ui/Toggle'
import { cn } from '@/shared/lib/cn'
import { NOTIFICATION_CATEGORY_META } from '@/data/types'
import type { NotificationCategoryKey, NotificationPrefView } from '@/data/types'

/** One Titanium 3D icon per category (üveg, mezo-me75u.7 — prototypes/uveg-en2.html `bert()`).
 *  Mapped HERE, per meaning, not through `CLAY_TO_3D`: the old clay set drew both Napzárás rows,
 *  the two weekly rows and the two sleep rows with one glyph each, so the clay name cannot say
 *  which row it is (bible U1 rule 7). */
const CATEGORY_ICON: Record<NotificationCategoryKey, Icon3DName> = {
  briefing: 't-dawn',
  midday: 't-note',
  weekly_review: 't-score',
  memoir: 't-calendar',
  evening: 't-candle',
  sleep_reaction: 't-sleep',
  weight_reaction: 't-weight',
  gym: 't-dumbbell',
  medication: 't-syringe',
  ritual: 't-clock',
  lights_out: 't-moon',
  wind_down: 't-breath',
  checkin: 't-checkin',
  fuel_slot: 't-supps',
  pattern: 't-pattern',
  knowledge: 't-book',
  prediction: 't-orb',
  experiment: 't-flask',
  challenge: 't-quest',
  memory: 't-stack',
  decision_review: 't-compass',
  intervention: 't-shield',
}

interface NotificationCategoryRowProps {
  pref: NotificationPrefView
  onToggle: () => void
  disabled?: boolean
  /** A live, per-day sub-line derived by the page from the anchors it already has (gym time,
   *  ritual window, bed anchor, medication cycle day, …) — e.g. "ma 17:00 · Láb nap" instead of
   *  the generic "A mai edzés kezdete előtt". Omit (or pass the same static text) when the page
   *  genuinely has no live datum for this row; falls back to `NOTIFICATION_CATEGORY_META`'s
   *  static description, which stays the honest fallback, never a fabricated value. */
  subLine?: string
}

/**
 * One settings-list row for a push-notification category. Üveg (mezo-me75u.7,
 * prototypes/uveg-en2.html `.srow3`): a flat row — lit 3D icon well, name, sub-line, the lead
 * chip, a sky-lit switch — inside the page's one glass card per group. Presentational only — no
 * `@/data/*Hooks`/`@/data/hooks` import: label and lead-chip visibility come from
 * `NOTIFICATION_CATEGORY_META` (data/types.ts), so this file never hardcodes Hungarian copy;
 * the sub-line is either the caller-supplied derived `subLine` or that same meta's static
 * description. bd mezo-h4wp.6.2/.3, mezo-d20.6.8.
 */
export function NotificationCategoryRow({ pref, onToggle, disabled = false, subLine }: NotificationCategoryRowProps) {
  const meta = NOTIFICATION_CATEGORY_META[pref.category]
  return (
    // Üveg (mezo-me75u.7): a flat, hairline-separated row inside the group's ONE glass card
    // (the prototype `.srows` pattern) — no per-row wash tile any more, never glass in glass.
    <div className={cn('ntf-catrow rise', !pref.enabled && 'off')}>
      <span className="ntf-cic uv-well" aria-hidden="true">
        <Icon3D name={CATEGORY_ICON[pref.category]} size={28} />
      </span>
      <div className="ntf-cat-tx">
        <span className="ntf-cat-nm">{meta.label}</span>
        <span className="ntf-cat-sb">{subLine ?? meta.description}</span>
      </div>
      {meta.showLeadChip && pref.enabled && (
        <span className="ntf-leadch">−{pref.leadMinutes} perc</span>
      )}
      <Toggle glass on={pref.enabled} onToggle={onToggle} ariaLabel={meta.label} disabled={disabled} />
    </div>
  )
}
