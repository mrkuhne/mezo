export interface TrainTab {
  id: string
  to: string
  label: string
  end?: boolean
}

export const TRAIN_TABS: TrainTab[] = [
  { id: 'mai', to: '/train', label: 'Mai', end: true },
  { id: 'week', to: '/train/week', label: 'Heti' },
  { id: 'gym', to: '/train/gym', label: 'Gym' },
  { id: 'sport', to: '/train/sport', label: 'Sport' },
  { id: 'futas', to: '/train/futas', label: 'Futás' },
  { id: 'exercises', to: '/train/exercises', label: 'Gyakorlatok' },
  { id: 'medals', to: '/train/medals', label: 'Medálok' },
  { id: 'mesocycles', to: '/train/mesocycles', label: 'Mesociklusok' },
  // The blueprint half of the template/run split — its own tab since mezo-tlwa
  // (the library below it is runs-only and links here via a nav row).
  { id: 'templates', to: '/train/templates', label: 'Sablonok' },
]
