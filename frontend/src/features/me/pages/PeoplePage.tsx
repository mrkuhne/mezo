// ============================================================
// Mezo · PeoplePage — Emberek S3 hub (mezo-06o0.2)
// Source of truth: docs/design_2.0/prototypes/src/emberek-body.html renderHub() +
// emberek-head.html `.tile/.t-*/.spotwrap/.badge/.facepile/.hwide/.snip` (×1.18).
//
// This is the WeekHub-pattern rewrite: the old single-page grid + filter chips + mention
// feed is GONE from here — those live in the sibling "A köröm" / "Említések" pages Task
// 3–5 own. This page is only a hero + 3-cell stat strip + 4 navigation tiles (each its
// own route, `navigate()`, never a local show/hide) + the Mezo-band chat handoff. ADR 0032
// still applies: this page owns its own header (‹ Én back chip + Log/Új személy actions),
// unchanged from the pre-hub PeoplePage (same PersonLogSheet/PersonEditSheet wiring).
//
// Honest states (per handoff and Task 1's `hubLines`): a null down/up person renders
// '—', never a fabricated name. S4 (mezo-06o0.3): the Jelöltek tile now carries the real
// `usePeople().candidates` count as its `.ppl-hub-badge` and names the first candidate on
// the tile-line — the honest quiet copy only when there is truly no candidate.
// ============================================================
import { useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { MozaikPage, PageBody, PageHead, PageHero, StatCell, StatStrip } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { ClayIcon } from '@/shared/ui/clay'
import { usePeople } from '@/data/hooks'
import { localDateString } from '@/shared/lib/dates'
import { hubLines } from '@/features/me/logic/peopleDerive'
import { useChatHandoff } from '@/features/me/logic/useChatHandoff'
import { PersonLogSheet } from '@/features/me/sheets/PersonLogSheet'
import { PersonEditSheet } from '@/features/me/sheets/PersonEditSheet'

const d = (ms: number) => ({ '--d': `${ms}ms` } as CSSProperties)

/** The Mezo-band sentence — down-trending person first (the thing worth checking on),
 *  then the week's top name (a quieter, positive observation), then the honest empty-circle
 *  line when there is simply nothing derived yet. */
function mezoSentence(topName: string | null, downName: string | null): string {
  if (downName) return `„${downName} hangulata lejt az utóbbi hetekben — ránézel?”`
  if (topName) return `„${topName} volt e héten a legtöbbet veled — jó ránézni, mit adott.”`
  return '„Ahogy írsz, magától épül itt a kapcsolati kép.”'
}

export function PeoplePage() {
  const navigate = useNavigate()
  const { people, mentions, candidates, logMention } = usePeople()
  const chat = useChatHandoff()
  const [logOpen, setLogOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  const lines = hubLines(people, mentions, new Date())
  const faces = people.slice(0, 4)

  return (
    <MozaikPage tone="rose">
      <PageHead onBack={() => navigate('/me')} label="‹ Én">
        <button
          type="button"
          className="pgact"
          onClick={() => setEditOpen(true)}
          style={{ background: 'var(--mz-cell-rose-bg)', color: 'var(--mz-cell-rose-ink)' }}
        >
          ＋ Új személy
        </button>
        <button
          type="button"
          className="pgact"
          onClick={() => setLogOpen(true)}
          style={{ background: 'var(--mz-cell-rose-bg)', color: 'var(--mz-cell-rose-ink)' }}
        >
          <ClayIcon name="i-mikrofon" size={12} /> Log
        </button>
      </PageHead>

      <PageHero
        icon="i-emberek"
        name="Kapcsolatok"
        big={people.length}
        sub={`aktív kör · ${lines.mentionsThisWeek} említés e héten`}
      />

      <PageBody>
        <EntranceGroup>
          <StatStrip className="rise">
            <StatCell value={lines.mentionsThisWeek} label="említés · hét" />
            <StatCell value={lines.topName ?? '—'} label="legtöbbet említett" />
            <StatCell
              value={lines.downName ? `${lines.downName} ↘` : '—'}
              label="hangulat-lejtő"
            />
          </StatStrip>

          <div className="mz-mosaic">
            <button
              type="button"
              className="ppl-hub-tile ppl-hub-gold rise"
              style={d(60)}
              onClick={() => navigate('/me/people/jeloltek')}
              aria-label="Jelöltek"
            >
              <span className="mz-eyebrow" style={{ color: 'var(--mz-cell-gold-ink)' }}>Jelöltek</span>
              <div className="ppl-hub-spot">
                <span className="ppl-hub-anchor">
                  <ClayIcon name="i-kristaly" size={40} />
                  {candidates.length > 0 && <span className="ppl-hub-badge">{candidates.length}</span>}
                </span>
              </div>
              <div className="ppl-hub-line">
                {candidates.length > 0
                  ? `${candidates[0].name} · visszatérő név`
                  : 'nincs új arc — az éjszakai kör figyel'}
              </div>
            </button>

            <button
              type="button"
              className="ppl-hub-tile ppl-hub-rose rise"
              style={d(90)}
              onClick={() => navigate('/me/people/kor')}
              aria-label="A köröm"
            >
              <span className="mz-eyebrow" style={{ color: 'var(--mz-cell-rose-ink)' }}>A köröm</span>
              <div className="ppl-hub-spot">
                <div className="ppl-facepile">
                  {faces.map((p) => (
                    <span key={p.id} className="ppl-fp-avat">{p.initial}</span>
                  ))}
                </div>
              </div>
              <div className="ppl-hub-line">
                {people.length} személy · {lines.topName ?? '—'} a legaktívabb
              </div>
            </button>

            <button
              type="button"
              className="ppl-hub-tile ppl-hub-sky rise"
              style={d(120)}
              onClick={() => navigate('/me/people/emlitesek')}
              aria-label="Említések"
            >
              <span className="mz-eyebrow" style={{ color: 'var(--mz-cell-sky-ink)' }}>Említések</span>
              <div className="ppl-hub-spot">
                <ClayIcon name="i-naplo" size={40} />
                {lines.flagCount > 0 && (
                  <span className="ppl-hub-badge ppl-hub-badge-alert">{lines.flagCount}</span>
                )}
              </div>
              <div className="ppl-hub-line">
                {lines.mentionsThisWeek} e héten · {lines.flagCount > 0 ? `${lines.flagCount} figyelem-jelzés` : 'minden nyugodt'}
              </div>
            </button>

            <button
              type="button"
              className="ppl-hub-tile ppl-hub-lav rise"
              style={d(150)}
              onClick={() => navigate('/me/people/heti')}
              aria-label="Heti kép"
            >
              <span className="mz-eyebrow" style={{ color: 'var(--mz-cell-lav-ink)' }}>Heti kép</span>
              <div className="ppl-hub-spot">
                <ClayIcon name="i-heti" size={40} />
              </div>
              <div className="ppl-hub-line">
                {lines.downName || lines.upName
                  ? [lines.downName && `${lines.downName} ↘`, lines.upName && `${lines.upName} ↗`]
                      .filter(Boolean)
                      .join(' · ')
                  : 'nincs kiugró irány e héten'}
              </div>
            </button>
          </div>

          <button
            type="button"
            className="ppl-hub-wide rise"
            style={d(190)}
            onClick={() => chat.open({ kind: 'day', date: localDateString() })}
            disabled={chat.pending}
          >
            <div className="mz-tile-top">
              <ClayIcon name="i-mezo" size={24} />
              <span className="mz-eyebrow" style={{ color: 'var(--mz-cell-coral-ink)', marginLeft: 8 }}>
                Mezo · észrevétel
              </span>
              <span style={{ marginLeft: 'auto', color: 'var(--mz-ink-mut)' }} aria-hidden="true">›</span>
            </div>
            <div className="ppl-hub-snip">{mezoSentence(lines.topName, lines.downName)}</div>
          </button>
        </EntranceGroup>
      </PageBody>

      {logOpen && (
        <PersonLogSheet
          onClose={() => setLogOpen(false)}
          onSave={logMention}
          people={people}
        />
      )}

      {editOpen && (
        <PersonEditSheet
          person={null}
          onClose={() => setEditOpen(false)}
        />
      )}
    </MozaikPage>
  )
}
