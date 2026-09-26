import { useId } from 'react'
import { Link } from 'react-router-dom'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'

/**
 * mezo-ms9a shell, repointed in Task 11 (mezo-zpxv7): the base-view doors (glass rows →
 * ?view=tenyek|kategoriak) + a gold glass pointer to the Rólad decision inbox, which is now
 * the ONE place a candidate is decided ("egy döntés egy helyen él"). The inbox cards
 * (FactCandidateCard/LifeEventCandidateCard) moved to BoopAboutPage/RoladInbox in Task 10 —
 * this component no longer renders or wires them.
 */
export function KnowledgeBaseView(props: {
  /** A társ-kapcsoló 404-je (mezo-ms9a): CSAK a tény-felületet fedi — a Tények csempe helyett a
   *  degraded kártya áll, a Kategóriák csempe a gráf-hookok saját (független) adatával renderel. */
  degraded: boolean
  /** Task 11 (mezo-zpxv7): a Rólad oldalon döntésre váró jelöltek száma — fact candidates
   *  (degraded alatt 0) + life/season candidates. A shell (KnowledgeListPage) számolja. */
  pendingCount: number
  facts: { length: number }
  buckets: { inPrompt: unknown[]; waiting: unknown[]; off: unknown[] }
  kindCount: number
  kategLine: string
  onNavigate: (view: 'tenyek' | 'kategoriak' | 'profil') => void
}) {
  const { degraded, pendingCount, facts, buckets, kindCount, kategLine, onNavigate } = props

  return (
    <>
      {degraded ? (
        <div className="tf-dash tud9-dash rise" style={{ '--d': '0ms' } as React.CSSProperties}>
          <Icon3D name="t-info" size={28} />
          <span>A társ jelenleg nincs bekapcsolva — a tudástár most nem elérhető.</span>
        </div>
      ) : null}

      <div className="tf-rows">
        {pendingCount > 0 ? (
          <Link to="/mezo/rolad" className="glass tf-case tf-c-gold tf-s-gold rise" style={{ '--d': '0ms' } as React.CSSProperties}>
            <span className="tf-cmain">
              <Icon3D name="t-bell" size={36} />
              <span className="tf-ctxt">
                <span className="tf-ctitle">{pendingCount} javaslat vár rád a Rólad oldalon</span>
                <span className="tf-csub">Ott döntesz róluk: Igen, jegyezd meg · Pontosítom · Most ne · Nem igaz</span>
              </span>
              <span className="tf-chev" aria-hidden="true">›</span>
            </span>
          </Link>
        ) : (
          <p className="tud9-fn rise" style={{ '--d': '0ms' } as React.CSSProperties}>
            Nincs döntésre váró javaslat. Ha a csapat újat hoz, a Rólad oldalon kérdez meg.
          </p>
        )}
      </div>

      <section className="tud9-group rise">
        <h2 className="tud9-sech">A tudás</h2>
        <div className="tf-rows">
          {!degraded && (
            <DoorRow
              label="Tények" icon="t-note" accent="sage" badge={facts.length}
              line={`${buckets.inPrompt.length} a chatben · ${buckets.waiting.length} vár · ${buckets.off.length} kikapcsolva`}
              onClick={() => onNavigate('tenyek')}
            />
          )}
          <DoorRow
            label="Kategóriák" icon="t-graph" accent="lav" badge={kindCount}
            line={kategLine} onClick={() => onNavigate('kategoriak')}
          />
        </div>
      </section>
    </>
  )
}

/** A base-view door (prototype `rowg`): glass row, 3D icon, name + line, count badge. The
 *  accessible name stays the bare section name (as the old Mozaik tile's did); the line is
 *  its description. */
function DoorRow({ label, icon, accent, badge, line, onClick }: {
  label: string
  icon: Icon3DName
  accent: 'sage' | 'lav'
  badge: number
  line: string
  onClick: () => void
}) {
  const lineId = useId()
  return (
    <button type="button" className={`glass tf-rowg tf-c-${accent} tud9-door`} aria-label={label} aria-describedby={lineId} onClick={onClick}>
      <Icon3D name={icon} size={40} />
      <span className="tf-rowtxt">
        <span className="tf-rowname">{label}</span>
        <span className="tf-rowsub" id={lineId}>{line}</span>
      </span>
      <span className="tf-rowbadge">{badge}</span>
    </button>
  )
}
