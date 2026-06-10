export type PantrySourceKey = 'kifli.hu' | 'myprotein.hu' | 'tesco.hu' | 'auchan.hu' | 'manual'
export interface PantrySourceMeta { label: string; color: string; short: string }
export const pantrySources: Record<PantrySourceKey, PantrySourceMeta> = {
  'kifli.hu':     { label: 'kifli.hu',      color: '#7CB342', short: 'K' },
  'myprotein.hu': { label: 'myprotein.hu',  color: '#A78BFA', short: 'MP' },
  'tesco.hu':     { label: 'tesco.hu',      color: '#60A5FA', short: 'T' },
  'auchan.hu':    { label: 'auchan.hu',     color: '#F472B6', short: 'A' },
  'manual':       { label: 'Saját bevitel', color: '#6B7280', short: '·' },
}
