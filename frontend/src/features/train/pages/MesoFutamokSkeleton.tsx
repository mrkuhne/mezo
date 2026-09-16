// Layout-aware loading skeleton for MesoFutamokPage („Lezárt futamaid", T10 Task 4,
// mezo-88iwa.11). The page inherited `MesocycleSkeleton` from the Task 2 stub — the
// LANDING's geometry (hero → running card → queued cards → CTA → two doorways), which
// reflows hard against a plain list. This one mirrors what the page actually draws: the
// slim `.pl-lhero` poster, the „Összevetés" chip row, and ~3 closed rows.
// Geometry derived from src/styles/prototype.css the same way MesoTemplatesSkeleton does:
// `.pl-lib-card` padding 13/14 + head ≈ 20 + gap 10 + the meta row ≈ 18 + gap 10 +
// `.pl-lib-foot` (border-top + 9 padding + a ~26px chip) ≈ 115px.
import { Skeleton, SkeletonCard } from '@/shared/ui/Skeleton'

export default function MesoFutamokSkeleton() {
  return (
    <div role="status" aria-label="Betöltés…">
      <Skeleton height={190} radius={0} />
      <div className="col gap-sm" style={{ padding: '14px 17px 19px' }}>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <Skeleton width={92} height={26} radius={999} />
        </div>
        {Array.from({ length: 3 }, (_, i) => (
          <SkeletonCard key={i} style={{ padding: '13px 14px', borderRadius: 20 }}>
            <div className="col gap-sm">
              <Skeleton width="58%" height={16} />
              <Skeleton width="40%" height={14} />
              <Skeleton width="100%" height={30} />
            </div>
          </SkeletonCard>
        ))}
      </div>
    </div>
  )
}
