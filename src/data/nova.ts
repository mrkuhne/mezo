export type NovaGroup = 1 | 2 | 3 | 4
export const NOVA_META: Record<NovaGroup, { label: string; desc: string; color: string }> = {
  1: { label: 'NOVA 1', desc: 'Feldolgozatlan / minimálisan feldolgozott', color: '#34D399' },
  2: { label: 'NOVA 2', desc: 'Kulináris alapanyag (olaj, méz, só)', color: 'var(--brand-glow)' },
  3: { label: 'NOVA 3', desc: 'Feldolgozott (kultúrált, sütött, fermentált)', color: 'var(--warning)' },
  4: { label: 'NOVA 4', desc: 'Ultra-feldolgozott (ipari rekonstrukció)', color: 'var(--cat-tendency)' },
}
