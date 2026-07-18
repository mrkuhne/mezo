/** Static title catalog (spec §7, MIX tone: serious ladder / playful shop). */
export type TitleDef = {
  key: string
  name: string
  kind: 'LADDER' | 'SHOP'
  unlockLevel?: number
  priceCoins?: number
}

export const DEFAULT_TITLE_KEY = 'ujonc'

export const TITLE_CATALOG: TitleDef[] = [
  { key: 'ujonc', name: 'Az Újonc', kind: 'LADDER', unlockLevel: 1 },
  { key: 'lendulet', name: 'A Lendület', kind: 'LADDER', unlockLevel: 3 },
  { key: 'kovetkezetes', name: 'A Következetes', kind: 'LADDER', unlockLevel: 5 },
  { key: 'hajnalmadar', name: 'A Hajnalmadár', kind: 'LADDER', unlockLevel: 8 },
  { key: 'fegyelmezett', name: 'A Fegyelmezett', kind: 'LADDER', unlockLevel: 12 },
  { key: 'vasakarat', name: 'A Vasakarat', kind: 'LADDER', unlockLevel: 16 },
  { key: 'merfoldko', name: 'A Mérföldkő', kind: 'LADDER', unlockLevel: 20 },
  { key: 'gepezet', name: 'A Gépezet', kind: 'LADDER', unlockLevel: 25 },
  { key: 'legenda', name: 'A Legenda', kind: 'LADDER', unlockLevel: 30 },
  { key: 'kezdo-kanal', name: 'Kezdő Kanál', kind: 'SHOP', priceCoins: 100 },
  { key: 'csirkemell-csodaja', name: 'Csirkemell Csodája', kind: 'SHOP', priceCoins: 150 },
  { key: 'kardio-kapitany', name: 'Kardió Kapitány', kind: 'SHOP', priceCoins: 240 },
  { key: 'szenhidrat-szelidito', name: 'Szénhidrát Szelídítő', kind: 'SHOP', priceCoins: 240 },
  { key: 'protein-profeta', name: 'Protein Próféta', kind: 'SHOP', priceCoins: 400 },
  { key: 'bicepsz-baro', name: 'Bicepsz Báró', kind: 'SHOP', priceCoins: 400 },
  { key: 'gainz-nagyur', name: 'Gainz Nagyúr', kind: 'SHOP', priceCoins: 600 },
]
