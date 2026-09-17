import type { ActivityEntry, CheckinSlot, FuelMeal } from '@/data/types'
import type { JournalNote } from '@/data/journal/journalTypes'

export interface NapMoment { id: string; label: string; text: string; time: string | null; to: string }
const validTime = (value?: string): string | null => value && Number.isFinite(Date.parse(value)) ? value : null

/** Domain dates determine membership; scheduled check-in slots are not capture timestamps. */
export function buildNapTimeline(date: string, checkins: CheckinSlot[], meals: FuelMeal[], notes: JournalNote[], activities: ActivityEntry[]): NapMoment[] {
  return [
    ...checkins.flatMap((slot, i) => slot.state === 'done' ? [{ id: `checkin:${i}`, label: 'Check-in', text: slot.note || 'Egy pillanatkép rólad', time: validTime(slot.savedAt), to: '/nap/checkin' }] : []),
    ...meals.filter(m => m.mealDate === date).map(m => ({ id: `meal:${m.id}`, label: 'Étkezés', text: m.title, time: validTime(m.loggedAt), to: '/fuel' })),
    ...notes.filter(n => n.occurredOn === date).map(n => ({ id: `journal:${n.id}`, label: 'Napló', text: n.text, time: validTime(n.createdAt), to: '/me/naplo' })),
    ...activities.filter(a => a.occurredOn === date).map(a => ({ id: `activity:${a.id}`, label: 'Aktivitás', text: a.text, time: validTime(a.createdAt), to: '/me/growth/naplo' })),
  ].sort((a, b) => (b.time ? Date.parse(b.time) : -Infinity) - (a.time ? Date.parse(a.time) : -Infinity))
}
