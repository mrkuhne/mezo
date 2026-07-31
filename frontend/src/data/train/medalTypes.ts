import type { components } from '@/data/_client/api.gen'

// Contract types generated from api/openapi.yml — regenerate with `pnpm generate:api`.
export type Medal = components['schemas']['Medal']
export type MedalType = NonNullable<Medal['type']>
export type MedalTier = NonNullable<Medal['tier']>
