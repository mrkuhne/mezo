export interface MeTab {
  id: string
  to: string
  label: string
  end?: boolean
}

export const ME_TABS: MeTab[] = [
  { id: 'profil', to: '/me', label: 'Profil', end: true },
  { id: 'growth', to: '/me/growth', label: 'Growth' },
  { id: 'goals', to: '/me/goals', label: 'Cél' },
  { id: 'weight', to: '/me/weight', label: 'Súly' },
  { id: 'sleep', to: '/me/sleep', label: 'Alvás' },
  { id: 'people', to: '/me/people', label: 'Emberek' },
  { id: 'knowledge', to: '/me/knowledge', label: 'Tudás' },
]
