import { useNavigate } from 'react-router-dom'
import { useCharacterCouncilStatus } from '@/data/hooks'
import type { CharacterCouncilStatusResponse } from '@/data/character/characterApi'

const LABEL: Record<CharacterCouncilStatusResponse['status'], string> = {
  WAITING: 'A csapat következő beszélgetése még készül.',
  PROCESSING: 'A csapat most nézi át az új megfigyeléseket…',
  COMPLETED: 'Elkészült a csapat napi beszélgetése.',
  QUIET: 'Átnéztük a rendelkezésre álló adatokat. Most nincs új következtetés.',
  FAILED: 'A napi beszélgetés most nem készült el. A korábbi történeteket továbbra is olvashatod.',
}

export function CharacterCouncilStatus() {
  const { status, isError, refetch } = useCharacterCouncilStatus()
  const navigate = useNavigate()
  if (isError) return <div className="kr-council-status" role="status">A napi feldolgozás állapota most nem érhető el. <button type="button" onClick={refetch}>Újratöltés</button></div>
  if (!status) return null
  return (
    <div className="kr-council-status" role="status">
      <span>{LABEL[status.status]}</span>
      {status.sourceThrough && <small>Feldolgozott adatok: {status.sourceThrough.replaceAll('-', '. ')}-ig.</small>}
      {status.status === 'COMPLETED' && status.conferenceId && <button type="button" onClick={() => navigate(`/mezo/karakter/konzilium?id=${encodeURIComponent(status.conferenceId!)}`)}>Napi beszélgetés ↗</button>}
    </div>
  )
}
