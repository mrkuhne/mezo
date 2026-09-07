import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'

// Admin hub data browser (mezo-d5iy.12) — OWNER-only read-only row browser over the owned
// tables (api/feature/admin-data/admin-data.yml). Identifiers are validated backend-side
// against an information_schema allowlist; credential-looking and pgvector (USER-DEFINED)
// columns are simply absent from the catalog — nothing here assumes a fixed column set.
export type AdminColumnDescriptor = components['schemas']['AdminColumnDescriptor']
export type AdminTableDescriptor = components['schemas']['AdminTableDescriptor']
export type AdminTableListResponse = components['schemas']['AdminTableListResponse']
export type AdminViewDescriptor = components['schemas']['AdminViewDescriptor']
export type AdminRowPageResponse = components['schemas']['AdminRowPageResponse']

export type AdminRowSortDir = 'asc' | 'desc'

export interface AdminRowsParams {
  table: string
  userId?: string | null
  page?: number
  size?: number
  sort?: string | null
  dir?: AdminRowSortDir
  includeDeleted?: boolean
}

function rowsQuery(params: AdminRowsParams): string {
  const search = new URLSearchParams()
  if (params.userId) search.set('userId', params.userId)
  if (params.page != null) search.set('page', String(params.page))
  if (params.size != null) search.set('size', String(params.size))
  if (params.sort) search.set('sort', params.sort)
  if (params.dir) search.set('dir', params.dir)
  if (params.includeDeleted) search.set('includeDeleted', 'true')
  const s = search.toString()
  return s ? `?${s}` : ''
}

export const adminDataApi = {
  tables: (): Promise<AdminTableListResponse> => apiFetch<AdminTableListResponse>('/api/admin/data/tables'),
  views: (): Promise<AdminViewDescriptor[]> => apiFetch<AdminViewDescriptor[]>('/api/admin/data/views'),
  // `size` is clamped server-side, not rejected — a caller asking for 5000 gets 200 back with
  // whatever `size` the server actually used. Callers must render `response.size`, never the
  // requested one.
  rows: (params: AdminRowsParams): Promise<AdminRowPageResponse> =>
    apiFetch<AdminRowPageResponse>(`/api/admin/data/tables/${encodeURIComponent(params.table)}/rows${rowsQuery(params)}`),
}
