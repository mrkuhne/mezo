import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { NightBreathing } from '@/features/me/components/NightBreathing'
import { NightBodyScan } from '@/features/me/components/NightBodyScan'
import { NightWalk } from '@/features/me/components/NightWalk'
import {
  WATCHDOG_TICK_MS, watchdogDone, type NightPhase, type NightTool,
} from '@/features/me/logic/nightFlow'
import { recordNightWake } from '@/features/me/logic/nightTrace'

/**
 * Full-screen night surface (/me/sleep/night, spec D4/D5): forced extra-dark regardless
 * of theme, no clock or countdown anywhere. The unified 20-minute rule: "Ébren vagyok"
 * starts a silent timestamp-based watchdog; the calm tools run inside the waiting frame;
 * at ~20 minutes the screen gently flips to the get-out-of-bed prompt.
 */
export function NightPage() {
  const [phase, setPhase] = useState<NightPhase>('idle')
  const [tool, setTool] = useState<NightTool>(null)
  const startedAt = useRef(0)

  const startWaiting = () => {
    startedAt.current = Date.now()
    setTool(null)
    setPhase('waiting')
  }

  useEffect(() => {
    if (phase !== 'waiting') return
    const id = setInterval(() => {
      if (watchdogDone(startedAt.current, Date.now())) {
        setTool(null)
        setPhase('getup')
      }
    }, WATCHDOG_TICK_MS)
    return () => clearInterval(id)
  }, [phase])

  return (
    <div className="night">
      <Link to="/me/sleep" className="night-back">← vissza</Link>

      {phase === 'idle' && (
        <div className="night-body">
          <div className="night-eye">Éjszakai mód</div>
          <div className="night-moon" aria-hidden="true">🌙</div>
          <h1 className="night-title">Felébredtél?</h1>
          <p className="night-tx">
            Ne nézd meg az órát — nem számít, mennyi az idő.
            <br /><br />
            Ha úgy érzed, már jó ideje ébren fekszel, szólj — innentől én figyelem az időt helyetted.
          </p>
          <button className="night-cta" onClick={() => { recordNightWake(); startWaiting() }}>
            Ébren vagyok
          </button>
        </div>
      )}

      {phase === 'waiting' && tool === null && (
        <div className="night-body">
          <div className="night-eye">Én figyelem az időt</div>
          <div className="night-orb" aria-hidden="true" />
          <p className="night-tx">Maradj az ágyban, lazíts.<br />Ha segít, válassz egyet:</p>
          <div className="night-tools">
            <button className="night-tool" onClick={() => setTool('breathing')}>
              <span aria-hidden="true">🫁</span>
              <span className="night-tool-tx"><b>Légzés</b><i>be 5 · tartsd 6 · ki 7 — vezetett ütem</i></span>
              <span aria-hidden="true">›</span>
            </button>
            <button className="night-tool" onClick={() => setTool('bodyscan')}>
              <span aria-hidden="true">🧘</span>
              <span className="night-tool-tx"><b>Testpásztázás</b><i>fejtől lábujjig, lassú vezetéssel</i></span>
              <span aria-hidden="true">›</span>
            </button>
            <button className="night-tool" onClick={() => setTool('walk')}>
              <span aria-hidden="true">🚶</span>
              <span className="night-tool-tx"><b>4K-séta</b><i>járj végig fejben egy jól ismert utat</i></span>
              <span aria-hidden="true">›</span>
            </button>
          </div>
          <Link to="/me/sleep" className="night-quiet">elalszom · kilépek</Link>
        </div>
      )}

      {phase === 'waiting' && tool === 'breathing' && <NightBreathing onStop={() => setTool(null)} />}
      {phase === 'waiting' && tool === 'bodyscan' && <NightBodyScan onStop={() => setTool(null)} />}
      {phase === 'waiting' && tool === 'walk' && <NightWalk onStop={() => setTool(null)} />}

      {phase === 'getup' && (
        <div className="night-body">
          <div className="night-eye">Ideje felkelni</div>
          <div className="night-glow" aria-hidden="true">🕯️</div>
          <h1 className="night-title night-title-sm">Kelj fel — ez most a jobb út</h1>
          <ul className="night-steps">
            <li><b>Menj át</b> egy másik, félhomályos helyre.</li>
            <li><b>Csinálj valami csendeset</b> — olvass papírról, hallgass halk podcastot.</li>
            <li><b>Csak akkor gyere vissza,</b> ha tényleg álmos vagy. Az ágy az alvásé.</li>
          </ul>
          <button className="night-cta" onClick={startWaiting}>Visszafeküdtem</button>
          <Link to="/me/sleep" className="night-quiet">elalszom · kilépek</Link>
        </div>
      )}
    </div>
  )
}
