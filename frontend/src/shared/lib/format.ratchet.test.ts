// Ratchet: locale-sensitive formatting lives in `shared/lib/format.ts`. Every OTHER non-test source file that still
// formats by hand is listed below; the list may only shrink (later slices convert the files and delete their lines).
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(__dirname, '..', '..')
const PATTERN = /hu-HU|toLocale(Date|Time)?String\(|new Intl\./
const HOME = 'shared/lib/format.ts'

const ALLOWLIST: string[] = [
  'data/fuel/fuelApi.ts',
  'data/insights/chatApi.ts',
  'data/insights/chatHooks.ts',
  'data/insights/predictionsApi.ts',
  'data/me/peopleApi.ts',
  'data/me/peopleHooks.ts',
  'data/train/trainHooks.ts',
  'features/admin/memory/views/LayersView.tsx',
  'features/admin/pages/AdminCostDetailPage.tsx',
  'features/admin/pages/AdminCostPage.tsx',
  'features/character/components/CharacterPostCard.tsx',
  'features/character/components/CharacterReplyThread.tsx',
  'features/character/components/ConferenceArchiveSheet.tsx',
  'features/character/feedDayLabel.ts',
  'features/character/pages/FutasokPage.tsx',
  'features/character/pages/KonziliumPage.tsx',
  'features/character/sheets/CharacterEvidenceSheet.tsx',
  'features/character/sheets/CharacterRevisionSheet.tsx',
  'features/fuel/logic/keretHero.ts',
  'features/fuel/sheets/learnedBaseFormat.ts',
  'features/insights/components/MemoryJournalPanel.tsx',
  'features/insights/logic/chatRefs.ts',
  'features/insights/logic/memoirArchive.ts',
  'features/insights/logic/patternCatalog.ts',
  'features/insights/logic/roladCopy.ts',
  'features/insights/pages/PatternDetailPage.tsx',
  'features/insights/pages/PatternsPage.tsx',
  'features/insights/sheets/ConversationPickerSheet.tsx',
  'features/insights/sheets/ForgetAllSheet.tsx',
  'features/me/logic/goalSuggestionDiff.ts',
  'features/me/logic/llmCallFormat.ts',
  'features/me/logic/weekDay.ts',
  'features/me/pages/GoalSettingsPage.tsx',
  'features/me/pages/GoalsPage.tsx',
  'features/me/pages/JournalPage.tsx',
  'features/me/pages/PersonDetailPage.tsx',
  'features/notification/logic/stamp.ts',
  'features/today/components/NapFuelGraphic.tsx',
  'features/today/pages/NapHubPage.tsx',
  'features/train/components/ExerciseReview.tsx',
  'features/train/components/ProgressionBanner.tsx',
  'features/train/components/SetStepper.tsx',
  'features/train/components/SportCeremony.tsx',
  'features/train/components/WorkoutCard.tsx',
  'features/train/components/WorkoutCeremony.tsx',
  'features/train/components/WorkoutRecordsGlass.tsx',
  'features/train/components/WorkoutSummary.tsx',
  'features/train/logic/medalLabels.ts',
  'features/train/logic/mesoDates.ts',
  'features/train/logic/progressionChip.ts',
  'features/train/logic/workoutCardMeta.ts',
  'features/train/logic/workoutComparison.ts',
  'features/train/pages/ActiveWorkoutPage.tsx',
  'features/train/pages/MesoComparePage.tsx',
  'features/train/pages/MesoReportPage.tsx',
  'shared/i18n/plural.ts',
]

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return sources(p)
    return /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) ? [p] : []
  })
}

describe('hand-rolled locale formatting', () => {
  it('only the allowlisted files still do it', () => {
    const found = sources(SRC)
      .map((p) => relative(SRC, p).split(sep).join('/'))
      .filter((f) => f !== HOME && PATTERN.test(readFileSync(join(SRC, f), 'utf8')))
      .sort()
    expect(ALLOWLIST, 'ALLOWLIST must be sorted and free of duplicates').toEqual([...ALLOWLIST].sort())
    const added = found.filter((f) => !ALLOWLIST.includes(f))
    const removed = ALLOWLIST.filter((f) => !found.includes(f))
    expect(added, `New file(s) format dates/numbers by hand: use shared/lib/format instead: ${added.join(', ')}`).toEqual([])
    expect(removed, `File(s) no longer format by hand: delete them from ALLOWLIST: ${removed.join(', ')}`).toEqual([])
  })
})
