import { useNavigate } from 'react-router-dom'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { GhostState } from '@/shared/ui/GhostState'
import { ScreenSkeleton } from '@/shared/ui/ScreenSkeleton'
import { MozaikPage, PageHead, PageHero, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { useSignalCatalog } from '@/data/hooks'
import type { SignalCatalogEntry } from '@/data/lifegoal/lifegoalApi'

// A prototípus celok.html #page-jelek (docs/design_2.0/prototypes/src/celok-body.html:480) a
// vizuális igazság: hero = „x / y forrás él", aztán Él és Alszik szekció, soronként egy ikon,
// „n / 7 nap · csoport" és a tápált pillérek chipjei. Semmi új naplózó — ez a transzparencia-oldal.
// Üveg (mezo-me75u.6, prototypes/uveg-en.html#jelek): a csoport-ikonok a Titanium 3D készletből.
const GROUP_ICON: Record<string, Icon3DName> = {
  'Alvás': 't-sleep', 'Fuel': 't-bowl', 'Edzés': 't-dumbbell', 'Elme': 't-checkin',
  'Activity': 't-steps', 'Emberek': 't-people', 'Életjel': 't-heart',
}

export default function JelekPage() {
  const navigate = useNavigate()
  const { entries = [], isPending, isError, refetch } = useSignalCatalog()

  if (isPending) return <ScreenSkeleton />
  if (isError && entries.length === 0) {
    return (
      <MozaikPage tone="sage" className="enc-page enc-jelek">
        <PageHead glass onBack={() => navigate('/me/goals')} label="Célok" />
        <PageBody>
          <GhostState message="Nem sikerült betölteni a jeleket." ctaLabel="Újra" onCta={refetch} />
        </PageBody>
      </MozaikPage>
    )
  }

  const live = entries.filter((e) => e.live).sort((a, b) => b.daysWithData - a.daysWithData)
  const asleep = entries.filter((e) => !e.live)

  const row = (e: SignalCatalogEntry, i: number, off: boolean) => (
    <li key={e.id} className={`lg-sig rise${off ? ' off' : ''}`} style={{ '--d': `${60 + i * 20}ms` } as React.CSSProperties}
        aria-label={e.label}>
      <Icon3D name={GROUP_ICON[e.group] ?? 't-signal'} size={36} />
      <div className="grow">
        <b>{e.label}</b>
        <small>{off ? 'nincs adat 7 napja' : `${e.daysWithData} / 7 nap`} · {e.group}</small>
        {e.fedPillars.length > 0 && (
          <div className="lg-sigchips">{e.fedPillars.map((p) => <span key={p}>{p}</span>)}</div>
        )}
      </div>
      <i className={off ? 'dead' : 'live'} aria-hidden="true" />
    </li>
  )

  return (
    <MozaikPage tone="sage" className="enc-page enc-jelek">
      <PageHead glass onBack={() => navigate('/me/goals')} label="Célok" />
      <PageBody principle="Nincs külső forrás — se naptár, se időjárás, se GitHub. Ami itt nincs, azt a rendszer nem tudja.">
        <EntranceGroup>
          <PageHero
            art="t-signal"
            accent="var(--dv-sage)"
            name="Jelek"
            big={(
              <span aria-label={`${live.length} élő forrás a ${entries.length}-ból`}>
                {live.length}<small> / {entries.length}</small>
              </span>
            )}
            sub="forrás él · volt adata az elmúlt 7 napban"
          />
          <p className="lg-sighint rise" style={{ '--d': '40ms' } as React.CSSProperties}>
            Semmi újat nem kell naplóznod. Ezekből számolom a pilléreket — ami alszik, ott a pillér üres marad, nem nulla.
          </p>
          <div className="lg-sighead rise" style={{ '--d': '60ms' } as React.CSSProperties}>
            <span className="mz-eyebrow">Él</span><span className="cnt">{live.length} forrás</span>
          </div>
          <ul className="lg-siglist">{live.map((e, i) => row(e, i, false))}</ul>
          <div className="lg-sighead rise" style={{ '--d': '80ms' } as React.CSSProperties}>
            <span className="mz-eyebrow">Alszik</span><span className="cnt">{asleep.length} forrás</span>
          </div>
          <ul className="lg-siglist">{asleep.map((e, i) => row(e, i, true))}</ul>
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}
