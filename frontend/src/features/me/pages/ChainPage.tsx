// ============================================================
// Mezo · ChainPage (mezo-vxd8; Folyadék F2 mezo-n4wf5.2) — /nap/rutin/lanc/:chainKey, prototype
// vilagos/nap.js `lanc`. ONE chain: rename, daypart, order — and the STACKING said. The hero's
// connected vessels are the chain in ORDER, each filled to the habit's 28-day strength; every
// row names what it is ACTUALLY anchored to (`chainStacking.ts`). Chain position and
// `anchorHabitKey` are two independent orderings: where they disagree the row carries
// `data-rope="broken"` and edit mode explains it.
//
// The page NEVER ticks a habit (ADR — ticking lives on /nap/rutin): the row marks are read-only
// status nodes, and a row tap navigates to the habit's own page.
// ============================================================
import { useState, type CSSProperties } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useHabitCatalog, useHabitCatalogActions, useHabitDay, useHabitSummary } from '@/data/hooks'
import type { HabitDaypart, HabitDefInfo } from '@/data/types'
import { RbBack, RowItem } from '@/features/me/components/routineBits'
import { ropeKindOf, stackAnchorOf } from '@/features/me/logic/chainStacking'
import { localDateString } from '@/shared/lib/dates'
import { huArticle, huFrom } from '@/shared/lib/huNum'
import type { Icon3DName } from '@/shared/ui/clay'
import {
  Btn, Bub, Card, Empty, ErrorRow, Hero, Lab, Level, Lk, Mark, Note, Page, Pill, Pills, Row, Section, Vials, Why,
  useFrameTitle, type VialItem,
} from '@/shared/ui/folyadek'

