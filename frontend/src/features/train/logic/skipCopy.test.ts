import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import type { PlannedSkip, SkipReason } from '@/features/train/logic/plannedSkips'
import {
  KIMELO, REASONS, kimeloAgendaParts, notYetToast, recoveryIcon, sheetNote, sheetNoteParts, skipDoneToast, skipEffect, skipLabel,
} from '@/features/train/logic/skipCopy'

const SERIOUS_R: SkipReason[] = ['ILLNESS', 'STOMACH', 'INJURY', 'TRAVEL']
const ALL: SkipReason[] = ['ILLNESS', 'STOMACH', 'INJURY', 'TRAVEL', 'TIRED', 'NO_TIME', 'NO_MOOD', 'OTHER', 'NONE']

function sk(over: Partial<PlannedSkip> = {}): PlannedSkip {
  const reasonCategory = over.reasonCategory ?? 'NONE'
  const serious = SERIOUS_R.includes(reasonCategory)
  return {
    id: 's1', kind: 'GYM', date: '2026-09-29', reasonCategory, reasonText: null, source: 'USER',
    serious, freePass: false, excused: serious, ...over,
  }
}

describe('REASONS', () => {
  test('eight chips in the prototype order with their Titanium icons', () => {
    expect(REASONS.map((r) => [r.id, r.icon, r.label])).toEqual([
      ['ILLNESS', 't-ill', 'Beteg vagyok'],
      ['STOMACH', 't-digestion', 'Gyomorrontás'],
      ['INJURY', 't-pain', 'Sérülés / fájdalom'],
      ['TRAVEL', 't-travel', 'Úton vagyok'],
      ['TIRED', 't-rested', 'Fáradt vagyok'],
      ['NO_TIME', 't-clock', 'Nincs időm'],
      ['NO_MOOD', 't-motivation', 'Nincs kedvem'],
      ['OTHER', 't-other', 'Egyéb'],
    ])
  })
})

describe('skipLabel', () => {
  test('no reason → „ok nélkül"', () => expect(skipLabel(sk())).toBe('ok nélkül'))
  test('a chip reason → its label', () => expect(skipLabel(sk({ reasonCategory: 'TIRED' }))).toBe('Fáradt vagyok'))
  test('OTHER with text → the quoted text', () =>
    expect(skipLabel(sk({ reasonCategory: 'OTHER', reasonText: 'családi program' }))).toBe('„családi program”'))
  test('OTHER without text → „Egyéb"', () => expect(skipLabel(sk({ reasonCategory: 'OTHER' }))).toBe('Egyéb'))
  test('an advice skip → „az edző javaslatára"', () =>
    expect(skipLabel(sk({ kind: 'SPORT', source: 'ADVICE', excused: true }))).toBe('az edző javaslatára'))
})

describe('skipEffect', () => {
  test('serious → never a miss, plus the care word', () => {
    expect(skipEffect(sk({ reasonCategory: 'ILLNESS' }))).toBe('Nem számít mulasztásnak. Jobbulást!')
    expect(skipEffect(sk({ reasonCategory: 'STOMACH' }))).toBe('Nem számít mulasztásnak. Jobbulást!')
    expect(skipEffect(sk({ reasonCategory: 'INJURY' }))).toBe('Nem számít mulasztásnak. Kíméld magad.')
    expect(skipEffect(sk({ reasonCategory: 'TRAVEL' }))).toBe('Nem számít mulasztásnak. Jó utat!')
  })
  test('free pass → the streak stays', () =>
    expect(skipEffect(sk({ reasonCategory: 'TIRED', freePass: true, excused: true })))
      .toBe('A heti szabadjegyed fedezi — a sorozatod marad.'))
  test('advice → not a miss', () =>
    expect(skipEffect(sk({ source: 'ADVICE', excused: true }))).toBe('Nem számít mulasztásnak.'))
  test('soft, pass already used → counts, calmly', () =>
    expect(skipEffect(sk({ reasonCategory: 'NO_MOOD' })))
      .toBe('Rendes kihagyásnak számít — a heti szabadjegy már elment. Semmi gond.'))
})

