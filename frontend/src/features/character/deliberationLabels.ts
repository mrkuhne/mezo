// ============================================================
// Mezo · Karakter — shared konzílium/deliberation labels (mezo-sp9w fix round 1)
// Extracted out of ConferenceThreadCard and KonziliumConversationView, which had these four
// pieces byte-for-byte duplicated. Both views render the same reaction stances and chair
// outcomes and must never drift apart on the words they use for them.
// ============================================================
import type { CharacterExpertDto } from '@/data/character/characterApi'

export const STANCE_LABEL: Record<string, string> = {
  SUPPORT: 'támogatja',
  CHALLENGE: 'vitatja',
  NUANCE: 'árnyalja',
}

/** The three stance tones a peer reaction chip can wear. Typed here (not just `string`) so a
 *  stricter consumer type (ConferenceThreadCard's `ChipTone`, which is this union plus its own
 *  acc/rej/non outcomes) can assign this map without an unchecked cast (M6, mezo-sp9w
 *  branch-review) — a future edit to this map that drops a key now fails to compile there
 *  instead of silently breaking at runtime. */
export type StanceTone = 'sup' | 'cha' | 'nua'

export const STANCE_TONE: Record<string, StanceTone> = { SUPPORT: 'sup', CHALLENGE: 'cha', NUANCE: 'nua' }

// What an ACCEPTED item actually means depends on what was proposed (`item.kind`, on the wire
// from the backend's ClaimProposal): a RETIRE the chair accepted retired a claim, it did not add
// one. Labelling every accepted item "Bekerült" would tell the user the opposite of what
// happened (mezo-xlvr final review, I3). An unknown/missing kind falls back to the neutral
// "Elfogadva" — never to a guess about which way the dossier moved.
export const ACCEPTED_LABEL: Record<string, string> = {
  NEW: 'Bekerült',
  UP: 'Megerősítve',
  DOWN: 'Gyengítve',
  RETIRE: 'Nyugdíjazva',
}

// The next two maps aren't duplicated across views like the four above — today only
// ConferenceThreadCard renders the Szkeptikus/Mezo split-role chain. They live here anyway
// (mezo-lghn) because they're the same kind of vocabulary this module exists to hold, and a
// second consumer (e.g. a future conference detail view) should reach for these, not redeclare
// them.

// The Szkeptikus's own verdict on a claim, in the three grades the backend's
// KonziliumVerdictRound hands down: a full kill, a softened keep (WEAKEN), or an unreserved keep.
// This labels what the Szkeptikus said, not what the chair did with it — see ACCEPTED_LABEL for
// that half.
export const SKEPTIC_LABEL: Record<string, string> = {
  KILL: 'Kukázta',
  WEAKEN: 'Gyengítette',
  KEEP: 'Meghagyta',
}

// The chair's integration-note grounds, carried only when the ruling needed one to stay honest:
// a claim already in the dossier (DUPLICATE), one that contradicts it (CONTRADICTS), a
// guardrail-blocked accept forced down to a rejection (NOT_FOR_DOSSIER), or one that belongs
// under a different dimension (REHOME).
export const NOTE_LABEL: Record<string, string> = {
  DUPLICATE: 'már tartunk ilyet',
  CONTRADICTS: 'ellentmond a dossziénak',
  NOT_FOR_DOSSIER: 'nem dossziéba való',
  REHOME: 'máshová tartozik',
}

export function displayName(experts: CharacterExpertDto[], key: string): string {
  return experts.find((e) => e.key === key)?.displayName ?? key
}
