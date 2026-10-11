// ============================================================
// Mezo · DayBreakdownCard — „Ma · izmonként" in the day editor (mezo-smhn; Folyadék
// mezo-n4wf5.3, prototype vilagos/edzes.js `napszerk()` section 2).
// One row per muscle group of the ACTIVE day: its sets as a level against the per-session
// cap, drawn as a waterline in the vessel (the level turns the warning colour above it).
// Under the rows one callout per group over the cap, with the day that could take the
// surplus. Presentational: the parent computes rows + warnings
// (daySessionBreakdown / leastLoadedDayFor). Renders nothing without rows.
// ============================================================
import { SESSION_MUSCLE_CAP, type DayGroupRow } from '@/features/train/logic/setBudget'
import { Mchp, deepMuscle } from '@/features/train/components/folyadek'
import { Box, Card, Legend, LevelMarks, Row } from '@/shared/ui/folyadek'

export interface DayBreakdownWarning {
  label: string
  sets: number
  suggestDay: string | null
}

interface DayBreakdownCardProps {
  rows: DayGroupRow[]
  warnings: DayBreakdownWarning[]
}

export function DayBreakdownCard({ rows, warnings }: DayBreakdownCardProps) {
  if (rows.length === 0) return null

  const capLinePct = (SESSION_MUSCLE_CAP / (SESSION_MUSCLE_CAP + 1)) * 100

  return (
    <Card className="ee-day">
      <Legend className="ee-key" items={[{ kind: 'line', label: `max ${SESSION_MUSCLE_CAP} szett/izom` }]} />
      {rows.map((row) => {
        const plyoOnly = row.sets === 0 && row.exemptSets > 0
        return (
          <Row key={row.group} left={<Mchp muscle={row.colorMuscle} sm />} title={row.label}
            more={!plyoOnly && (
              <LevelMarks pct={(row.sets / (SESSION_MUSCLE_CAP + 1)) * 100} height={14}
                color={row.over ? 'var(--fo-warn)' : deepMuscle(row.colorMuscle)} marks={[{ at: capLinePct }]} />
            )}
            value={plyoOnly
              ? <small>{row.exemptSets} kiegészítő</small>
              : <>{row.sets} / {SESSION_MUSCLE_CAP}{row.over && <span className="sr-only"> · a határ fölött</span>}</>} />
        )
      })}
      {warnings.map((warning, i) => (
        <Box key={`${warning.label}-${i}`} icon="t-info" color="var(--fo-warn)" title={`${warning.label}: ma ${warning.sets} szett`}>
          <p>
            {SESSION_MUSCLE_CAP} fölött nincs kimutatható plusz.
            {warning.suggestDay != null && ` Vigyél át szettet egy másik napra (pl. ${warning.suggestDay})!`}
          </p>
        </Box>
      ))}
    </Card>
  )
}
