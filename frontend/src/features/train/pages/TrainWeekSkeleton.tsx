// ============================================================
// Mezo · the quiet faces of the Terhelés pages (Folyadék F3, mezo-n4wf5.3).
// Prototype: docs/design_2.0/prototypes/vilagos/edzes.js — `skel(T0, blocks)` (the `.tolt`
// route arg of `terheles` / `terkep` / `jelek` / `mozgas`) and `noMeso(o, msg)` (`.ures`).
//
//   · TrainWeekSkeleton — the loading face in the shape of the page it stands in for: one
//     block per px height (the hero, then the cards), so the swap does not reflow. The
//     default blocks are the Terhelés landing's (tank 356 → map card 110 → group card 340);
//     the three sub-pages pass their own.
//   · TerhelesNoPlan — no running mesocycle: one hero that says what will live here, the
//     mountain glyph in its corner, and the one way forward (the planner).
// ============================================================
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon3D } from '@/shared/ui/clay'
import { Btn, Hero, Page, Skel } from '@/shared/ui/folyadek'

export default function TrainWeekSkeleton({ blocks = [356, 110, 340] }: { blocks?: number[] }) {
  return (
    <Page className="et-page">
      <Skel blocks={blocks} />
    </Page>
  )
}

/** The no-mesocycle face of a Terhelés page. `back` = the sub-page's own `FrameBack`. */
export function TerhelesNoPlan({ label, verdict, back }: { label: string; verdict: string; back?: ReactNode }) {
  const navigate = useNavigate()
  return (
    <Page className="et-page">
      {back}
      <Hero
        className="et-hero-art"
        label={label}
        verdict={verdict}
        sub="Előbb tervezz egy mesociklust."
        actions={<Btn onClick={() => navigate('/train/mesocycles/new')}>+ Tervezz mesociklust</Btn>}
      >
        <span className="et-art" aria-hidden="true"><Icon3D name="t-peak" size={96} /></span>
      </Hero>
    </Page>
  )
}