// Mapped at the call site — `i-alvas` is sleep in CLAY_TO_3D, „este" here.
const DAYPART_ART: Record<HabitDaypart, Icon3DName> = { MORNING: 't-dawn', DAY: 't-sun', EVENING: 't-moon' }
const DAYPARTS: { key: HabitDaypart; label: string }[] = [
  { key: 'MORNING', label: 'Reggel' },
  { key: 'DAY', label: 'Nap' },
  { key: 'EVENING', label: 'Este' },
]
/** Vessels per line in the hero: up to five stand in one row, more wrap six across. */
const PIPE_ROW = 6

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
  useFrameTitle({
    title: chain != null ? `${chain.title} lánc` : undefined,
    eyebrow: chain != null ? `Rutinok · ${chain.isActive ? 'aktív' : 'szünetelő'} lánc` : undefined,
  })

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
        <Page>
          <RbBack label="Rutinok" fallback="/nap/rutin/epites" />
          <Card><Note>Lánc betöltése…</Note></Card>
        </Page>
      )
    }
    if (isError) {
      return (
        <Page>
          <RbBack label="Rutinok" fallback="/nap/rutin/epites" />
          <Card><ErrorRow message="Nem sikerült betölteni a láncot." onRetry={refetch} /></Card>
        </Page>
      )
    }
    return <Navigate to="/nap/rutin/epites" replace />
  }

  const allDefs = (catalog?.chains ?? []).flatMap((c) => c.defs)
  const defs = [...chain.defs].sort((a, b) => a.position - b.position)
  const statusOf = (habitKey: string) => todayHabits.find((h) => h.key === habitKey)?.status
  const strengthOf = (habitKey: string) => summary.habits.find((h) => h.key === habitKey)?.strengthPct ?? null
  const doneCount = defs.filter((d) => statusOf(d.habitKey) === 'done').length
  const next = defs.find((d) => d.isActive && statusOf(d.habitKey) === 'pending')
  const isSeed = chain.chainKey === 'MORNING' || chain.chainKey === 'EVENING'
  const brokenRows = defs.filter((_, i) => ropeKindOf(defs, allDefs, i) === 'broken')
  const toHabit = (habitKey: string) => navigate(`/nap/rutin/szokas/${habitKey}`)
  const toWizard = () => navigate(`/nap/rutin/uj?chain=${encodeURIComponent(chain.chainKey)}`)

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
    if (pending) return
    updateChain(chain.id, { isActive: !chain.isActive }).then(() => setEditing(false))
  }

  const remove = () => {
    if (pending) return
    if (!confirmDelete) { setConfirmDelete(true); return }
    deleteChain(chain.id).then(() => navigate('/nap/rutin/epites', { replace: true }))
  }

  // The hero's vessels: one per habit, in chain order, filled to its 28-day strength.
  const vial = (d: HabitDefInfo): VialItem => {
    const status = statusOf(d.habitKey)
    const strength = strengthOf(d.habitKey)
    return {
      label: d.title,
      pct: strength ?? 0,
      value: strength != null ? `${strength}%` : '—',
      // The mark turns white once the liquid covers it (bible §5).
      mark: status === 'done' || next?.habitKey === d.habitKey
        ? <span className={(strength ?? 0) >= 78 ? 'rb-on' : undefined}>{status === 'done' ? '✓' : 'most'}</span>
        : undefined,
      color: status === 'done' ? 'var(--fo-ok)' : undefined,
      onClick: editing ? undefined : () => toHabit(d.habitKey),
    }
  }
  const many = defs.length > PIPE_ROW
  const lines: HabitDefInfo[][] = []
  for (let i = 0; i < defs.length; i += many ? PIPE_ROW : defs.length) lines.push(defs.slice(i, i + (many ? PIPE_ROW : defs.length)))
  const pipe = lines.map((line, i) => {
    const cols = many ? PIPE_ROW : line.length
    const edge = 100 / (2 * cols)
    return (
      <div
        key={i}
        className={many ? 'rb-pipe many' : 'rb-pipe'}
        style={{ '--el': `${edge}%`, '--er': `${100 - (line.length - 0.5) * (100 / cols)}%` } as CSSProperties}
      >
        <Vials size={defs.length > 5 ? 'xs' : 'sm'} height={100} items={line.map(vial)} />
      </div>
    )
  })

  // „a 9‑ből": a non-breaking hyphen and space, so the number never parts from its suffix or article.
  const ofAll = `${huArticle(defs.length)}\u00a0${huFrom(defs.length).replace('-', '\u2011')}`
  const verdict = editing ? 'Rendezd át, ahogy neked kézre áll.'
    : defs.length === 0 ? 'Ez a lánc még üres.'
      : next != null ? `${doneCount} megvan ${ofAll}. Most jön: ${next.title}.`
        : doneCount === defs.length ? `Mind megvan: ${doneCount} / ${defs.length}.`
          : `${doneCount} megvan ${ofAll}.`

  const stackRow = (d: HabitDefInfo, i: number) => {
    const a = stackAnchorOf(defs, allDefs, i)
    const rope = ropeKindOf(defs, allDefs, i)
    const status = statusOf(d.habitKey)
    const isNext = next?.habitKey === d.habitKey
    const strength = strengthOf(d.habitKey)
    return (
      <RowItem key={d.id} testId={`stack-${d.habitKey}`} data-rope={rope ?? undefined}>
        <Row
          as={editing ? 'div' : undefined}
          state={d.isActive ? undefined : 'dim'}
          // Read-only status node — never a tick control (ADR: ticking lives on /nap/rutin).
          left={<Mark state={status === 'done' ? 'done' : isNext ? 'now' : 'empty'} />}
          title={d.title}
          sub={(
            <span className="rb-anc" data-kind={a.kind}>
              <Bub icon={a.kind === 'free' ? 't-note' : 't-anchor'} size={24} /><span>{a.label}</span>
            </span>
          )}
          value={!editing && strength != null ? <>{strength}<small>%</small></> : undefined}
          more={!editing && strength != null
            ? <Level pct={strength} height={8} color={status === 'done' ? 'var(--fo-ok)' : undefined} />
            : undefined}
          right={editing ? (
            <span className="rb-mv">
              <button type="button" aria-label={`${d.title} feljebb`} disabled={i === 0 || pending} onClick={() => move(d.id, -1)}>▲</button>
              <button type="button" aria-label={`${d.title} lejjebb`} disabled={i === defs.length - 1 || pending} onClick={() => move(d.id, 1)}>▼</button>
            </span>
          ) : undefined}
          onClick={() => toHabit(d.habitKey)}
          aria-label={`${d.title} · ${status === 'done' ? 'kész' : status === 'missed' ? 'kimaradt' : 'nyitott'}`}
        />
      </RowItem>
    )
  }

  return (
    <Page>
      <RbBack label="Rutinok" fallback="/nap/rutin/epites" />
      <Hero
        label={editing ? 'Szerkesztés' : `Ma eddig · ${doneCount} / ${defs.length} kész`}
        verdict={verdict}
        sub={defs.length === 0
          ? 'Az „Új szokás ebbe a láncba” sor indítja az elsőt.'
          : `${defs.length} összekötött edény: mindegyik a szokás 28 napos erejéig telik.`}
        actions={(
          <>
            <Btn disabled={pending} onClick={() => (editing ? finishEdit() : setEditing(true))}>
              {editing ? 'Kész' : 'Szerkesztés'}
            </Btn>
            {!editing && <Lk onClick={toWizard}>+ Új szokás ide</Lk>}
          </>
        )}
      >
        {pipe}
      </Hero>

      {editing && (
        <>
          <Section n={1} title="Név és napszak" />
          <Card>
            <Lab htmlFor="rb-chain-name">A lánc neve</Lab>
            <input
              id="rb-chain-name"
              className="rb-in"
              aria-label="A lánc neve"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Lab>Napszak</Lab>
            <Pills>
              {DAYPARTS.map((dp) => (
                <Pill key={dp.key} on={daypart === dp.key} icon={DAYPART_ART[dp.key]} onClick={() => setDaypart(dp.key)}>
                  {dp.label}
                </Pill>
              ))}
            </Pills>
          </Card>
        </>
      )}

      <Section n={editing ? 2 : 1} title={editing ? 'Sorrend és horgonyok' : 'A lánc sorrendben'} />
      <Card>
        {defs.map((d, i) => stackRow(d, i))}
        {defs.length === 0 && <Empty icon={DAYPART_ART[chain.daypart]}>Ez a lánc még üres.</Empty>}
        {editing && brokenRows.length > 0 && (
          <div data-testid="stack-warn">
            <Why icon="t-info">
              <b>A sorrend és a horgony nem ugyanazt mondja:</b>{' '}
              {brokenRows.map((d) => d.title).join(', ')} nem az előző eleméhez kötődik. Sorrendezéssel
              vagy a horgony cseréjével simítható ki.
            </Why>
          </div>
        )}
        <Note>A horgony mondja meg, mi után jön a szokás — a sorrend ezt követi.</Note>
      </Card>

      <Section n={editing ? 3 : 2} title={editing ? 'Bővítés és szünet' : 'Bővítés'} />
      <Card>
        <Row
          icon="t-addex" title="Új szokás ebbe a láncba"
          sub={editing ? undefined : 'a varázsló végigvezet'}
          onClick={toWizard}
        />
        {editing && (
          <>
            <Row
              icon={chain.isActive ? 't-hold' : 't-play'}
              title={chain.isActive ? 'Lánc szüneteltetése' : 'Folytatás'}
              sub={chain.isActive ? 'a szokások megmaradnak' : 'a lánc újra él'}
              onClick={togglePause}
            />
            {isSeed ? (
              <Note>Az alap rutinok (Reggeli, Esti) nem törölhetők.</Note>
            ) : defs.length > 0 ? (
              <Note>Csak üres lánc törölhető — előbb a szokásait kell törölni vagy átköltöztetni.</Note>
            ) : (
              <Row
                icon="t-trash"
                className={confirmDelete ? 'rb-armed' : undefined}
                title={confirmDelete ? 'Biztosan törlöd? Koppints újra' : 'Lánc törlése'}
                sub={confirmDelete ? undefined : 'két koppintás kell hozzá'}
                aria-label={confirmDelete ? 'Biztosan törlöd? Koppints újra' : 'Lánc törlése'}
                onClick={remove}
              />
            )}
          </>
        )}
      </Card>
    </Page>
  )
}
