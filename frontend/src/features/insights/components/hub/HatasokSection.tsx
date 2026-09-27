import { useState, type CSSProperties } from 'react'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { GhostState } from '@/shared/ui/GhostState'
import { useToast } from '@/shared/ui/ToastProvider'
import { useEffectSubjects, useKnowledgeHubActions } from '@/data/insights/knowledgeHubHooks'
import { EffectRows } from '@/features/me/components/EffectRows'
import { CONFIDENCE_META, EVENT_ICON, STRENGTH_META, eventEffectSentence, personEffectSentence } from '@/features/me/logic/effectCopy'
import { byNameHu, matches } from '@/features/insights/logic/hubSearch'
import {
  DEGRADED, EFFECT_GROUPS, EMPTY, FOOT, MUTED_GROUP, MUTED_HINT, SEARCH, TOAST,
  effectSubjectKindLabel, groupCount, lead, whyText,
} from '@/features/insights/logic/hubCopy'
import { HubActs, HubRow } from '@/features/insights/components/hub/HubRow'
import { HubFold } from '@/features/insights/components/hub/HubFold'
import { HubSearch, Highlight, NoHits } from '@/features/insights/components/hub/HubSearch'
import type { ForgetRequest } from '@/features/insights/hooks/useForgetUndo'
import type { EffectSubject } from '@/data/types'

const ACCENT = 'var(--dv-sky)'
const rowKey = (s: EffectSubject) => `e:${s.kind}:${s.key}`
const eventIcon = (key: string): Icon3DName => EVENT_ICON[key] ?? 't-calendar'
const G_PEOPLE = 'e:ppl'
const G_EVENTS = 'e:evt'
const G_MUTED = 'e:muted'

/** The server's order for events: the strongest band first, then the most days behind it. */
function byStrength(a: EffectSubject, b: EffectSubject): number {
  const band = (s: EffectSubject) => Math.max(...s.effects.map((e) => STRENGTH_META[e.strength].n))
  const days = (s: EffectSubject) => Math.max(...s.effects.map((e) => e.subjectDays))
  const conf = (s: EffectSubject) => Math.max(...s.effects.map((e) => CONFIDENCE_META[e.confidence].n))
  return band(b) - band(a) || days(b) - days(a) || conf(b) - conf(a) || byNameHu(a.label, b.label)
}

export interface HatasokSectionProps {
  forget: (req: ForgetRequest) => void
  isHidden: (key: string) => boolean
}

/**
 * S6 (mezo-d6ivw.6): the Hatások section of the Tudástár (`?view=hatasok`, prototype `hatasok()`)
 * — what tends to go together with the user's days, per subject. Two collapsed groups: Emberek
 * (alphabetical, no ranking) and Események (by strength); one glass card per subject with the
 * person page's indicator rows (strength and confidence kept SEPARATE, never glass inside).
 * A muted subject leaves both groups for a flat row under Elhallgattatott. No "Honnan tudom?"
 * here (owner-approved): the card itself is the evidence.
 */
