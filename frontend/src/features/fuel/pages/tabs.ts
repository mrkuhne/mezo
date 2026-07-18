export interface FuelTab {
  id: string
  to: string
  label: string
  end?: boolean
}

export const FUEL_TABS: FuelTab[] = [
  { id: 'mai', to: '/fuel', label: 'Mai', end: true },
  { id: 'plan', to: '/fuel/plan', label: 'Terv' },
  { id: 'stack', to: '/fuel/stack', label: 'Stack' },
  { id: 'recipes', to: '/fuel/recipes', label: 'Receptek' },
  { id: 'kamra', to: '/fuel/kamra', label: 'Kamra' },
  { id: 'gyogyszer', to: '/fuel/gyogyszer', label: 'Gyógyszer' },
]
