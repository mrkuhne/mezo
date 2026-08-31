// ============================================================
// Mezo · PeopleKorPage — Emberek S3 hub, "A köröm" sibling page (mezo-06o0.2)
// Source of truth: docs/design_2.0/prototypes/src/emberek-body.html renderKor()/
// sparkHtml()/ctxDots(), emberek-head.html `.pgrid`/`.persont`/`.pspark`/`.ctxdots`
// (×1.18, ported onto the already-existing `.ppl-grid`/`.ppl-tile` family as
// `.ppl-spark`/`.ppl-ctxdots`). Every tile's mood-trend spark and context dots are
// Task 1's real derivations (`trendHeights`/`contextBreakdown`) over this person's own
// affectTrend/mentions — never a decorative or fabricated bar; PersonCard itself keeps
// the honest empty rendering (no trend points ⇒ no spark container, no context-labeled
// mentions ⇒ no ctxdots container).
//
// Card tap navigates straight to `/me/people/:id` (a later task's detail route — not
// registered yet, same "real navigate() now, real route later" idiom Task 2 used for
// the hub's own sibling tiles).
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MozaikPage, PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { usePeople } from '@/data/hooks'
import { contextBreakdown, trendHeights } from '@/features/me/logic/peopleDerive'
import { PersonCard } from '@/features/me/components/PersonCard'
import { PersonEditSheet } from '@/features/me/sheets/PersonEditSheet'

// 16px prototype spark height × 1.18 frame scale ≈ 19px.
const SPARK_MAX_PX = 19

export function PeopleKorPage() {
  const navigate = useNavigate()
  const { people, mentions } = usePeople()
  const [editOpen, setEditOpen] = useState(false)

  return (
    <MozaikPage tone="rose">
      <PageHead onBack={() => navigate('/me/people')} label="‹ Kapcsolatok">
        <button
          type="button"
          className="pgact"
          onClick={() => setEditOpen(true)}
          style={{ background: 'var(--mz-cell-rose-bg)', color: 'var(--mz-cell-rose-ink)' }}
        >
          ＋ Új személy
        </button>
      </PageHead>

      <PageHero icon="i-emberek" name="A köröm" big={people.length} />

      <PageBody>
        <EntranceGroup>
          <div className="ppl-grid">
            {people.map((person, i) => {
              const personMentions = mentions.filter((m) => m.person_id === person.id)
              return (
                <PersonCard
                  key={person.id}
                  person={person}
                  delayMs={i * 40}
                  spark={trendHeights(person.affectTrend, SPARK_MAX_PX)}
                  ctxDots={contextBreakdown(personMentions).slice(0, 3).map((s) => s.ctx)}
                  onTap={() => navigate(`/me/people/${person.id}`)}
                />
              )
            })}
          </div>
        </EntranceGroup>
      </PageBody>

      {editOpen && (
        <PersonEditSheet person={null} onClose={() => setEditOpen(false)} />
      )}
    </MozaikPage>
  )
}
