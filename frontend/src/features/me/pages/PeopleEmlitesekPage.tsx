// ============================================================
// Mezo · PeopleEmlitesekPage — Emberek S3 hub, "Említések" sibling page (mezo-06o0.2 Task 5)
// Source of truth: docs/design_2.0/prototypes/src/emberek-body.html rhythmHtml()/chipRow()/
// feedHtml() + emberek-head.html `.rhythm`/`.rcols`/`.rcol`/`.bar`/`.rax`/`.chiprow`/
// `.fchip`/`.cdot` (×1.18, ported as `.ppl-rhythm`/`.ppl-rcols`/`.ppl-rcol`/`.ppl-rbar`/
// `.ppl-rax`/`.ppl-fchip-dot` onto the existing `.ppl-chiprow`/`.ppl-fchip` family).
//
// The week-rhythm strip is deliberately UNFILTERED (the prototype's rhythmHtml() reads
// its own MENTIONS array, not the `F` filter state) — it is the hub's own honest "what
// actually happened this week" reading, while the chips/feed below narrow the LIST. Bar
// heights come from Task 1's `weeklyRhythm` (never a local re-derivation); the "hét"
// scope chip narrows the feed to a rolling 7-day window measured from the newest mention's
// own timestamp (not `Date.now()`), so a mock seed frozen in the past still shows a real
// week's worth of rows.
//
// Honest empty/incomplete states: a filtered-to-nothing list renders the dashed `.ppl-empty`
// card (never a fabricated row); a tone-less row (the night-run hasn't scored it yet) never
// gets a wash, and the page's own footnote only appears when at least one visible row is
// actually tone-less — never a blanket disclaimer nobody needed.
import { useMemo, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { MozaikPage, PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { ClayIcon } from '@/shared/ui/clay'
import { usePeople } from '@/data/hooks'
import { weeklyRhythm } from '@/features/me/logic/peopleDerive'
import { TONE_META, CTX_META } from '@/features/me/logic/peopleVisuals'
import { MentionRow } from '@/features/me/components/MentionRow'
import { PersonLogSheet } from '@/features/me/sheets/PersonLogSheet'
import type { Affect, Mention, MentionContext } from '@/data/types'

// 8+n*13 / 3px prototype bar heights x1.18 frame scale (9+n*15 / 4px).
const RHYTHM_BASE_PX = 9
const RHYTHM_PER_COUNT_PX = 15
const RHYTHM_EMPTY_PX = 4
const DAY_MS = 24 * 60 * 60 * 1000

type Scope = 'mind' | 'het'
interface Filters { scope: Scope; tone: Affect | null; ctx: MentionContext | null }

// The prototype's chipRow() only ever renders these four context chips (`kozos`/`edzes`/
// `munka`/`konfliktus`) out of CTX_META's full 8 — never `csalad`/`baratok`/`segitseg`/`egyeb`.
const CTX_CHIPS: MentionContext[] = ['munka', 'edzes', 'kozos_program', 'konfliktus']

function rhythmBarHeight(count: number): number {
  return count > 0 ? RHYTHM_BASE_PX + count * RHYTHM_PER_COUNT_PX : RHYTHM_EMPTY_PX
}

function filterKey(f: Filters): string {
  return `${f.scope}:${f.tone ?? '-'}:${f.ctx ?? '-'}`
}

function ToneChip({ tone, active, onClick }: { tone: Affect; active: boolean; onClick: () => void }) {
  const meta = TONE_META[tone]
  const style = active
    ? ({
        background: `color-mix(in srgb, var(${meta.cssVar}) 20%, var(--surface-card))`,
        borderColor: `var(${meta.cssVar})`,
        color: `var(${meta.cssVar})`,
      } as CSSProperties)
    : undefined
  return (
    <button type="button" className={`ppl-fchip${active ? ' on' : ''}`} style={style} onClick={onClick}>
      <span className="ppl-fchip-dot" aria-hidden="true" style={{ background: `var(${meta.cssVar})` } as CSSProperties} />
      {meta.label}
    </button>
  )
}

function CtxChip({ ctx, active, onClick }: { ctx: MentionContext; active: boolean; onClick: () => void }) {
  const meta = CTX_META[ctx]
  const style = active
    ? ({
        background: `color-mix(in srgb, var(${meta.cssVar}) 20%, var(--surface-card))`,
        borderColor: `var(${meta.cssVar})`,
        color: `var(${meta.cssVar})`,
      } as CSSProperties)
    : undefined
  return (
    <button type="button" className={`ppl-fchip${active ? ' on' : ''}`} style={style} onClick={onClick}>
      <span className="ppl-fchip-dot" aria-hidden="true" style={{ background: `var(${meta.cssVar})` } as CSSProperties} />
      {meta.label}
    </button>
  )
}

export function PeopleEmlitesekPage() {
  const navigate = useNavigate()
  const { people, mentions, logMention, undoMention } = usePeople()
  const [logOpen, setLogOpen] = useState(false)
  const [filters, setFilters] = useState<Filters>({ scope: 'mind', tone: null, ctx: null })

  const rhythm = weeklyRhythm(mentions, new Date())
  const weekCount = rhythm.reduce((sum, d) => sum + d.count, 0)

  const filtered = useMemo(() => {
    let list = mentions
    if (filters.scope === 'het') {
      const newestTs = mentions.reduce((max, m) => Math.max(max, new Date(m.ts).getTime()), 0)
      const cutoff = newestTs - 7 * DAY_MS
      list = list.filter((m) => new Date(m.ts).getTime() >= cutoff)
    }
    if (filters.tone) list = list.filter((m) => m.tone === filters.tone)
    if (filters.ctx) list = list.filter((m) => m.contextLabel === filters.ctx)
    return list
  }, [mentions, filters])

  const hasTonelessRow = filtered.some((m) => !m.tone)
  const personFor = (m: Mention) => people.find((p) => p.id === m.person_id)

  return (
    <MozaikPage tone="sky">
      <PageHead onBack={() => navigate('/me/people')} label="‹ Kapcsolatok">
        <button
          type="button"
          className="pgact"
          onClick={() => setLogOpen(true)}
          style={{ background: 'var(--mz-cell-sky-bg)', color: 'var(--mz-cell-sky-ink)' }}
        >
          <ClayIcon name="i-mikrofon" size={12} /> Log
        </button>
      </PageHead>

      <PageHero icon="i-naplo" name="Említések" big={weekCount} sub="említés e héten" />

      <PageBody>
        <EntranceGroup replayKey={filterKey(filters)}>
          <div className="ppl-rhythm rise" style={{ '--d': '0ms' } as CSSProperties}>
            <div className="mz-tile-top">
              <span className="mz-eyebrow" style={{ color: 'var(--mz-cell-sky-ink)' }}>A hét ritmusa</span>
              <span className="ppl-rhythm-count">{weekCount} említés</span>
            </div>
            <div className="ppl-rcols">
              {rhythm.map((day, i) => {
                const color = day.worstTone ? `var(${TONE_META[day.worstTone].cssVar})` : 'var(--ppl-tone-ok)'
                return (
                  <div key={i} className={`ppl-rcol${day.isToday ? ' ppl-rcol-today' : ''}`}>
                    <span
                      className="ppl-rbar"
                      style={{ height: `${rhythmBarHeight(day.count)}px`, background: color, '--d': `${120 + i * 55}ms` } as CSSProperties}
                    />
                  </div>
                )
              })}
            </div>
            <div className="ppl-rax">
              {rhythm.map((day, i) => (
                <span key={i} className={day.isToday ? 'ppl-rax-today' : undefined}>{day.label}</span>
              ))}
            </div>
          </div>

          <div className="ppl-chiprow rise">
            <button
              type="button"
              className={`ppl-fchip${filters.scope === 'mind' ? ' on' : ''}`}
              onClick={() => setFilters((f) => ({ ...f, scope: 'mind' }))}
            >
              Mind
            </button>
            <button
              type="button"
              className={`ppl-fchip${filters.scope === 'het' ? ' on' : ''}`}
              onClick={() => setFilters((f) => ({ ...f, scope: 'het' }))}
            >
              Hét
            </button>
            <ToneChip
              tone="positive"
              active={filters.tone === 'positive'}
              onClick={() => setFilters((f) => ({ ...f, tone: f.tone === 'positive' ? null : 'positive' }))}
            />
            <ToneChip
              tone="negative"
              active={filters.tone === 'negative'}
              onClick={() => setFilters((f) => ({ ...f, tone: f.tone === 'negative' ? null : 'negative' }))}
            />
            {CTX_CHIPS.map((ctx) => (
              <CtxChip
                key={ctx}
                ctx={ctx}
                active={filters.ctx === ctx}
                onClick={() => setFilters((f) => ({ ...f, ctx: f.ctx === ctx ? null : ctx }))}
              />
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="ppl-empty rise">Erre a szűrésre nincs említés — próbáld tágabban.</div>
          ) : (
            filtered.map((mention, i) => (
              <MentionRow
                key={mention.id}
                mention={mention}
                person={personFor(mention)}
                onUndo={undoMention}
                delayMs={80 + i * 35}
              />
            ))
          )}

          {hasTonelessRow && <p className="ppl-foot rise">A tónust az éjszakai kör tölti.</p>}
        </EntranceGroup>
      </PageBody>

      {logOpen && <PersonLogSheet onClose={() => setLogOpen(false)} onSave={logMention} people={people} />}
    </MozaikPage>
  )
}