describe('sheetNote', () => {
  test('no skip / no reason → the optional-reason invitation', () => {
    const invite = 'Ha megmondod, miért, a terv és az edző ehhez igazodik. Nem kötelező.'
    expect(sheetNote(undefined)).toBe(invite)
    expect(sheetNote(sk())).toBe(invite)
    expect(sheetNoteParts(sk()).icon).toBe('t-info')
  })
  test('serious → heart, bold „Nem számít mulasztásnak." + care', () => {
    const p = sheetNoteParts(sk({ reasonCategory: 'TRAVEL' }))
    expect(p).toEqual({ icon: 't-heart', bold: 'Nem számít mulasztásnak.', rest: ' Jó utat!' })
    expect(sheetNote(sk({ reasonCategory: 'TRAVEL' }))).toBe('Nem számít mulasztásnak. Jó utat!')
  })
  test('free pass → shield', () => {
    const p = sheetNoteParts(sk({ reasonCategory: 'TIRED', freePass: true, excused: true }))
    expect(p).toEqual({ icon: 't-shield', bold: 'Ezt a heti szabadjegyed fedezi', rest: ' — a sorozatod marad.' })
  })
  test('soft, pass used → info, calm count line', () => {
    expect(sheetNote(sk({ reasonCategory: 'NO_TIME' })))
      .toBe('Ez rendes kihagyásnak számít — a heti szabadjegyet már felhasználtad. Semmi gond, jövő héten új jár.')
  })
})

describe('skipDoneToast', () => {
  test('„Megjegyeztem · {label}", OTHER text wins over the stored one', () => {
    expect(skipDoneToast(sk({ reasonCategory: 'TIRED' }))).toBe('Megjegyeztem · Fáradt vagyok')
    expect(skipDoneToast(sk({ reasonCategory: 'OTHER' }), 'jött egy vendég')).toBe('Megjegyeztem · „jött egy vendég”')
  })
})

test('no shame vocabulary in any skip string (all reasons × pass / no pass / advice)', () => {
  const SHAME = /elrontott|túlléptél|hiba|rossz|bukta|kudarc/i
  const out: string[] = [sheetNote(undefined)]
  for (const r of ALL) {
    for (const v of [
      sk({ reasonCategory: r, reasonText: r === 'OTHER' ? 'program' : null }),
      sk({ reasonCategory: r, freePass: true, excused: true }),
      sk({ reasonCategory: r, source: 'ADVICE', excused: true }),
    ]) out.push(skipLabel(v), skipEffect(v), sheetNote(v), skipDoneToast(v))
  }
  for (const s of out) expect(s).not.toMatch(SHAME)
})

test('every skip icon ships in the Titanium sprite (t-ill / t-travel are new)', () => {
  const svg = readFileSync(join(process.cwd(), 'src/shared/ui/clay/titanium-icons.svg'), 'utf8')
  for (const id of [...REASONS.map((r) => r.icon), 't-skip', 't-shield', 't-repeat', 't-mic', 't-heart', 't-info'])
    expect(svg).toContain(`<symbol id="${id}"`)
})

// ── Kímélő mód S2 (mezo-q4xt2.2) ──
test('kímélő copy: the Még nem toast carries the care word; the category icon; the week-list line', () => {
  expect(notYetToast('ILLNESS')).toBe('Rendben — holnap újra rákérdezek. Jobbulást!')
  expect(notYetToast('INJURY')).toBe('Rendben — holnap újra rákérdezek. Kíméld magad.')
  expect(notYetToast('NONE')).toBe('Rendben — holnap újra rákérdezek.')
  expect(recoveryIcon('STOMACH')).toBe('t-digestion')
  expect(recoveryIcon('TRAVEL')).toBe('t-travel')
  expect(recoveryIcon('NONE')).toBe('t-kimelo')
  expect(recoveryIcon(undefined)).toBe('t-kimelo')
  expect(kimeloAgendaParts('Pull Day')).toEqual({ bold: 'Kímélő mód', rest: ' · Pull Day kimarad' })
})

test('no shame vocabulary in any kímélő string', () => {
  const SHAME = /elrontott|túlléptél|hiba|rossz|bukta|kudarc|mulasztottál|lusta/i
  for (const s of Object.values(KIMELO)) expect(s).not.toMatch(SHAME)
})

test('the kímélő icons ship in the Titanium sprite (t-kimelo is new)', () => {
  const svg = readFileSync(join(process.cwd(), 'src/shared/ui/clay/titanium-icons.svg'), 'utf8')
  for (const id of ['t-kimelo', 't-sprout', 't-calendar', 't-dumbbell', 't-run'])
    expect(svg).toContain(`<symbol id="${id}"`)
})
