export type PantrySourceKey =
  | 'kifli.hu' | 'myprotein.hu' | 'tesco.hu' | 'auchan.hu' | 'manual'
  | 'lidl' | 'nutriversum' | 'herbahaz' | 'nutrifit' | 'decathlon'
export interface PantrySourceMeta { label: string; color: string; short: string }
export const pantrySources: Record<PantrySourceKey, PantrySourceMeta> = {
  'kifli.hu':     { label: 'kifli.hu',      color: '#7CB342', short: 'K' },
  'myprotein.hu': { label: 'myprotein.hu',  color: '#A78BFA', short: 'MP' },
  'tesco.hu':     { label: 'tesco.hu',      color: '#60A5FA', short: 'T' },
  'auchan.hu':    { label: 'auchan.hu',     color: '#F472B6', short: 'A' },
  'manual':       { label: 'Saját bevitel', color: '#6B7280', short: '·' },
  'lidl':         { label: 'Lidl',          color: '#2C5AA0', short: 'L' },
  'nutriversum':  { label: 'Nutriversum',   color: '#34D399', short: 'NV' },
  'herbahaz':     { label: 'Herbaház',      color: '#A3E635', short: 'H' },
  'nutrifit':     { label: 'Nutrifit',      color: '#F59E0B', short: 'NF' },
  'decathlon':    { label: 'Decathlon',     color: '#0082C3', short: 'D' },
}
