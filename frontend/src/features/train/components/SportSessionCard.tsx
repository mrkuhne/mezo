// ============================================================
// Mezo · SportSessionCard — one logged session in the SportPage log list.
// Folyadék (mezo-n4wf5.3, prototype vilagos/edzes.js `sport('naplo')` `.vs-log`): a row —
// the sport's glyph, date · time, „<sport> · idő Np · setek/körök N" (branched by kind),
// the RPE as the value on the right — then two labelled levels (Intenzitás / Váll terhelés;
// a high shoulder load turns the level to the warning colour) and the note as a quoted line.
// The sport label stays kind-correct (it once mislabeled cross/TRX rows, mezo-d20.3.4).
// ============================================================
import type { Icon3DName } from '@/shared/ui/clay'
import type { SportSession } from '@/data/types'
import { Level, Row } from '@/shared/ui/folyadek'
import { deepMuscle } from '@/features/train/components/folyadek'
import { sportOf, SPORT_LABELS, type SportKind } from '@/features/train/logic/sportKinds'
import { sportById } from '@/features/train/logic/sports'

interface SportSessionCardProps {
  session: SportSession
}

/** The sport's own glyph from the sport table (t-volley, t-crossfit, t-trx…). */
const kindIcon = (kind: SportKind): Icon3DName => sportById(kind)?.art3d ?? 't-volley'

export function SportSessionCard({ session }: SportSessionCardProps) {
  const kind = sportOf({ sport: session.sport as SportKind })
  const isVolleyball = kind === 'volleyball'
  const amount = isVolleyball ? `setek ${session.setsPlayed ?? '–'}` : `körök ${session.rounds ?? '–'}`

  return (
    <div className="es-log">
      <Row
        icon={kindIcon(kind)}
        title={`${session.date} · ${session.time}`}
        sub={`${SPORT_LABELS[kind]} · idő ${session.duration}p · ${amount}`}
        value={<>{String(session.rpe).replace('.', ',')} <small>RPE</small></>}
      />
      {(session.intensity != null || session.shoulderStrain != null) && (
        <div className="es-l2">
          {session.intensity != null && (
            <>
              <span>Intenzitás</span>
              <Level pct={session.intensity * 10} height={16} value={String(session.intensity)} />
            </>
          )}
          {session.shoulderStrain != null && (
            <>
              <span>Váll terhelés</span>
              <Level pct={session.shoulderStrain * 10} height={16} value={String(session.shoulderStrain)}
                color={session.shoulderStrain >= 7 ? 'var(--fo-warn)' : deepMuscle('shoulder-front')} />
            </>
          )}
        </div>
      )}
      {session.notes && <p className="es-xl">&bdquo;{session.notes}&rdquo;</p>}
    </div>
  )
}
