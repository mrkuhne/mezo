// ============================================================
// Mezo · ChainCelebrations — fires one `useChainCelebration` per active chain of a face's
// daypart (mezo-n5e9.4, the Task 2 carry-over: a face may now own more than one chain of its
// daypart — a custom chain alongside the seed one — so a single hardcoded
// `useChainCelebration(complete, text)` call per face no longer covers every chain).
//
// A list whose LENGTH can change between renders cannot drive a variable number of hook calls
// directly (rules of hooks) — so each chain gets its own `SingleCelebration` instance, keyed by
// chain id, which internally makes exactly one always-unconditional `useChainCelebration` call.
// That is the standard "dynamic list of things needing their own hook" shape.
// ============================================================
import { useChainCelebration } from '@/features/today/logic/useChainCelebration'

export interface ChainCelebrationInput {
  id: string
  done: number
  total: number
  text: string
}

function SingleCelebration({ complete, text }: { complete: boolean; text: string }) {
  useChainCelebration(complete, text)
  return null
}

export function ChainCelebrations({ chains }: { chains: ChainCelebrationInput[] }) {
  return (
    <>
      {chains.map((c) => (
        <SingleCelebration key={c.id} complete={c.total > 0 && c.done === c.total} text={c.text} />
      ))}
    </>
  )
}
