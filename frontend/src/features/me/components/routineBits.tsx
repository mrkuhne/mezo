// ============================================================
// Mezo · routineBits (Folyadék F2, mezo-n4wf5.2) — the small pieces the six routine-builder pages
// share: the recipe as vessels + its sentence, the page's fallback back control, and a row wrapper
// that carries attributes the kit's `Row` does not pass through. Look: prototypes/vilagos/nap.js
// (`recG`, `recept`); CSS `.rb-*` in styles/folyadek-nap-epites.css.
// ============================================================
import type { ReactNode } from 'react'
import type { HabitFramework } from '@/data/types'
import { routineSentenceParts, type RoutineRecipe } from '@/features/me/logic/routineSentence'
import { cn } from '@/shared/lib/cn'
import type { Icon3DName } from '@/shared/ui/clay'
import { FrameBack } from '@/shared/ui/folyadek'

export const FW_NAME: Record<HabitFramework | 'NONE', string> = {
  FOGG: 'Szokás-láncolás',
  CLEAR: 'Négy törvény',
  NONE: 'Keret nélkül',
}
export const FW_ART: Record<HabitFramework | 'NONE', Icon3DName> = { FOGG: 't-anchor', CLEAR: 't-gem', NONE: 't-note' }

/** The parts of a recipe in the order the wizard asks them, each with whether it is set. */
export function recipeParts(recipe: RoutineRecipe): { label: string; filled: boolean }[] {
  const set = (v: string) => v.trim() !== ''
  if (recipe.framework === 'FOGG') {
    return [
      { label: 'Horgony', filled: set(recipe.anchorLabel) },
      { label: 'Pici tett', filled: set(recipe.title) },
      { label: 'Ünneplés', filled: set(recipe.celebration) },
    ]
  }
  if (recipe.framework === 'CLEAR') {
    return [
      { label: 'Jelzés', filled: set(recipe.cue) },
      { label: 'Vágy', filled: set(recipe.craving) },
      { label: 'Válasz', filled: set(recipe.title) },
      { label: 'Jutalom', filled: set(recipe.reward) },
    ]
  }
  return [{ label: 'Tett', filled: set(recipe.title) }]
}

/** The recipe's vessels: one per part, filled once that part is set. Decorative — the sentence says it. */
export function RecipeVessels({ parts }: { parts: { label: string; filled: boolean }[] }) {
  return (
    <div className="rb-rec" aria-hidden="true">
      {parts.map((p) => <span key={p.label} className={p.filled ? 'f' : undefined}><i /><b>{p.label}</b></span>)}
    </div>
  )
}

/** The recipe as one sentence (`routineSentenceParts`, never a local template): the user's words
 *  are bold, an unset slot is a dashed blank that still names itself for a screen reader. */
export function RecipeSentence({ recipe, testId }: { recipe: RoutineRecipe; testId?: string }) {
  return (
    <p className="rb-recept" data-testid={testId}>
      {routineSentenceParts(recipe).map((part, i) => (
        part.slot === undefined ? <span key={i}>{part.text}</span>
          : part.filled ? <b key={i}>{part.text}</b>
            : <span key={i} className="rb-blank">{part.text}</span>
      ))}
    </p>
  )
}

/** The page's own back control. Inside the app the title bar draws it (and this renders nothing);
 *  `history` + `fallback` = „back where you came from", `onBack` = a stateful back (the wizard). */
export function RbBack({ label, fallback, onBack }: { label: string; fallback?: string; onBack?: () => void }) {
  const face = <><b aria-hidden="true">‹</b>{label}</>
  return onBack
    ? <FrameBack className="rb-back" onBack={onBack}>{face}</FrameBack>
    : <FrameBack className="rb-back" history fallback={fallback}>{face}</FrameBack>
}

/** A kit `Row` (or anything) with its own attributes; the wrapper keeps the row rhythm of the card. */
export function RowItem({ testId, className, children, ...rest }: {
  testId?: string; className?: string; children: ReactNode; [data: `data-${string}`]: string | undefined
}) {
  return <div className={cn('rb-it', className)} data-testid={testId} {...rest}>{children}</div>
}
