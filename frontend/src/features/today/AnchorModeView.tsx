import { useNavigate } from 'react-router-dom'
import { Icon, type IconName } from '@/components/ui/Icon'

const anchors: { label: string; sub: string; icon: IconName }[] = [
  { label: 'Egy pohár víz', sub: 'Most. Egyszerű kezdet.', icon: 'drop' },
  { label: 'Egy fehérje-étkezés', sub: 'Bármi. 30g protein elég.', icon: 'fuel' },
  { label: '10 perces sétálás', sub: 'Friss levegő. Nem futás.', icon: 'anchor' },
]

export function AnchorModeView() {
  const navigate = useNavigate()
  return (
    <>
      <div style={{ padding: '16px 24px 6px' }}>
        <div className="row gap-sm" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="row gap-sm">
            <Icon name="anchor" size={20} color="var(--anchor-accent)" />
            <span className="eyebrow" style={{ color: 'var(--anchor-accent)' }}>Anchor mode · csendben</span>
          </div>
          <button className="chip" onClick={() => navigate('/today')} style={{ fontSize: 9 }}>
            Kilépés
          </button>
        </div>
        <div className="page-title" style={{ marginTop: 16, color: 'var(--anchor-text)', lineHeight: 1.1 }}>
          Itt vagyok.<br/>
          <span style={{ color: 'var(--anchor-accent)' }}>Lassítsunk együtt.</span>
        </div>
      </div>

      <div style={{ padding: '24px' }}>
        <div className="card notch-12" style={{
          padding: 18, background: 'var(--anchor-surface)',
          borderColor: 'rgba(217, 119, 87, 0.3)',
        }}>
          <p style={{ fontSize: 14, color: 'var(--anchor-text)', lineHeight: 1.6 }}>
            Tegnap éjszaka 5.2h volt, és ezen a héten ez a harmadik ilyen. Tudom hogy érzed magad — ne a Pull Day-ről beszélgessünk most. Hanem arról ami valóban kell.
          </p>
        </div>
      </div>

      <div style={{ padding: '0 24px' }}>
        <div className="eyebrow mt-md" style={{ marginBottom: 12, color: 'var(--anchor-accent)' }}>Mai három horgony</div>
        <div className="col gap-md">
          {anchors.map((a, i) => (
            <button key={i} className="card notch-8" style={{
              padding: 16, display: 'flex', gap: 14, alignItems: 'center',
              background: 'var(--anchor-surface)', borderColor: 'rgba(217, 119, 87, 0.2)', textAlign: 'left',
            }}>
              <Icon name={a.icon} size={22} color="var(--anchor-accent)" />
              <div className="col flex-1">
                <span style={{ fontSize: 15, color: 'var(--anchor-text)' }}>{a.label}</span>
                <span style={{ fontSize: 12, color: 'rgba(232, 221, 211, 0.5)', marginTop: 2 }}>{a.sub}</span>
              </div>
              <Icon name="check" size={18} color="rgba(232, 221, 211, 0.3)" />
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '24px' }}>
        <div className="card notch-8" style={{ padding: 16, background: 'transparent', border: '1px dashed rgba(217, 119, 87, 0.3)' }}>
          <span className="label-mono" style={{ fontSize: 9, color: 'var(--anchor-accent)' }}>Heti terv · szünetel</span>
          <p style={{ fontSize: 13, marginTop: 8, color: 'rgba(232, 221, 211, 0.7)', lineHeight: 1.5 }}>
            A Pull Day és a péntek volleyball kivettem a naptárból. Amikor 3 napon át újra erőd lesz, magunktól újraindítjuk.
          </p>
        </div>
      </div>
    </>
  )
}
