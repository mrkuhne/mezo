import { useNavigate } from 'react-router-dom'
import { Icon, type IconName } from '@/shared/ui/Icon'

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
            <Icon name="anchor" size={20} color="var(--sub)" />
            <span className="eyebrow" style={{ color: 'var(--sub)' }}>Anchor mode · csendben</span>
          </div>
          <button className="chip" onClick={() => navigate('/today')} style={{ fontSize: 9 }}>
            Kilépés
          </button>
        </div>
        <div className="page-title" style={{ marginTop: 16, color: 'var(--ink)', lineHeight: 1.1 }}>
          Itt vagyok.<br/>
          <span style={{ color: 'var(--coral-deep)' }}>Lassítsunk együtt.</span>
        </div>
      </div>

      <div style={{ padding: '24px' }}>
        <div style={{ padding: 18, borderRadius: 20, background: 'var(--warm)' }}>
          <p style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.6 }}>
            Tegnap éjszaka 5.2h volt, és ezen a héten ez a harmadik ilyen. Tudom hogy érzed magad — ne a Pull Day-ről beszélgessünk most. Hanem arról ami valóban kell.
          </p>
        </div>
      </div>

      <div style={{ padding: '0 24px' }}>
        <div className="eyebrow mt-md" style={{ marginBottom: 12, color: 'var(--sub)' }}>Mai három horgony</div>
        <div className="col gap-md">
          {anchors.map((a, i) => (
            <button key={i} style={{
              padding: 16, borderRadius: 18, display: 'flex', gap: 14, alignItems: 'center',
              background: 'var(--surface)', boxShadow: 'var(--np-shadow-row)', textAlign: 'left',
            }}>
              <Icon name={a.icon} size={22} color="var(--coral-deep)" />
              <div className="col flex-1">
                <span style={{ fontSize: 15, color: 'var(--ink)' }}>{a.label}</span>
                <span style={{ fontSize: 12, color: 'var(--faint)', marginTop: 2 }}>{a.sub}</span>
              </div>
              <Icon name="check" size={18} color="var(--faint)" />
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '24px' }}>
        <div style={{ padding: 16, borderRadius: 16, background: 'transparent', border: '1px dashed var(--line)' }}>
          <span className="label-mono" style={{ fontSize: 9, color: 'var(--sub)' }}>Heti terv · szünetel</span>
          <p style={{ fontSize: 13, marginTop: 8, color: 'var(--sub)', lineHeight: 1.5 }}>
            A Pull Day és a péntek volleyball kivettem a naptárból. Amikor 3 napon át újra erőd lesz, magunktól újraindítjuk.
          </p>
        </div>
      </div>
    </>
  )
}
