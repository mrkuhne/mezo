// ============================================================
// Mezo · KalauzWelcome — a T0 első indítás teljes képernyős lapozója (mezo-gb1s.4, S2b spec §3).
// Domain-mentes: a lépéseket adatként kapja, a seen-állapotról semmit nem tud — azt a
// TutorialProvider intézi az `onClose(reason, step)` alapján (a KalauzSheet szerződése).
// A típus-unió SZÁNDÉKOSAN helyben van újradeklarálva, nem a registry/welcome.ts-ből importálva:
// a shared/ui nem függhet a features rétegtől (AGENTS.md §rétegek).
//
// Full-screen recept: LevelUpScreen.tsx — portál a .phone-screen-be, inset:0, fókusz mountkor
// + visszaadás unmountkor, Escape zár. A LogFlowPage portálja UGYANEZ a minta, de fókusz-kezelés
// NÉLKÜL — azt nem másoljuk.
//
// A11y (WAI-ARIA APG, Dialog Modal): tartalom-nehéz dialógusnál a fókusz egy tabindex=-1
// statikus elemre megy (a lépés címére), nem az első interaktív elemre — és LÉPÉSVÁLTÁSKOR
// ÚJRA, különben a „Tovább" képernyőolvasóval némán nem csinál semmit.
//
// Üveg (U10, mezo-me75u.10; prototípus uveg-reteg-body.html `udv()` + `.wel*`): felül a
// szemöldök-sor, alatta a keret nélküli levendula/arany halo-hős (az 1. lépésen az élő Mezo
// Boop), a demó (napszakok üveg csempéken 3D ikonnal · öt élő Boop · a „+" mögötti lapos
// csempék + levendula üveg Mezo-sor · pulzáló arany „?"), lent a láb.
// ============================================================
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/shared/lib/cn'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import { Boop, Icon3D, type BoopDomain, type Icon3DName } from '@/shared/ui/clay'
import { useReducedMotion } from '@/shared/hooks/useReducedMotion'

export interface KalauzWelcomeDaypart { key: string; label: string; icon: Icon3DName; size: number; sub: string }
/** `key` = a terület (navModel domain-id): a demó ennek az élő Boopját rajzolja. */
export interface KalauzWelcomeTab { key: BoopDomain; label: string; voice: string }
export interface KalauzWelcomeTile { label: string; icon: Icon3DName }

/** A terület akcentusa (üveg bible §2): a kiválasztott Boop fénye és a hangkártya `--c`-je. */
const DOMAIN_ACCENT: Record<BoopDomain, string> = {
  nap: 'var(--dv-amber)', train: 'var(--dv-coral)', fuel: 'var(--dv-sage)', mezo: 'var(--dv-lav)', me: 'var(--dv-rose)',
}
const DAYPART_ACCENT = ['var(--dv-amber)', 'var(--dv-coral)', 'var(--dv-lav)']
const hue = (c: string) => ({ '--c': c }) as CSSProperties

interface StepBase { title: string; voice: string }
export type KalauzWelcomeStep =
  | (StepBase & { kind: 'napszak'; dayparts: KalauzWelcomeDaypart[] })
  | (StepBase & { kind: 'tabbar'; tabs: KalauzWelcomeTab[] })
  | (StepBase & { kind: 'log'; tiles: KalauzWelcomeTile[]; chat: string })
  | (StepBase & { kind: 'sugo' })

export type KalauzWelcomeCloseReason = 'skip' | 'done'

export interface KalauzWelcomeProps {
  steps: KalauzWelcomeStep[]
  onClose: (reason: KalauzWelcomeCloseReason, step: number) => void
}

