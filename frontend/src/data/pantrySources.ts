export type PantrySourceKey =
  | 'kifli.hu' | 'myprotein.hu' | 'tesco.hu' | 'auchan.hu' | 'gymbeam.hu' | 'web'
  | 'manual' | 'lidl' | 'nutriversum' | 'herbahaz' | 'nutrifit' | 'decathlon'
  | 'openfoodfacts'
export interface PantrySourceMeta { label: string; color: string; short: string }
export const pantrySources: Record<PantrySourceKey, PantrySourceMeta> = {
  'kifli.hu':     { label: 'kifli.hu',      color: '#7CB342', short: 'K' },
  'myprotein.hu': { label: 'myprotein.hu',  color: '#A78BFA', short: 'MP' },
  'tesco.hu':     { label: 'tesco.hu',      color: '#60A5FA', short: 'T' },
  'auchan.hu':    { label: 'auchan.hu',     color: '#F472B6', short: 'A' },
  'gymbeam.hu':   { label: 'gymbeam.hu',    color: '#8DC63F', short: 'GB' },
  'web':          { label: 'Web',           color: '#64748B', short: 'W' },
  'manual':       { label: 'Saját bevitel', color: '#6B7280', short: '·' },
  'lidl':         { label: 'Lidl',          color: '#2C5AA0', short: 'L' },
  'nutriversum':  { label: 'Nutriversum',   color: '#34D399', short: 'NV' },
  'herbahaz':     { label: 'Herbaház',      color: '#A3E635', short: 'H' },
  'nutrifit':     { label: 'Nutrifit',      color: '#F59E0B', short: 'NF' },
  'decathlon':    { label: 'Decathlon',     color: '#0082C3', short: 'D' },
  'openfoodfacts': { label: 'OpenFoodFacts', color: '#FF8714', short: 'OFF' },
}
