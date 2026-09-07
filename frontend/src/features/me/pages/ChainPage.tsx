// ============================================================
// Mezo · ChainPage (mezo-vxd8) — /me/rutin/lanc/:chainKey, prototype rutin-formalodas.html
// `pg-lanc` ×1.18. ONE chain: rename, daypart, order — and the STACKING drawn. The vertical
// rope is the chain's ORDER; the per-row badge says what the row is ACTUALLY anchored to
// (`chainStacking.ts`); where the two disagree the rope goes dashed. Chain position and
// `anchorHabitKey` are two independent orderings, and nothing surfaced it before this page.
//
// The page NEVER ticks a habit (ADR — ticking lives on /nap/rutin): the row nodes are
// read-only status dots, and a row tap navigates to the habit's own page.
// ============================================================
import { useState, type CSSProperties } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useHabitCatalog, useHabitCatalogActions, useHabitDay, useHabitSummary } from '@/data/hooks'
import type { HabitDaypart, HabitDefInfo } from '@/data/types'
import { ropeKindOf, stackAnchorOf } from '@/features/me/logic/chainStacking'
import { cn } from '@/shared/lib/cn'
import { localDateString } from '@/shared/lib/dates'
import { GhostState } from '@/shared/ui/GhostState'
import { MozaikPage, PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import type { ClayIconName } from '@/shared/ui/clay'

const DAYPART_ICON: Record<HabitDaypart, ClayIconName> = { MORNING: 'i-hajnal', DAY: 'i-nap', EVENING: 'i-alvas' }
const DAYPARTS: { key: HabitDaypart; label: string }[] = [
  { key: 'MORNING', label: 'Reggel' },
  { key: 'DAY', label: 'Nap' },
  { key: 'EVENING', label: 'Este' },
]

const PRINCIPLE = 'A kötél a lánc sorrendjét mutatja, a jelvény azt, mihez van kötve az adott '
  + 'szokás. Ha egy elem nem az előzőhöz kötődik, a kötél szaggatottá válik — a sorrend és a '
  + 'horgony ilyenkor nem ugyanazt mondja.'

function rise(delayMs: number): CSSProperties {
  return { '--d': `${delayMs}ms` } as CSSProperties
}

export function ChainPage() {
  const navigate = useNavigate()
  const { chainKey = '' } = useParams<{ chainKey: string }>()
  const { catalog, isPending, isError, refetch } = useHabitCatalog()
  const { habits: todayHabits } = useHabitDay(localDateString())
  const { data: summary } = useHabitSummary()
  const { updateChain, reorderChain, deleteChain, pending } = useHabitCatalogActions()

  const chain = (catalog?.chains ?? []).find((c) => c.chainKey === chainKey)

  const [editing, setEditing] = useState(false)
  const [seedId, setSeedId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [daypart, setDaypart] = useState<HabitDaypart>('MORNING')
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (chain != null && seedId !== chain.id) {
    setSeedId(chain.id)
    setTitle(chain.title)
    setDaypart(chain.daypart)
    setEditing(false)
    setConfirmDelete(false)
    return null
  }

  if (chain == null) {
    if (isPending) {
      return (
        <MozaikPage tone="lav">
          <PageHead onBack={() => navigate('/me/rutin')} label="‹ Rutin" />
          <PageBody><GhostState message="Lánc betöltése…" lines={3} /></PageBody>
        </MozaikPage>
      )
    }
    if (isError) {
      return (
        <MozaikPage tone="lav">
          <PageHead onBack={() => navigate('/me/rutin')} label="‹ Rutin" />
          <PageBody>
            <GhostState message="Nem sikerült betölteni a láncot." ctaLabel="Újra" onCta={refetch} />
          </PageBody>
        </MozaikPage>
      )
    }
    return <Navigate to="/me/rutin" replace />
  }

  const allDefs = (catalog?.chains ?? []).flatMap((c) => c.defs)
  const defs = [...chain.defs].sort((a, b) => a.position - b.position)
  const statusOf = (habitKey: string) => todayHabits.find((h) => h.key === habitKey)?.status
  const doneCount = defs.filter((d) => statusOf(d.habitKey) === 'done').length
  const next = defs.find((d) => d.isActive && statusOf(d.habitKey) === 'pending')
  const isSeed = chain.chainKey === 'MORNING' || chain.chainKey === 'EVENING'
  const brokenRows = defs.filter((_, i) => ropeKindOf(defs, allDefs, i) === 'broken')

  const finishEdit = () => {
    const patch: { title?: string; daypart?: HabitDaypart } = {}
    if (title.trim() !== '' && title.trim() !== chain.title) patch.title = title.trim()
    if (daypart !== chain.daypart) patch.daypart = daypart
    const done = () => setEditing(false)
    if (Object.keys(patch).length > 0) updateChain(chain.id, patch).then(done)
    else done()
  }

  const move = (defId: string, dir: -1 | 1) => {
    const ids = defs.map((d) => d.id)
    const i = ids.indexOf(defId)
    const j = i + dir
    if (i < 0 || j < 0 || j >= ids.length) return
    const next = [...ids]
    ;[next[i], next[j]] = [next[j], next[i]]
    reorderChain(chain.id, next)
  }

  const togglePause = () => {
    updateChain(chain.id, { isActive: !chain.isActive }).then(() => setEditing(false))
  }

  const remove = () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    deleteChain(chain.id).then(() => navigate('/me/rutin'))
  }

  const stackRow = (d: HabitDefInfo, i: number) => {
    const a = stackAnchorOf(defs, allDefs, i)
    const rope = ropeKindOf(defs, allDefs, i)
    const status = statusOf(d.habitKey)
    const isNext = next?.habitKey === d.habitKey
    const strength = summary.habits.find((h) => h.key === d.habitKey)?.strengthPct ?? null
    return (
      <div key={d.id} className={cn('rt-stackrow', !d.isActive && 'is-inert')} data-testid={`stack-${d.habitKey}`}>
        <span className={cn('rt-srail', rope != null && `is-${rope}`)}>
          {/* Read-only status node — never a tick control (ADR: ticking lives on /nap/rutin). */}
          <span
            className={cn('rt-snode', status === 'done' && 'on', isNext && 'next')}
            aria-hidden="true"
          >
            {status === 'done' ? '✓' : isNext ? '›' : ''}
          </span>
        </span>
        <button
          type="button"
          className="rt-sbody"
          onClick={() => navigate(`/me/rutin/szokas/${d.habitKey}`)}
          aria-label={`${d.title} · ${status === 'done' ? 'kész' : status === 'missed' ? 'kimaradt' : 'nyitott'}`}
        >
          <span className="rt-sbody-nm">{d.title}</span>
          <span className={cn('rt-achip', `is-${a.kind}`)}>
            <span aria-hidden="true">{a.kind === 'free' ? '✎' : '⚓'}</span> {a.label}
          </span>
        </button>
        {editing ? (
          <span className="rt-smove">
            <button type="button" aria-label={`${d.title} feljebb`} disabled={i === 0 || pending} onClick={() => move(d.id, -1)}>▲</button>
            <button type="button" aria-label={`${d.title} lejjebb`} disabled={i === defs.length - 1 || pending} onClick={() => move(d.id, 1)}>▼</button>
          </span>
        ) : (
          <span className="rt-smini" aria-hidden="true">
            {strength != null && <span style={{ width: `${strength}%` }} />}
          </span>
        )}
      </div>
    )
  }

  return (
    <MozaikPage tone="lav">
      <PageHead onBack={() => navigate('/me/rutin')} label="‹ Rutin">
        <button
          type="button"
          className="mz-pgact"
          disabled={pending}
          onClick={() => (editing ? finishEdit() : setEditing(true))}
        >
          {editing ? 'Kész' : 'Szerkesztés'}
        </button>
      </PageHead>
      <PageHero
        icon={DAYPART_ICON[chain.daypart]}
        iconSize={46}
        big={`${doneCount} / ${defs.length}`}
        name={`${chain.title} lánc`}
        sub={defs.map((d) => d.title.split(' · ')[0].toLowerCase()).join(' → ') || 'még nincs szokás a láncban'}
      />
      <PageBody principle={PRINCIPLE}>
        <EntranceGroup replayKey={`${chain.id}-${editing}`}>
          {editing && (
            <>
              <div className="rt-fcard rise" style={rise(30)}>
                <span className="rt-flabel">A lánc neve</span>
                <input
                  className="rt-fin"
                  aria-label="A lánc neve"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="rt-fcard rise" style={rise(45)}>
                <span className="rt-flabel">Napszak</span>
                <div className="rt-chips is-gold">
                  {DAYPARTS.map((dp) => (
                    <button
                      key={dp.key}
                      type="button"
                      className={cn(daypart === dp.key && 'on')}
                      onClick={() => setDaypart(dp.key)}
                    >
                      {dp.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="rt-macard rise" style={rise(60)}>
            <div className="rt-macard-head">
              <span className="rt-macard-t">{editing ? 'Sorrend és horgonyok' : 'A lánc sorrendben'}</span>
              <span className="rt-macard-c">{doneCount} / {defs.length} kész</span>
            </div>
            {defs.map((d, i) => stackRow(d, i))}
            {defs.length === 0 && (
              <p className="rt-hint">Ez a lánc még üres — a „＋ Új habit” sor indítja az első szokást.</p>
            )}
          </div>

          {editing && brokenRows.length > 0 && (
            <div className="rt-warn rise" style={rise(75)} data-testid="stack-warn">
              <span aria-hidden="true">⚠</span>
              <span>
                <b>A sorrend és a horgony nem ugyanazt mondja:</b>{' '}
                {brokenRows.map((d) => d.title).join(', ')} nem az előző eleméhez kötődik. A kötél
                ott szaggatott — sorrendezéssel vagy a horgony cseréjével simítható ki.
              </span>
            </div>
          )}

          <button
            type="button"
            className="rt-addrow rise"
            style={rise(90)}
            onClick={() => navigate(`/me/rutin/uj?chain=${encodeURIComponent(chain.chainKey)}`)}
          >
            ＋ Új habit ebbe a láncba
          </button>

          {editing && (
            <>
              <button type="button" className="rt-danger rise" style={rise(110)} disabled={pending} onClick={togglePause}>
                {chain.isActive ? 'Lánc szüneteltetése — a szokások megmaradnak' : 'Folytatás — a lánc újra él'}
              </button>
              {isSeed ? (
                <p className="rt-hint rise" style={rise(125)}>Az alap rutinok (Reggeli, Esti) nem törölhetők.</p>
              ) : defs.length > 0 ? (
                <p className="rt-hint rise" style={rise(125)}>Csak üres lánc törölhető — előbb a szokásait kell törölni vagy átköltöztetni.</p>
              ) : (
                <button
                  type="button"
                  className={cn('rt-danger is-hard rise', confirmDelete && 'is-armed')}
                  style={rise(125)}
                  disabled={pending}
                  onClick={remove}
                >
                  {confirmDelete ? 'Biztosan törlöd? Koppints újra' : 'Lánc törlése'}
                </button>
              )}
            </>
          )}
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}
