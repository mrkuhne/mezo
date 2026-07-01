// ============================================================
// Mezo · ImportItemSheet
// 3-phase scrape-import wizard for adding a new Kamra item:
//   input  → URL field + source picker + inert quick-import chips
//   scraping → SourceBadge + 5 ScrapeStep rows (auto-advances)
//   preview → scraped result card (macros + micros) + toolchips
// Ports prototype fuel-kamra.jsx:508-709 faithfully.
// ============================================================
import { useEffect, useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { StatCell } from '@/shared/ui/StatCell'
import { SourceBadge } from '@/features/fuel/components/SourceBadge'
import { NovaDot } from '@/features/fuel/components/NovaDot'
import { ToolChipRow } from '@/shared/ui/ToolChipRow'
import type { Tool } from '@/shared/ui/ToolChip'
import { type PantrySourceKey } from '@/data/pantrySources'
import type { NovaGroup } from '@/data/nova'

type Phase = 'input' | 'scraping' | 'preview'

interface SourceOption { id: PantrySourceKey; label: string; hint: string }

const sources: SourceOption[] = [
  { id: 'kifli.hu', label: 'kifli.hu', hint: 'termék-url vagy keresés' },
  { id: 'myprotein.hu', label: 'myprotein', hint: 'supplement url' },
  { id: 'tesco.hu', label: 'tesco', hint: 'online katalógus' },
  { id: 'manual', label: 'Kézi', hint: 'saját bevitel' },
]

// Fake preview data (scraped fixture)
const preview = {
  name: 'Görög joghurt 10% · 500g',
  brand: 'Mizo',
  macros: { kcal: 119, p: 6.0, c: 4.0, f: 9.0 },
  per: 100,
  unit: 'g',
  price: '1 790 Ft',
  pkg: '500g pohár',
  nova: 3 as NovaGroup,
  micros: [
    { name: 'Ca', pct: 78 },
    { name: 'B12', pct: 64 },
    { name: 'Casein', pct: 88 },
  ],
}

const previewTools: Tool[] = [
  { type: 'read', name: 'fetch_product', args: 'url' },
  { type: 'compute', name: 'extractMacros', args: 'html' },
  { type: 'compute', name: 'classifyNOVA', args: 'items=1' },
]

export function ImportItemSheet({ onClose }: { onClose: () => void }) {
  const [source, setSource] = useState<PantrySourceKey>('kifli.hu')
  const [url, setUrl] = useState('')
  const [phase, setPhase] = useState<Phase>('input')

  useEffect(() => {
    if (phase !== 'scraping') return
    const t = setTimeout(() => setPhase('preview'), 1400)
    return () => clearTimeout(t)
  }, [phase])

  return (
    <Sheet onClose={onClose} labelledBy="import-item-title">
      {(close) => (
        <>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div className="col">
              <Eyebrow brand>Import · scrape</Eyebrow>
              <div id="import-item-title" className="h-display size-md" style={{ marginTop: 4 }}>Új tétel a Kamrába</div>
            </div>
            <button className="chip" aria-label="Bezárás" onClick={close} style={{ padding: '6px 8px' }}>
              <Icon name="x" size={12} />
            </button>
          </div>

          <p className="text-secondary" style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 14 }}>
            A Mezo lehúzza a termékadatokat — makrók, ár, csomagolás, mikrótápanyag-profil — és katalógusba teszi. Receptbe és napi logolásba is használhatod.
          </p>

          {/* Source picker */}
          <div className="row gap-xs flex-wrap" style={{ marginBottom: 12 }}>
            {sources.map((s) => (
              <button
                key={s.id}
                onClick={() => { setSource(s.id); setPhase('input') }}
                className={'chip' + (source === s.id ? ' brand' : '')}
                style={{ fontSize: 10, padding: '8px 12px' }}
              >{s.label}</button>
            ))}
          </div>

          {phase === 'input' && (
            <>
              <div className="card notch-4" style={{ padding: '10px 12px', marginBottom: 10 }}>
                <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>URL · {source}</span>
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder={'https://' + source + '/...'}
                  style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 4, width: '100%', fontFamily: 'var(--ff-mono)' }}
                />
              </div>

              <div className="card notch-4" style={{ padding: 12, marginBottom: 14, background: 'var(--surface-1)' }}>
                <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>VAGY · gyors-import</span>
                <div className="row gap-xs mt-sm flex-wrap">
                  <button className="chip" style={{ fontSize: 9, padding: '6px 10px' }}>
                    <Icon name="camera" size={11} /> Címke fotó
                  </button>
                  <button className="chip" style={{ fontSize: 9, padding: '6px 10px' }}>
                    <Icon name="tool" size={11} /> Vonalkód
                  </button>
                  <button className="chip" style={{ fontSize: 9, padding: '6px 10px' }}>
                    <Icon name="mic" size={11} /> Diktálás
                  </button>
                </div>
              </div>

              <div className="row gap-sm">
                <button className="cta-ghost notch-4 flex-1" onClick={close}>Mégse</button>
                <button className="cta-primary notch-4 flex-1" onClick={() => setPhase('scraping')}>
                  <Icon name="send" size={14} /> Adatok lehúzása
                </button>
              </div>
            </>
          )}

          {phase === 'scraping' && (
            <div className="card notch-12" style={{
              padding: 24, textAlign: 'center',
              background: 'color-mix(in srgb, var(--brand-glow) 4%, transparent)',
              borderColor: 'var(--border-brand)',
            }}>
              <Icon name="tool" size={20} color="var(--brand-glow)" />
              <div style={{ fontFamily: 'var(--ff-display)', fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginTop: 10 }}>
                Scraping <SourceBadge source={source} size="lg" />
              </div>
              <div className="col gap-xs mt-md" style={{ alignItems: 'flex-start', textAlign: 'left', maxWidth: 280, margin: '16px auto 0' }}>
                <ScrapeStep label="HTML fetch" done />
                <ScrapeStep label="Makró-extrakció" done />
                <ScrapeStep label="Mikrótápanyag-density becslés" active />
                <ScrapeStep label="NOVA-klasszifikáció" />
                <ScrapeStep label="Ár + csomag normalizálás" />
              </div>
            </div>
          )}

          {phase === 'preview' && (
            <>
              <div className="card notch-4" style={{
                padding: 14, marginBottom: 12,
                background: 'color-mix(in srgb, var(--brand-glow) 4%, transparent)',
                borderColor: 'var(--border-brand)',
              }}>
                <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
                  <Eyebrow brand>Beolvasva</Eyebrow>
                  <span className="label-mono brand" style={{ fontSize: 9 }}>0.91 confidence</span>
                </div>
                <div style={{ fontFamily: 'var(--ff-display)', fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.15 }}>
                  {preview.name}
                </div>
                <div className="row gap-sm mt-xs" style={{ alignItems: 'center' }}>
                  <SourceBadge source={source} />
                  <span className="text-tertiary" style={{ fontSize: 11, fontFamily: 'var(--ff-mono)' }}>{preview.brand}</span>
                  <NovaDot nova={preview.nova} />
                </div>

                <div className="card notch-4 row" style={{ padding: 10, marginTop: 12, justifyContent: 'space-between', background: 'var(--surface-1)' }}>
                  <StatCell label="kcal / 100g" val={String(preview.macros.kcal)} sub="" color="var(--brand-glow)" />
                  <StatCell label="P" val={preview.macros.p + 'g'} sub="" color="var(--cat-physiology)" />
                  <StatCell label="C" val={preview.macros.c + 'g'} sub="" color="var(--warning)" />
                  <StatCell label="F" val={preview.macros.f + 'g'} sub="" color="var(--cat-preference)" />
                </div>

                <div className="row mt-md" style={{ justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 11, color: 'var(--text-primary)' }}>{preview.price}</span>
                  <span className="label-mono text-tertiary" style={{ fontSize: 10 }}>{preview.pkg}</span>
                </div>

                <div className="row gap-xs mt-md flex-wrap">
                  {preview.micros.map((m, i) => (
                    <span key={i} className="chip" style={{ fontSize: 9, padding: '3px 7px' }}>
                      {m.name} · {m.pct}%
                    </span>
                  ))}
                </div>
              </div>

              <ToolChipRow tools={previewTools} />

              <div className="row gap-sm">
                <button className="cta-ghost notch-4 flex-1" onClick={() => setPhase('input')}>Vissza</button>
                <button className="cta-primary notch-4 flex-1" onClick={close}>
                  <Icon name="check" size={14} /> Polcra
                </button>
              </div>
            </>
          )}

          <div style={{ height: 24 }} />
        </>
      )}
    </Sheet>
  )
}

function ScrapeStep({ label, done, active }: { label: string; done?: boolean; active?: boolean }) {
  return (
    <div className="row gap-sm" style={{ alignItems: 'center', width: '100%' }}>
      <div style={{
        width: 12, height: 12, borderRadius: '50%',
        background: done ? 'var(--brand-glow)' : active ? 'transparent' : 'var(--surface-2)',
        border: '1.5px solid ' + (done ? 'var(--brand-glow)' : active ? 'var(--brand-glow)' : 'var(--border-strong)'),
        flexShrink: 0,
        animation: active ? 'pulse 1.2s ease-in-out infinite' : 'none',
      }} />
      <span style={{
        fontSize: 12,
        color: done ? 'var(--text-primary)' : active ? 'var(--text-primary)' : 'var(--text-tertiary)',
        flex: 1,
      }}>{label}</span>
      {done && <Icon name="check" size={10} color="var(--brand-glow)" />}
      {active && <span className="label-mono brand" style={{ fontSize: 9 }}>…</span>}
    </div>
  )
}
