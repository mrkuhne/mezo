// Weekly review (mezo-p2tr) — "what Mezo noticed this week": the code-collected digest behind
// the review's highlights. Every subsection is independently optional — only the non-empty ones
// render, and an all-empty digest renders the whole card as nothing (never an empty shell).
import { Link } from 'react-router-dom'
import { Icon } from '@/shared/ui/Icon'
import type { WeeklyReviewDigest } from '@/data/me/weeklyReviewHooks'

function Row({ children, to }: { children: React.ReactNode; to: string }) {
  return (
    <Link
      to={to}
      className="row"
      style={{ justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none', color: 'inherit', padding: '6px 0' }}
    >
      <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{children}</span>
      <Icon name="chevron-right" size={12} />
    </Link>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="col" style={{ marginTop: 12 }}>
      <span style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{title}</span>
      <div className="col" style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 4 }}>
        {children}
      </div>
    </div>
  )
}

export function WeekDiscoveries({ digest }: { digest: WeeklyReviewDigest | null }) {
  if (digest == null) return null
  const hasPatterns = digest.patterns.length > 0
  const hasFacts = digest.newFacts.length > 0
  const hasLifeEvents = digest.lifeEvents.length > 0
  const hasPredictions = digest.predictions.length > 0
  if (!hasPatterns && !hasFacts && !hasLifeEvents && !digest.memoir && !hasPredictions) return null

  return (
    <div className="card" style={{ padding: 18, margin: '0 24px 16px' }}>
      <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>Mezo · amit a héten felfedezett</span>

      {hasPatterns && (
        <Section title="Minták">
          {digest.patterns.map((p) => (
            <Row key={p.pairKey} to={`/insights/patterns/${p.pairKey}`}>{p.title}</Row>
          ))}
        </Section>
      )}

      {hasFacts && (
        <Section title="Új tudás">
          {digest.newFacts.map((f) => (
            <Row key={f.id} to="/insights/knowledge">{f.text}</Row>
          ))}
        </Section>
      )}

      {hasLifeEvents && (
        <Section title="Életesemények">
          {digest.lifeEvents.map((e) => (
            <Row key={e.id} to="/insights/knowledge">{e.title}</Row>
          ))}
        </Section>
      )}

      {digest.memoir && (
        <Section title="Emlékkönyv">
          <Row to="/insights/memoir">Új bejegyzés készült a hétről</Row>
        </Section>
      )}

      {hasPredictions && (
        <Section title="Előrejelzések">
          {digest.predictions.map((p) => (
            <Row key={p.id} to="/insights/predictions">{p.title}</Row>
          ))}
        </Section>
      )}
    </div>
  )
}
