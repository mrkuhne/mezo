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
//
// mezo-06o0.11: the Mezo-band is GONE from this hub. It was the one cell here that was
// neither a stat nor a route — a companion sentence about a person, on the page whose whole
// job is "pick where to go next", and the only cell that could talk about someone while the
// four tiles below it said the circle was quiet. `usePeople().mezoNote` is still produced
// server-side and still rendered where it belongs (the sub-pages and the companion feed);
// only this hub stops showing it. With the band went the page's chat handoff (ADR 0032) —
// nothing else on the hub opened chat.
//
// Üveg (mezo-me75u.7, prototype uveg-en2-body.html `emberek()`): a frameless rose t-people halo
// hero, flat stat cells, and the four tiles as glass in their own accent (Jelöltek gold with the
// t-lens + count badge, A köröm rose with a tone-ringed facepile, Említések sky with the t-chat +
// coral flag badge, Heti kép lavender with the t-calendar). Header: the lit rose „Log" pill with
// the t-mic, the flat „＋ Új személy" pill. CSS: `── uveg en2 emberek (` in prototype.css.
// ============================================================
import { useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { MozaikPage, PageBody, PageHead, PageHero, StatCell, StatStrip } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { Icon3D } from '@/shared/ui/clay'
import { usePeople } from '@/data/hooks'
import { hubLines } from '@/features/me/logic/peopleDerive'
import { toneColor } from '@/features/me/logic/peopleVisuals'
import { PersonLogSheet } from '@/features/me/sheets/PersonLogSheet'
import { PersonEditSheet } from '@/features/me/sheets/PersonEditSheet'

const d = (ms: number) => ({ '--d': `${ms}ms` } as CSSProperties)

export function PeoplePage() {
  const navigate = useNavigate()
  const { people, mentions, candidates, logMention } = usePeople()
  const [logOpen, setLogOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  const lines = hubLines(people, mentions, new Date())
  const faces = people.slice(0, 4)

  return (
    <MozaikPage tone="rose" className="ppl-page ppl-hub">
      <PageHead glass onBack={() => navigate('/me')} label="Én">
        {/* mezo-06o0.12 — the back chip alone on the left, BOTH actions against the right edge,
            Log first (the `margin-left: auto` on the first action). Üveg: Log is the lit rose
            pill, „＋ Új személy" the flat one — neither paints itself in the page wash
            (mezo-06o0.14). */}
        <button
          type="button"
          className="pgact ppl-act ppl-act-lit"
          onClick={() => setLogOpen(true)}
          style={{ marginLeft: 'auto' }}
        >
          <Icon3D name="t-mic" size={18} /> Log
        </button>
        <button type="button" className="pgact ppl-act ppl-act-flat" onClick={() => setEditOpen(true)}>
          ＋ Új személy
        </button>
      </PageHead>

      <PageHero
        art="t-people"
        accent="var(--dv-rose)"
        name="Kapcsolatok"
        big={people.length}
        sub={`aktív kör · ${lines.mentionsThisWeek} említés e héten`}
      />

      <PageBody>
        <EntranceGroup>
          <StatStrip className="rise ppl-stats">
            <StatCell value={lines.mentionsThisWeek} label="említés · hét" />
            <StatCell value={lines.topName ?? '—'} label="legtöbbet említett" />
            <StatCell
              value={lines.downName ? `${lines.downName} ↘` : '—'}
              label="hangulat-lejtő"
            />
          </StatStrip>

          {/* mezo-06o0.14 — the strip and the mosaic touched: `.mz-statstrip` carries no bottom
              margin, and the house idiom is that the PAGE supplies the gap. */}
          <div className="mz-mosaic" style={{ marginTop: 11 }}>
            <button
              type="button"
              className="ppl-hub-tile ppl-hub-gold glass rise"
              style={d(60)}
              onClick={() => navigate('/me/people/jeloltek')}
              aria-label="Jelöltek"
            >
              <div className="ppl-hub-top">
                <Icon3D name="t-lens" size={42} />
                {candidates.length > 0 && <span className="ppl-hub-badge">{candidates.length}</span>}
              </div>
              <span className="mz-eyebrow">Jelöltek</span>
              <strong className="ppl-hub-main">{candidates.length > 0 ? candidates[0].name : 'Nincs új arc'}</strong>
              <span className="ppl-hub-line">
                {candidates.length > 0 ? 'új arc a szövegeidben' : 'az éjszakai kör figyel'}
              </span>
            </button>

            <button
              type="button"
              className="ppl-hub-tile ppl-hub-rose glass rise"
              style={d(90)}
              onClick={() => navigate('/me/people/kor')}
              aria-label="A köröm"
            >
              <div className="ppl-hub-top">
                <div className="ppl-facepile">
                  {faces.map((p) => (
                    <span key={p.id} className="ppl-fp-avat" style={{ '--c': toneColor(p.affect_baseline) } as CSSProperties}>
                      {p.initial}
                    </span>
                  ))}
                </div>
              </div>
              <span className="mz-eyebrow">A köröm</span>
              <strong className="ppl-hub-main">{people.length} személy</strong>
              <span className="ppl-hub-line">{lines.topName ?? '—'} a legaktívabb</span>
            </button>

            <button
              type="button"
              className="ppl-hub-tile ppl-hub-sky glass rise"
              style={d(120)}
              onClick={() => navigate('/me/people/emlitesek')}
              aria-label="Említések"
            >
              <div className="ppl-hub-top">
                <Icon3D name="t-chat" size={42} />
                {lines.flagCount > 0 && (
                  <span className="ppl-hub-badge ppl-hub-badge-alert">{lines.flagCount}</span>
                )}
              </div>
              <span className="mz-eyebrow">Említések</span>
              <strong className="ppl-hub-main">{lines.mentionsThisWeek} e héten</strong>
              <span className="ppl-hub-line">
                {lines.flagCount > 0 ? `${lines.flagCount} figyelem-jelzés` : 'minden nyugodt'}
              </span>
            </button>

            <button
              type="button"
              className="ppl-hub-tile ppl-hub-lav glass rise"
              style={d(150)}
              onClick={() => navigate('/me/people/heti')}
              aria-label="Heti kép"
            >
              <div className="ppl-hub-top">
                <Icon3D name="t-calendar" size={42} />
              </div>
              <span className="mz-eyebrow">Heti kép</span>
              <strong className="ppl-hub-main">
                {lines.downName || lines.upName
                  ? [lines.downName && `${lines.downName} ↘`, lines.upName && `${lines.upName} ↗`]
                      .filter(Boolean)
                      .join(' · ')
                  : '—'}
              </strong>
              <span className="ppl-hub-line">
                {lines.downName || lines.upName ? 'a hét iránya' : 'nincs kiugró irány e héten'}
              </span>
            </button>
          </div>

          <p className="ppl-foot rise" style={d(180)}>
            Az emberek a szövegeidből, a hangjegyeidből és a Mezo-beszélgetésekből kerülnek ide.
          </p>
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
