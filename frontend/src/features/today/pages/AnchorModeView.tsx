// ============================================================
// Mezo · AnchorModeView — the „rough day" full-screen recovery view, rendered by
// TodayPage when `?day=rough` (checked BEFORE the pending gate — see TodayPage).
// DS re-dress (mezo-setx.5.2): the muted anchor variant on the Mezo-edition
// tokens — the companion speaks in a CoachBubble re-tinted to the calm
// `--anchor-accent` amber (`.anch-coach`), the three anchors are ListItem-spec
// rows, and the paused-plan note wears the Fraunces empty-state voice. The
// shell wiring is untouched: AppLayout passes `anchor` to PhoneFrame from the
// same `useTodayScenario().anchorMode` this view renders under.
// The anchor rows are demo affordances (no handler yet — Phase-3 signal work);
// behavior unchanged by the re-dress.
// ============================================================
import { useNavigate } from 'react-router-dom'
import { CoachBubble } from '@/shared/ui/CoachBubble'
import { Icon, type IconName } from '@/shared/ui/Icon'

const anchors: { label: string; sub: string; icon: IconName }[] = [
  { label: 'Egy pohár víz', sub: 'Most. Egyszerű kezdet.', icon: 'drop' },
  { label: 'Egy fehérje-étkezés', sub: 'Bármi. 30g protein elég.', icon: 'fuel' },
  { label: '10 perces sétálás', sub: 'Friss levegő. Nem futás.', icon: 'anchor' },
]

export function AnchorModeView() {
  const navigate = useNavigate()
  return (
    <div className="anch">
      <div className="anch-head">
        <div className="anch-head-row">
          <div className="anch-head-id">
            <Icon name="anchor" size={20} color="var(--text-secondary)" />
            <span className="eyebrow anch-eyebrow">Anchor mode · csendben</span>
          </div>
          <button className="chip" onClick={() => navigate('/today')}>
            Kilépés
          </button>
        </div>
        <h1 className="page-title anch-title">
          Itt vagyok.<br />
          <span className="anch-accent">Lassítsunk együtt.</span>
        </h1>
      </div>

      <CoachBubble eyebrow="Mezo" className="anch-coach">
        Tegnap éjszaka 5.2h volt, és ezen a héten ez a harmadik ilyen. Tudom hogy érzed magad — ne a Pull Day-ről beszélgessünk most. Hanem arról ami valóban kell.
      </CoachBubble>

      <div className="anch-block">
        <div className="eyebrow anch-eyebrow anch-zoneline">Mai három horgony</div>
        <div className="anch-rows">
          {anchors.map((a, i) => (
            <button key={i} type="button" className="anch-row np-press">
              <span className="anch-row-ic" aria-hidden="true">
                <Icon name={a.icon} size={20} color="var(--anchor-accent)" />
              </span>
              <span className="anch-row-tx">
                <span className="anch-row-t1">{a.label}</span>
                <span className="anch-row-t2">{a.sub}</span>
              </span>
              <Icon name="check" size={18} color="var(--text-disabled)" />
            </button>
          ))}
        </div>
      </div>

      <div className="anch-block">
        <div className="anch-paused">
          <span className="anch-paused-l">Heti terv · szünetel</span>
          <p>
            A Pull Day és a péntek volleyball kivettem a naptárból. Amikor 3 napon át újra erőd lesz, magunktól újraindítjuk.
          </p>
        </div>
      </div>
    </div>
  )
}