export function KalauzWelcome({ steps, onClose }: KalauzWelcomeProps) {
  const reduced = useReducedMotion()
  const [target] = useState<Element>(() => document.querySelector('.phone-screen') ?? document.body)
  // Captured at first render — BEFORE the title-focus layout effect below runs — so this is
  // the trigger that opened the welcome, not the title itself (the title-focus effect would
  // already have run by the time a passive useEffect could read document.activeElement).
  const [previouslyFocused] = useState<HTMLElement | null>(() => document.activeElement as HTMLElement | null)
  const [step, setStep] = useState(0)
  // Per-lépés demó-állapot. `tab` a tabbar-lépés kiválasztott füle, `logOpen` a logolás-lépés
  // „kinyitott csempe-rács" állapota — a lépés úgy indul, ahogy a valódi app: csak a + gombbal.
  const [tab, setTab] = useState(0)
  const [logOpen, setLogOpen] = useState(false)

  const current = steps[step]
  const last = step === steps.length - 1
  const titleId = 'kalauz-welcome-title'
  const titleRef = useRef<HTMLHeadingElement>(null)

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const stepRef = useRef(step)
  stepRef.current = step

  const go = useCallback((k: number) => {
    setStep(k)
    setTab(0)
    setLogOpen(false)
  }, [])

  // APG: a fókusz mountkor ÉS minden lépésváltáskor az aktuális címre. useLayoutEffect, hogy a
  // fókusz még a festés előtt a helyére kerüljön (a userEvent.click után szinkronban látszódjon).
  useLayoutEffect(() => { titleRef.current?.focus() }, [step])

  // Escape zár, Tab a dialóguson belül marad. A `keydown` a documenten ül (a LevelUpScreen
  // receptje), a fókusz-visszaadás unmountkor a mountkor MÁR elmentett `previouslyFocused`-ra
  // történik (nem egy itt frissen olvasott document.activeElement-re — az a title-focus
  // layout effect miatt mountkor már a saját címünkre mutatna).
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current('skip', stepRef.current)
        return
      }
      if (e.key !== 'Tab') return
      // Csak a valódi tab-stopok (a cím tabindex=-1 fókusz-CÉL, nem tab-stop — ha kihagynánk a
      // szűrésből, Shift+Tab az első valódi elemről a nem-fókuszálható címre "landolna", ami nem
      // egyezik sem a first, sem a last elemmel, és a böngésző kiszökne a dialóguson kívülre).
      const focusables = rootRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])')
      if (!focusables || focusables.length === 0) return
      const list = [...focusables]
      const first = list[0]
      const lastEl = list[list.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus() }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previouslyFocused?.focus?.()
    }
  }, [previouslyFocused])

  const overlay = (
    <div
      ref={rootRef}
      className={cn('welcome', 'uv-welcome', reduced && 'welcome--reduced')}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="wel-top">
        <p className="uv-eyebrow wel-eyebrow">Első indítás · <b>{step + 1} / {steps.length}</b></p>
      </div>

      <div className="wel-step" key={step}>
        <div className={cn('wel-hero', current.kind !== 'napszak' && 'is-slim')}>
          {current.kind === 'napszak' && <Boop domain="mezo" size={104} className="wel-boop" />}
          <h2 className="wl-title wel-title" id={titleId} ref={titleRef} tabIndex={-1}>{current.title}</h2>
          <div className="wel-voice"><SafeMarkdown text={current.voice} /></div>
        </div>

        {current.kind === 'napszak' && (
          <div className="wel-dparts">
            {current.dayparts.map((d, k) => (
              <div className={cn('wel-dpart glass', k === 1 && 'is-mid')} key={d.key}
                style={{ ...hue(DAYPART_ACCENT[k] ?? 'var(--dv-amber)'), '--i': k } as CSSProperties}>
                <Icon3D name={d.icon} size={d.size} />
                <strong>{d.label}</strong>
                <small>{d.sub}</small>
              </div>
            ))}
          </div>
        )}

        {current.kind === 'tabbar' && (
          <div className="wel-demo">
            <div className="wel-dom5">
              {current.tabs.map((t, k) => (
                <button type="button" key={t.key} className={cn('wel-dom', k === tab && 'on')} style={hue(DOMAIN_ACCENT[t.key])}
                  aria-pressed={k === tab} onClick={() => setTab(k)}>
                  <Boop domain={t.key} size={46} />{t.label}
                </button>
              ))}
            </div>
            <div className="wel-domvoice glass" style={hue(DOMAIN_ACCENT[current.tabs[tab].key])}>
              <strong className="wel-domname">{current.tabs[tab].label}</strong>
              <span className="wel-domtxt">{current.tabs[tab].voice}</span>
            </div>
            <div className="wel-hint">Koppints a figurákra.</div>
          </div>
        )}

        {current.kind === 'log' && (
          <div className="wel-demo">
            <button type="button" className="wel-fab glass" style={hue('var(--dv-lav)')} aria-label="Gyors logolás megnyitása"
              aria-expanded={logOpen} onClick={() => setLogOpen(true)}>
              <span aria-hidden="true">+</span>
            </button>
            {logOpen ? (
              <div className="wel-logbox">
                <div className="wel-tiles">
                  {current.tiles.map((t) => (
                    <span className="wel-tile" key={t.label}><Icon3D name={t.icon} size={34} />{t.label}</span>
                  ))}
                </div>
                <div className="wel-chatrow glass" style={hue('var(--dv-lav)')}><Icon3D name="t-mic" size={30} /><strong>{current.chat}</strong></div>
              </div>
            ) : (
              <div className="wel-hint">Koppints a + gombra.</div>
            )}
          </div>
        )}

        {current.kind === 'sugo' && (
          <div className="wel-demo">
            <span className="wel-qpulse glass is-round" style={hue('var(--dv-amber)')} aria-hidden="true">?</span>
          </div>
        )}
      </div>

      <div className="wel-dots" aria-hidden="true">
        {steps.map((s, k) => <span key={s.kind} className={cn('wel-dot', k === step && 'on', k < step && 'seen')} />)}
      </div>
      <div className={cn('wel-foot', last && 'is-last')}>
        {!last && (
          <button type="button" className="wel-skip" onClick={() => onClose('skip', step)}>Kihagyom</button>
        )}
        <button type="button" className="wel-ghost"
          disabled={step === 0} onClick={() => go(step - 1)}><span aria-hidden="true">‹</span> Vissza</button>
        {last
          ? <button type="button" className="wel-cta" onClick={() => onClose('done', step)}>Induljunk</button>
          : <button type="button" className="wel-cta" onClick={() => go(step + 1)}>Tovább</button>}
      </div>
    </div>
  )

  return createPortal(overlay, target)
}
