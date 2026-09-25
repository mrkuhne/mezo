import { useNavigate } from 'react-router-dom'
import { useCharacterCouncilStatus } from '@/data/hooks'
import type { CharacterCouncilStatusResponse } from '@/data/character/characterApi'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'

const LABEL: Record<CharacterCouncilStatusResponse['status'], string> = {
  WAITING: 'A csapat következő beszélgetése még készül.',
  PROCESSING: 'A csapat most nézi át az új megfigyeléseket…',
  COMPLETED: 'Elkészült a csapat napi beszélgetése.',
  QUIET: 'Átnéztük a rendelkezésre álló adatokat. Most nincs új következtetés.',
  FAILED: 'A napi beszélgetés most nem készült el. A korábbi történeteket továbbra is olvashatod.',
}

// U9 (mezo-me75u.9): the status line is a glass strip — the state reads as an icon + words
// (bible rule 45), never a bare glyph.
const LOOK: Record<CharacterCouncilStatusResponse['status'], { icon: Icon3DName; accent: string }> = {
  WAITING: { icon: 't-clock', accent: 'lav' },
  PROCESSING: { icon: 't-clock', accent: 'sky' },
  COMPLETED: { icon: 't-tick', accent: 'sage' },
  QUIET: { icon: 't-tick', accent: 'sage' },
  FAILED: { icon: 't-info', accent: 'gold' },
}

export function CharacterCouncilStatus() {
  const { status, isError, refetch } = useCharacterCouncilStatus()
  const navigate = useNavigate()
  if (isError) {
    return (
      <div className="glass tf-strip tf-c-gold kr9-status" role="status">
        <Icon3D name="t-info" size={24} />
        <span className="tf-strip-text">A napi feldolgozás állapota most nem érhető el.</span>
        <button type="button" className="kr9-strip-act" onClick={refetch}>Újratöltés</button>
      </div>
    )
  }
  if (!status) return null
  const look = LOOK[status.status]
  return (
    <div className={`glass tf-strip tf-c-${look.accent} kr9-status`} role="status">
      <Icon3D name={look.icon} size={24} />
      <span className="tf-strip-text">
        {LABEL[status.status]}
        {status.sourceThrough && <small>Feldolgozott adatok: {status.sourceThrough.replaceAll('-', '. ')}-ig.</small>}
      </span>
      {status.status === 'COMPLETED' && status.conferenceId && <button type="button" className="kr9-strip-act" onClick={() => navigate(`/mezo/karakter/konzilium?id=${encodeURIComponent(status.conferenceId!)}`)}>Napi beszélgetés ↗</button>}
    </div>
  )
}