export function HatasokSection({ forget, isHidden }: HatasokSectionProps) {
  const { subjects, degraded, isPending, isError, refetch } = useEffectSubjects()
  const { muteEffect, forgetEffect } = useKnowledgeHubActions()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const [closedWhileSearching, setClosedWhileSearching] = useState<Record<string, boolean>>({})

  if (isPending) return <GhostState message={DEGRADED.loading} />
  if (isError) return <GhostState message={DEGRADED.error} ctaLabel="Újra" onCta={refetch} />
  if (degraded) return <DashCard icon="t-info" text={DEGRADED.section} />

  const visible = subjects.filter((s) => !isHidden(rowKey(s)))
  if (visible.length === 0) return <DashCard icon="t-cowave" text={EMPTY.effects} />

  const q = query.trim()
  const hit = (s: EffectSubject) => matches(s.label, q)
  const people = visible.filter((s) => !s.muted && s.kind === 'person').sort((a, b) => byNameHu(a.label, b.label))
  const events = visible.filter((s) => !s.muted && s.kind === 'event').sort(byStrength)
  const muted = visible.filter((s) => s.muted)
  const peopleHits = people.filter(hit)
  const eventHits = events.filter(hit)
  const mutedHits = muted.filter(hit)

  const isOpen = (g: string) => (q ? !closedWhileSearching[g] : !!openGroups[g])
  const toggle = (g: string) => (q
    ? setClosedWhileSearching((c) => ({ ...c, [g]: !c[g] }))
    : setOpenGroups((o) => ({ ...o, [g]: !o[g] })))
  const onQuery = (v: string) => { setQuery(v); setClosedWhileSearching({}) }

  const mute = (s: EffectSubject, on: boolean) => {
    muteEffect(s.kind, s.key, on)
    toast.show({ kind: 'info', text: on ? TOAST.muted : TOAST.unmuted })
  }
  const onForget = (s: EffectSubject) => forget({
    key: rowKey(s), label: `${s.label} — hatás`, computed: true, commit: () => forgetEffect(s.kind, s.key),
  })

  const cards = (list: EffectSubject[], empty: string) => (list.length > 0
    ? <div className="th-cards">{list.map((s, i) => (
      <EffectCard key={rowKey(s)} subject={s} index={i + 1} query={q} onMute={() => mute(s, true)} onForget={() => onForget(s)} />
    ))}</div>
    : <div className="th-empty">{empty}</div>)

  const noHits = q && peopleHits.length === 0 && eventHits.length === 0 && mutedHits.length === 0

  return (
    <>
      <p className="th-lead rise">{lead.effects}</p>
      <HubSearch value={query} onChange={onQuery} placeholder={SEARCH.effects} />
      {noHits ? <NoHits query={q} onClear={() => onQuery('')} /> : (
        <>
          {(!q || peopleHits.length > 0) && (
            <HubFold id={G_PEOPLE} icon="t-people" label={EFFECT_GROUPS.people} hint={EFFECT_GROUPS.peopleHint}
              count={groupCount(q, q ? peopleHits.length : people.length)}
              open={isOpen(G_PEOPLE)} onToggle={() => toggle(G_PEOPLE)}>
              {cards(peopleHits, EMPTY.effectsPeople)}
            </HubFold>
          )}
          {(!q || eventHits.length > 0) && (
            <HubFold id={G_EVENTS} icon="t-calendar" label={EFFECT_GROUPS.events} hint={EFFECT_GROUPS.eventsHint}
              count={groupCount(q, q ? eventHits.length : events.length)}
              open={isOpen(G_EVENTS)} onToggle={() => toggle(G_EVENTS)}>
              {cards(eventHits, EMPTY.effectsEvents)}
            </HubFold>
          )}
          {((!q && muted.length > 0) || mutedHits.length > 0) && (
            <HubFold id={G_MUTED} icon="t-mute" label={MUTED_GROUP} hint={MUTED_HINT.effects}
              count={groupCount(q, q ? mutedHits.length : muted.length)}
              open={isOpen(G_MUTED)} onToggle={() => toggle(G_MUTED)}>
              <div className="th-list">{mutedHits.map((s) => (
                <HubRow
                  key={rowKey(s)}
                  rowKey={rowKey(s)}
                  icon={s.kind === 'person' ? 't-people' : eventIcon(s.key)}
                  accent={ACCENT}
                  text={s.label}
                  query={q}
                  sub={effectSubjectKindLabel(s.kind, s.effects.length)}
                  why={{ text: whyText('user', null), icon: 't-mute' }}
                  muted
                  onMute={(on) => mute(s, on)}
                  onForget={() => onForget(s)}
                />
              ))}</div>
            </HubFold>
          )}
        </>
      )}
      <p className="th-foot"><b>{FOOT.effects[0]}</b>{FOOT.effects[1]}</p>
    </>
  )
}

/** One subject = one glass card (prototype `effCard`): a monogram or event well, the name, the
 *  ⋯ verbs (Elhallgattatom / Elfelejtem), then the flat indicator rows. */
function EffectCard({ subject: s, index, query, onMute, onForget }: {
  subject: EffectSubject
  index: number
  query: string
  onMute: () => void
  onForget: () => void
}) {
  const sentence = s.kind === 'person'
    ? (e: EffectSubject['effects'][number]) => personEffectSentence(s.label, e)
    : (e: EffectSubject['effects'][number]) => eventEffectSentence(s.key, e)
  return (
    <div className="th-eff glass rise" data-row={rowKey(s)} style={{ '--c': ACCENT, '--i': index } as CSSProperties}>
      <div className="th-eh">
        {s.kind === 'person'
          ? <span className="th-mono" aria-hidden="true" style={{ '--c': ACCENT } as CSSProperties}>{s.label.charAt(0)}</span>
          : <span className="uv-well" aria-hidden="true"><Icon3D name={eventIcon(s.key)} size={30} /></span>}
        <span className="t">
          <b><Highlight text={s.label} query={query} /></b>
          <small>{effectSubjectKindLabel(s.kind, s.effects.length)}</small>
        </span>
      </div>
      <HubActs muted={false} note="effect" onMute={onMute} onForget={onForget} />
      <EffectRows effects={s.effects} sentence={sentence} />
    </div>
  )
}

function DashCard({ icon, text }: { icon: Icon3DName; text: string }) {
  return (
    <div className="tf-dash tud9-dash rise" style={{ '--d': '0ms' } as CSSProperties}>
      <Icon3D name={icon} size={28} />
      <span>{text}</span>
    </div>
  )
}
