// Layout-aware loading skeleton for MesoTemplatesPage (mezo-tlwa). Mirrors the real shape —
// page-header → a section eyebrow line → ~2 template-card placeholders (title/goal/chip row
// + the two action rows) — so the swap to real content does not reflow. Sizes track the DS
// re-skin (36px h1, 44px header action) like MesocycleSkeleton.
import { Skeleton, SkeletonCard } from '@/shared/ui/Skeleton'

export default function MesoTemplatesSkeleton() {
  return (
    <div role="status" aria-label="Betöltés…">
      <div className="page-header">
        <div className="col gap-xs"><Skeleton width={130} height={12} /><Skeleton width={150} height={36} /></div>
        <Skeleton width={64} height={44} radius={999} />
      </div>
      <div style={{ padding: '8px 24px 24px' }}>
        <div style={{ marginBottom: 12 }}><Skeleton width={100} height={12} /></div>
        <div className="col gap-sm">
          {Array.from({ length: 2 }, (_, i) => (
            <SkeletonCard key={i} style={{ padding: 16 }}>
              <div className="col gap-sm">
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <Skeleton width={56} height={12} /><Skeleton width={72} height={12} />
                </div>
                <Skeleton width="60%" height={18} />
                <Skeleton width="90%" height={12} />
                <div className="row gap-sm mt-sm"><Skeleton width={64} height={24} radius={999} /><Skeleton width={88} height={24} radius={999} /></div>
                <div className="row gap-sm mt-sm"><Skeleton width="48%" height={44} radius={12} /><Skeleton width="48%" height={44} radius={12} /></div>
              </div>
            </SkeletonCard>
          ))}
        </div>
      </div>
    </div>
  )
}
