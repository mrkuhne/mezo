import { useState } from 'react'
import { useAdminMemoryReplay } from '@/data/admin/adminMemoryHooks'
import { RunDetail, type InspectorBody } from '@/features/admin/memory/views/RunDetail'
import type { ViewKey } from '@/features/admin/memory/MemorySegmentBar'

// Próbafutás · replay (mezo-4qyt.3, Step 3.6). A side-effect-free NEW-mode dry run: the two
// toggles are ALLOWANCES, not forces ("engedélyezve", not "bekapcsolva" — the pipeline still
// decides whether a rerank/rewrite actually runs; resolved ambiguity 4). The result renders
// through the SAME RunDetail as an audited run, so the DRY-RUN badge/caveat come straight from
// `detail.dryRun`, never from this component's own state.
export function ReplayBox({
  userId,
  onGo,
  onInspect,
}: {
  userId: string
  onGo: (view: ViewKey, sel: string | null) => void
  onInspect: (body: InspectorBody | null) => void
}) {
  const [query, setQuery] = useState('')
  const [rewrite, setRewrite] = useState(false)
  const [reranker, setReranker] = useState(false)
  const replay = useAdminMemoryReplay(userId)

  const submit = () => {
    if (!query.trim()) return
    replay.mutate({ query: query.trim(), rewrite, reranker, consumerPolicy: 'CHAT_AMBIENT' })
  }

  return (
    <div>
      <div className="am-replay" style={{ marginTop: 8 }}>
        <input
          type="text"
          value={query}
          maxLength={500}
          placeholder="mennyit aludtam az elmúlt héten átlagosan"
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="am-toggles">
          <Toggle label="Újraírás" checked={rewrite} onChange={setRewrite} />
          <Toggle label="Újrarangsorolás" checked={reranker} onChange={setReranker} />
          <button type="button" className="am-btn" disabled={replay.isPending} onClick={submit}>
            Futtatás
          </button>
        </div>
        {replay.isError && <p className="ad-mut">A próbafutás nem sikerült — próbáld újra.</p>}
        {replay.isSuccess && (
          <RunDetail detail={replay.data} onGo={onGo} onInspect={onInspect} />
        )}
      </div>
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <span className="am-toggle">
      <button
        type="button"
        className={`am-switch${checked ? ' on' : ''}`}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
      >
        <i />
      </button>
      {label} — {checked ? 'engedélyezve' : 'letiltva'}
    </span>
  )
}
