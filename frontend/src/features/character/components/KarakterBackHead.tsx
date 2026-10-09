import { FrameBack } from '@/shared/ui/folyadek'
/**
 * Üvegesítés U9 (mezo-me75u.9): a Karakter-oldalak vissza-fejléce — a csapatfal `tf-dhead`
 * anyaga (üveg vissza-gomb + kis felirat + cím), ugyanaz, mint a szobák BackHead-je. Gomb, nem
 * link: a hívó dönti el, hová visz vissza (`onBack`), így router nélküli tesztekben is renderel.
 */
export function KarakterBackHead({ small, title, onBack }: { small: string; title: string; onBack: () => void }) {
  return (
    <div className="tf-dhead kr9-dhead">
      <FrameBack className="glass tf-back" onBack={onBack}>‹</FrameBack>
      <span className="tf-dtitle"><small>{small}</small><strong>{title}</strong></span>
    </div>
  )
}
