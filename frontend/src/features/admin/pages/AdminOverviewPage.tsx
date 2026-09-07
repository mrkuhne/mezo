// Áttekintés (overview) placeholder — Task 9 only wires the shell + this index route so the
// route tree compiles; Task 11 replaces this with the real overview mosaic (poster tiles,
// ring gauge, sparkline — see docs/design_2.0/prototypes/src/admin-body.html #d-overview).
export function AdminOverviewPage() {
  return (
    <div>
      <div className="ad-eyebrow">Admin · Áttekintés</div>
      <p style={{ marginTop: 8, color: 'var(--text-secondary, #6E6257)', fontSize: 13 }}>
        Ez a nézet a Task 11-ben kap tartalmat (userek, feature-használat, LLM-költség
        összegzés poszter-csempéken).
      </p>
    </div>
  )
}
