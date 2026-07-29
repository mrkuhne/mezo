/** iOS grants Web Push to home-screen-installed PWAs only — so when the app is not standalone
 *  this REPLACES the master toggle rather than sitting next to it (a toggle that cannot work
 *  must not be offered). Presentational only — no `@/data/*` import. bd mezo-h4wp.6.1 */
export function PushInstallGate() {
  return (
    <div
      className="card"
      style={{
        display: 'flex',
        gap: 9,
        alignItems: 'flex-start',
        padding: '14px 15px',
        background: 'var(--wash-amber)',
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 15 }}>📲</span>
      <p style={{ font: '400 12.5px/1.55 var(--ff-body)', color: 'var(--amber-deep)', margin: 0 }}>
        <strong>iOS:</strong> a push csak akkor jön meg, ha a mezo a{' '}
        <strong>kezdőképernyőn</strong> van (Megosztás → Főképernyőhöz). Safari-fülön az Apple
        nem engedi.
      </p>
    </div>
  )
}
