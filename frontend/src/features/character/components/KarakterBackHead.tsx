import { FrameBack } from '@/shared/ui/folyadek'
/**
 * Üvegesítés U9 (mezo-me75u.9): a Karakter-oldalak vissza-fejléce — a csapatfal `tf-dhead`
 * anyaga (üveg vissza-gomb + kis felirat + cím), ugyanaz, mint a szobák BackHead-je. Gomb, nem
 * link. A hívó a `fallback` útvonalat adja meg: a vissza oda visz, ahonnan a felhasználó jött, a
 * fix útvonal csak közvetlen linkről él (mezo-n4wf5.1); `onBack` annak marad, aki többet tesz.
 */
export function KarakterBackHead({ small, title, onBack, fallback }: { small: string; title: string; onBack?: () => void; fallback?: string }) {
  return (
    <div className="tf-dhead kr9-dhead">
      <FrameBack className="glass tf-back" {...(fallback ? { history: true, fallback } : { onBack })}>‹</FrameBack>
      <span className="tf-dtitle"><small>{small}</small><strong>{title}</strong></span>
    </div>
  )
}
