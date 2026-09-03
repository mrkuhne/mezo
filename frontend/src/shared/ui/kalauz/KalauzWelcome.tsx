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
// ============================================================
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/shared/lib/cn'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import { ClayIcon, ClaySpot, type ClayIconName, type ClaySpotName } from '@/shared/ui/clay'
import { useReducedMotion } from '@/shared/hooks/useReducedMotion'

export interface KalauzWelcomeDaypart { key: string; label: string; spot: ClaySpotName; size: number; sub: string }
export interface KalauzWelcomeTab { key: string; label: string; icon: ClayIconName; voice: string }
export interface KalauzWelcomeTile { label: string; icon: ClayIconName }

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
      className={cn('welcome', reduced && 'welcome--reduced')}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="wl-art" key={step}>
        {current.kind === 'napszak' && (
          <div className="wl-arc">
            {current.dayparts.map((d) => (
              <div className="wl-st" key={d.key}>
                <ClaySpot name={d.spot} size={d.size} />
                {d.label}
                <span className="wl-sub">{d.sub}</span>
              </div>
            ))}
          </div>
        )}

        {current.kind === 'tabbar' && (
          <div className="wl-demo">
            <div className="wl-tabbar">
              {current.tabs.map((t, k) => (
                <button type="button" key={t.key} className={cn('wl-tab', k === tab && 'on')}
                  aria-pressed={k === tab} onClick={() => setTab(k)}>
                  <ClayIcon name={t.icon} size={22} />{t.label}
                </button>
              ))}
            </div>
            <div className="wl-demobox">
              <div className="wl-demoname">{current.tabs[tab].label}</div>
              <div className="wl-demotxt">{current.tabs[tab].voice}</div>
            </div>
            <div className="wl-hint">Koppints a fülekre.</div>
          </div>
        )}

        {current.kind === 'log' && (
          <div className="wl-demo">
            <button type="button" className="wl-fab" aria-label="Gyors logolás megnyitása"
              aria-expanded={logOpen} onClick={() => setLogOpen(true)}>
              <span aria-hidden="true">+</span>
            </button>
            {logOpen ? (
              <div className="wl-demobox">
                <div className="wl-tiles">
                  {current.tiles.map((t) => (
                    <span className="wl-tile" key={t.label}><ClayIcon name={t.icon} size={24} />{t.label}</span>
                  ))}
                </div>
                <div className="wl-chatrow"><ClaySpot name="s-orb" size={26} />{current.chat}</div>
              </div>
            ) : (
              <div className="wl-hint">Koppints a + gombra.</div>
            )}
          </div>
        )}

        {current.kind === 'sugo' && (
          <div className="wl-demo">
            <div className="wl-qrow">
              <span className="wl-q wl-qpulse" aria-hidden="true">?</span>
            </div>
            <ClaySpot name="s-orb-figyel" size={64} />
          </div>
        )}
      </div>

      <div className="wl-eyebrow">Első indítás · {step + 1} / {steps.length}</div>
      <h2 className="wl-title" id={titleId} ref={titleRef} tabIndex={-1}>{current.title}</h2>
      <div className="wl-voice"><SafeMarkdown text={current.voice} /></div>

      <div className="wl-dots" aria-hidden="true">
        {steps.map((s, k) => <span key={s.kind} className={cn('wl-dot', k === step && 'on', k < step && 'seen')} />)}
      </div>
      <div className="wl-foot">
        {!last && (
          <button type="button" className="wl-ghost wl-link" onClick={() => onClose('skip', step)}>Kihagyom</button>
        )}
        <button type="button" className="wl-ghost wl-back"
          disabled={step === 0} onClick={() => go(step - 1)}><span aria-hidden="true">‹</span> Vissza</button>
        {last
          ? <button type="button" className="wl-cta" onClick={() => onClose('done', step)}>Induljunk</button>
          : <button type="button" className="wl-cta" onClick={() => go(step + 1)}>Tovább</button>}
      </div>
    </div>
  )

  return createPortal(overlay, target)
}
