export interface TrainTab {
  id: string
  to: string
  label: string
  end?: boolean
}

export const TRAIN_TABS: TrainTab[] = [
  { id: 'mai', to: '/train', label: 'Mai', end: true },
  { id: 'gym', to: '/train/gym', label: 'Gym' },
  { id: 'sport', to: '/train/sport', label: 'Sport' },
  { id: 'futas', to: '/train/futas', label: 'Futás' },
  { id: 'exercises', to: '/train/exercises', label: 'Gyakorlatok' },
  { id: 'mesocycles', to: '/train/mesocycles', label: 'Mesociklusok' },
]
