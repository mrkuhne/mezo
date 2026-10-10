/**
 * Napzárás act 6 — Elengedés (mezo-ilsj, spec §4; Folyadék mezo-n4wf5.2, prototype `napzaras.6`).
 * The day's jar is full and gets its lid, the fixed release line, an optional closing note from
 * Mezo, then the evening handoff read straight from the ritual window — no new data, just the two
 * remaining stops (prep + bed). `onFinish` navigates to the evening routine (`/nap/rutin?dp=este`), which owns the
 * sleep-prep phase from there on (integration, not duplication — this component never renders
 * prep-step UI itself).
 */
import { Btn, Card, Hero, Jar, Msg, Section, Step } from '@/shared/ui/folyadek'
import { RitualFoot } from '@/features/ritual/components/RitualFoot'

export function ReleaseStep({ prepStartsAt, bedTime, closingNote, onFinish }: {
  prepStartsAt: string
  bedTime: string
  closingNote: string | null
  onFinish: () => void
}) {
  return (
    <>
      <Hero left={<Jar size={92} pct={100} lid />} label="Napzárás · kész" verdict="A nap le van zárva." sub="Elengedheted. Az edény tele van, a fedél rajta." />
      {closingNote != null && (
        <>
          <Section n={1} title="Mezo üzeni" />
          <Card><Msg member="mezo" meta="napzárás">„{closingNote}”</Msg></Card>
        </>
      )}
      <Section n={closingNote != null ? 2 : 1} title="Most jön · alvás-előkészítés" />
      <Card>
        <Step time={prepStartsAt} icon="t-sleep" title="Lecsendesítés" sub="képernyők le" />
        <Step time={bedTime} icon="t-moon" title="Villanyoltás" sub="jó éjszakát" />
      </Card>
      <RitualFoot><Btn grow onClick={onFinish}>Esti rutin indítása</Btn></RitualFoot>
    </>
  )
}
