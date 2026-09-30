// ============================================================
// Mezo · Hang mindenhol (mezo-xojq8) — ONE voice field for every free-text sentence field.
//
// Voice input grew screen by screen (chat mezo-at8x.4, journal, ritual, fuel, skip), so seven
// screens carried five different mic buttons and ~20 fields had none — the owner found the
// check-in note without one (2026-09-29). This is the single shape now:
//
//   <VoiceField domain="nap" onTranscript={(t) => setNote((d) => appendDictation(d, t))}>
//     <textarea … />
//   </VoiceField>
//
// The caller keeps its own field (class, limits, a11y); VoiceField lays the square glass mic tile
// beside it and owns the Hallgató Boop bubble. Composer bars that must keep their own layout use
// `MicTile` + `VoiceBubble` with their own `useVoiceInput`.
// Owner-approved look: docs/design_2.0/prototypes/elo/_hang-kit.html.
// ============================================================
import { useCallback, useRef, type ReactNode } from 'react'
import { Icon3D } from '@/shared/ui/clay'
import { cn } from '@/shared/lib/cn'
import { useVoiceInput } from '@/shared/lib/voice/useVoiceInput'
import { VoiceBubble, type VoiceBubbleInput } from '@/shared/ui/voice/VoiceBubble'
import type { BoopDomain } from '@/shared/ui/clay/boop/Boop'
import '@/shared/ui/voice/VoiceField.css'

/** The square mic tile. `sm` fits a one-line field or a composer bar. */
export function MicTile({ voice, size = 'md', disabled = false, className }: {
  voice: Pick<VoiceBubbleInput, 'state' | 'toggle'>
  size?: 'md' | 'sm'
  /** Extra reason to refuse (e.g. the chat is degraded). */
  disabled?: boolean
  className?: string
}) {
  const live = voice.state === 'recording'
  return (
    <button
      type="button"
      className={cn('vmic', size === 'sm' && 'vmic-sm', live && 'is-live', className)}
      onClick={voice.toggle}
      disabled={disabled || voice.state === 'unsupported' || voice.state === 'transcribing'}
      aria-label={live ? 'Felvétel leállítása' : 'Diktálás'}
      aria-pressed={live}
    >
      <Icon3D name="t-mic" size={size === 'sm' ? 20 : 26} />
    </button>
  )
}

export function VoiceField({ domain, onTranscript, size = 'md', className, children }: {
  /** Whose Boop listens, and the tile's accent. */
  domain: BoopDomain
  /** Receives the transcript; append it (`appendDictation`), never replace what was typed. */
  onTranscript: (text: string) => void
  size?: 'md' | 'sm'
  className?: string
  /** The field itself — a textarea or an input. */
  children: ReactNode
}) {
  // The hook's recorder closes over the callback when recording STARTS; a ref keeps the latest
  // one so a re-rendered caller (new row index, new setter) still receives the text.
  const latest = useRef(onTranscript)
  latest.current = onTranscript
  const stable = useCallback((t: string) => latest.current(t), [])
  const voice = useVoiceInput(stable)
  return (
    <div className={cn('vfield', size === 'sm' && 'vfield-sm', className)} data-domain={domain}>
      {children}
      <MicTile voice={voice} size={size} />
      <VoiceBubble voice={voice} domain={domain} />
    </div>
  )
}
