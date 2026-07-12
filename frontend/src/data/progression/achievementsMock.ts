import type { Achievements } from '@/data/types'

/** Mock seed: the approved mockup's 4/9 achievement state. */
export const achievementsMock: Achievements = {
  badges: [
    { key: 'first_quest', icon: '🏁', name: 'Első küldetés', achieved: true, current: 23, target: 1 },
    { key: 'quests_10', icon: '📜', name: '10 küldetés', achieved: true, current: 23, target: 10 },
    { key: 'quests_50', icon: '🎖️', name: '50 küldetés', achieved: false, current: 23, target: 50 },
    { key: 'first_activity', icon: '✍️', name: 'Első tevékenység', achieved: true, current: 14, target: 1 },
    { key: 'rhythm_4w', icon: '🔥', name: '4 hetes ritmus', achieved: true, current: 5, target: 4 },
    { key: 'all_life_active', icon: '🌈', name: 'Mind a 8 LIFE aktív', achieved: false, current: 6, target: 8 },
    { key: 'life_lv5', icon: '🧠', name: 'LIFE Lv 5', achieved: false, current: 3, target: 5 },
    { key: 'life_xp_10k', icon: '🏛️', name: '10 000 LIFE XP', achieved: false, current: 1085, target: 10000 },
    { key: 'savings_100k', icon: '💰', name: '100k megtakarítás', achieved: false, current: 50000, target: 100000 },
  ],
  perks: [
    { perkKey: 'armor_plating_1', name: 'Páncélzat', effectCopy: '10 hét töretlen — sérülésállóság nő', skillKey: 'robustness', milestoneLevel: 10, unlockedAt: '2026-07-08T10:00:00Z' },
    { perkKey: 'afterburner_1', name: 'Utánégő', effectCopy: 'becsült csúcssebesség +4%', skillKey: 'sprint_speed', milestoneLevel: 10, unlockedAt: '2026-07-01T10:00:00Z' },
    { perkKey: 'iron_core_2', name: 'Vas-törzs II', effectCopy: 'push-volumen tűrés +6%', skillKey: 'max_strength', milestoneLevel: 5, unlockedAt: '2026-06-20T10:00:00Z' },
  ],
}
