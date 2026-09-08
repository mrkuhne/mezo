import { MOCK_ANNA_ID, MOCK_BELA_ID, MOCK_OWNER_ID } from '@/data/admin/adminMock'
import type {
  AdminRowPageResponse,
  AdminRowsParams,
  AdminTableDescriptor,
  AdminTableListResponse,
  AdminViewDescriptor,
} from '@/data/admin/adminDataApi'

// Admin data-browser seed (mezo-d5iy.12). Six browsable tables + six convenience views, one
// view per table, mirroring the design_2.0 prototype's own #d-data screen (food_log with a
// jsonb `payload` column and a `created_by` FK is the prototype's own worked example — kept
// here verbatim so JsonCell/DataTable have a realistic fixture to expand/navigate). Reuses
// MOCK_OWNER_ID/MOCK_ANNA_ID/MOCK_BELA_ID from adminMock.ts so an FK jump into `app_user` lands
// on rows the other admin surfaces already know about.

export const ADMIN_TABLES_MOCK: AdminTableListResponse = {
  tables: [
    {
      name: 'app_user',
      ownerColumn: 'id',
      softDeletable: false,
      columns: [
        { name: 'id', type: 'uuid', foreignKey: false, referencesTable: null },
        { name: 'email', type: 'text', foreignKey: false, referencesTable: null },
        { name: 'name', type: 'text', foreignKey: false, referencesTable: null },
        { name: 'role', type: 'text', foreignKey: false, referencesTable: null },
        { name: 'status', type: 'text', foreignKey: false, referencesTable: null },
        { name: 'created_at', type: 'timestamptz', foreignKey: false, referencesTable: null },
      ],
    },
    {
      name: 'food_log',
      ownerColumn: 'created_by',
      softDeletable: true,
      columns: [
        { name: 'id', type: 'uuid', foreignKey: false, referencesTable: null },
        { name: 'created_by', type: 'uuid', foreignKey: true, referencesTable: 'app_user' },
        { name: 'day', type: 'date', foreignKey: false, referencesTable: null },
        { name: 'meal', type: 'text', foreignKey: false, referencesTable: null },
        { name: 'kcal', type: 'integer', foreignKey: false, referencesTable: null },
        { name: 'payload', type: 'jsonb', foreignKey: false, referencesTable: null },
        { name: 'note', type: 'text', foreignKey: false, referencesTable: null },
        { name: 'created_at', type: 'timestamptz', foreignKey: false, referencesTable: null },
      ],
    },
    {
      name: 'train_session',
      ownerColumn: 'created_by',
      softDeletable: true,
      columns: [
        { name: 'id', type: 'uuid', foreignKey: false, referencesTable: null },
        { name: 'created_by', type: 'uuid', foreignKey: true, referencesTable: 'app_user' },
        { name: 'day', type: 'date', foreignKey: false, referencesTable: null },
        { name: 'kind', type: 'text', foreignKey: false, referencesTable: null },
        { name: 'sets_count', type: 'integer', foreignKey: false, referencesTable: null },
        { name: 'created_at', type: 'timestamptz', foreignKey: false, referencesTable: null },
      ],
    },
    {
      name: 'journal_note',
      ownerColumn: 'created_by',
      softDeletable: true,
      columns: [
        { name: 'id', type: 'uuid', foreignKey: false, referencesTable: null },
        { name: 'created_by', type: 'uuid', foreignKey: true, referencesTable: 'app_user' },
        { name: 'day', type: 'date', foreignKey: false, referencesTable: null },
        { name: 'note', type: 'text', foreignKey: false, referencesTable: null },
        { name: 'created_at', type: 'timestamptz', foreignKey: false, referencesTable: null },
      ],
    },
    {
      name: 'habit_tick',
      ownerColumn: 'created_by',
      softDeletable: false,
      columns: [
        { name: 'id', type: 'uuid', foreignKey: false, referencesTable: null },
        { name: 'created_by', type: 'uuid', foreignKey: true, referencesTable: 'app_user' },
        { name: 'habit_key', type: 'text', foreignKey: false, referencesTable: null },
        { name: 'day', type: 'date', foreignKey: false, referencesTable: null },
        { name: 'created_at', type: 'timestamptz', foreignKey: false, referencesTable: null },
      ],
    },
    {
      name: 'memory_item',
      ownerColumn: 'created_by',
      softDeletable: true,
      columns: [
        { name: 'id', type: 'uuid', foreignKey: false, referencesTable: null },
        { name: 'created_by', type: 'uuid', foreignKey: true, referencesTable: 'app_user' },
        { name: 'kind', type: 'text', foreignKey: false, referencesTable: null },
        { name: 'payload', type: 'jsonb', foreignKey: false, referencesTable: null },
        { name: 'created_at', type: 'timestamptz', foreignKey: false, referencesTable: null },
      ],
    },
  ],
} satisfies AdminTableListResponse

export const ADMIN_TABLES_EMPTY: AdminTableListResponse = { tables: [] }

export const ADMIN_VIEWS_MOCK: AdminViewDescriptor[] = [
  { id: 'recent-food', label: 'Legutóbbi étkezések', table: 'food_log', defaultSort: 'created_at', defaultDir: 'desc' },
  { id: 'active-training', label: 'Aktív edzések', table: 'train_session', defaultSort: 'day', defaultDir: 'desc' },
  { id: 'recent-journal', label: 'Legutóbbi naplóbejegyzések', table: 'journal_note', defaultSort: 'created_at', defaultDir: 'desc' },
  { id: 'habit-ticks', label: 'Szokás-pipák', table: 'habit_tick', defaultSort: 'day', defaultDir: 'desc' },
  { id: 'memory-items', label: 'Memória elemek', table: 'memory_item', defaultSort: 'created_at', defaultDir: 'desc' },
  { id: 'users', label: 'Userek', table: 'app_user', defaultSort: 'created_at', defaultDir: 'asc' },
]

export const ADMIN_VIEWS_EMPTY: AdminViewDescriptor[] = []

const FOOD_LOG_COLUMNS = ADMIN_TABLES_MOCK.tables[1].columns
const TRAIN_SESSION_COLUMNS = ADMIN_TABLES_MOCK.tables[2].columns
const JOURNAL_NOTE_COLUMNS = ADMIN_TABLES_MOCK.tables[3].columns
const HABIT_TICK_COLUMNS = ADMIN_TABLES_MOCK.tables[4].columns
const MEMORY_ITEM_COLUMNS = ADMIN_TABLES_MOCK.tables[5].columns
const APP_USER_COLUMNS = ADMIN_TABLES_MOCK.tables[0].columns

// The prototype's own worked example (25 food_log rows spanning 5+ mock pages at the default
// size:5, so paging is actually exercisable in mock mode — Task 18's diagnosis: the old 5-row
// fixture couldn't ever show a second page). Rows 0-4 are the ORIGINAL fixture, unchanged and in
// their original order — tests keyed to `rows[0]`/`rows[2]` (AdminDataPage.test.tsx's FK-jump and
// highlight cases) still land on the same ids on the still-default-sorted first page. Rows 5-24
// add: a few `is_deleted: true` rows (soft-delete toggle has something to actually filter) and a
// spread of `created_by` across MOCK_OWNER_ID/MOCK_ANNA_ID/MOCK_BELA_ID (userId filter has more
// than one user's worth of rows to narrow). `is_deleted` isn't in FOOD_LOG_COLUMNS/the catalog —
// same as the real soft-delete flag (api/feature/admin-data), it's a filter input, never a
// rendered column.
export const ADMIN_ROWS_MOCK: Record<string, AdminRowPageResponse> = {
  food_log: {
    table: 'food_log',
    page: 0,
    size: 5,
    total: 25,
    columns: FOOD_LOG_COLUMNS,
    rows: [
      {
        id: 'f7a1e2c3-0000-4000-8000-000000000001', created_by: MOCK_ANNA_ID, day: '2026-09-07', meal: 'reggeli',
        kcal: 512, payload: { items: [{ name: 'zabpehely', g: 80, kcal: 302 }, { name: 'banán', g: 118, kcal: 105 }], source: 'etel-becsles', confidence: 0.82 },
        note: 'zabkása, banán, whey', created_at: '2026-09-07T07:41:00Z',
      },
      {
        id: 'b2049e00-0000-4000-8000-000000000002', created_by: MOCK_ANNA_ID, day: '2026-09-07', meal: 'ebéd',
        kcal: 780, payload: { items: [{ name: 'csirkemell', g: 200, kcal: 330 }, { name: 'jázmin rizs', g: 150, kcal: 195 }], source: 'kézi', confidence: null },
        note: 'csirke, rizs, saláta', created_at: '2026-09-07T13:02:00Z',
      },
      {
        id: '3cd84100-0000-4000-8000-000000000003', created_by: MOCK_BELA_ID, day: '2026-09-06', meal: 'vacsora',
        kcal: 640, payload: { items: [{ name: 'lazacfilé', g: 180, kcal: 372 }, { name: 'főtt burgonya', g: 250, kcal: 215 }], source: 'etel-becsles', confidence: 0.77 },
        note: null, created_at: '2026-09-06T19:48:00Z',
      },
      {
        id: '9ee07700-0000-4000-8000-000000000004', created_by: MOCK_ANNA_ID, day: '2026-09-06', meal: 'reggeli',
        kcal: 498, payload: { items: [{ name: 'tojás', db: 3, kcal: 234 }], source: 'kézi', confidence: null },
        note: 'tojásrántotta, pirítós', created_at: '2026-09-06T07:12:00Z',
      },
      {
        id: '1a450200-0000-4000-8000-000000000005', created_by: MOCK_OWNER_ID, day: '2026-09-05', meal: 'ebéd',
        kcal: 712, payload: { items: [{ name: 'marhapörkölt', g: 300, kcal: 495 }, { name: 'tarhonya', g: 140, kcal: 217 }], source: 'kézi', confidence: null },
        note: 'marhapörkölt, tarhonya', created_at: '2026-09-05T12:55:00Z',
      },
      {
        id: '1a450200-0000-4000-8000-000000000006', created_by: MOCK_BELA_ID, day: '2026-09-05', meal: 'reggeli',
        kcal: 455, payload: { items: [{ name: 'müzli', g: 60, kcal: 240 }, { name: 'tej', g: 200, kcal: 130 }], source: 'kézi', confidence: null },
        note: null, created_at: '2026-09-05T07:20:00Z',
      },
      {
        id: '1a450200-0000-4000-8000-000000000007', created_by: MOCK_ANNA_ID, day: '2026-09-04', meal: 'uzsonna',
        kcal: 220, payload: { items: [{ name: 'görögjoghurt', g: 150, kcal: 140 }, { name: 'méz', g: 20, kcal: 60 }], source: 'etel-becsles', confidence: 0.9 },
        note: 'gyors uzsi', created_at: '2026-09-04T16:10:00Z',
      },
      {
        id: '1a450200-0000-4000-8000-000000000008', created_by: MOCK_OWNER_ID, day: '2026-09-04', meal: 'ebéd',
        kcal: 690, payload: { items: [{ name: 'pulykamell', g: 200, kcal: 260 }, { name: 'bulgur', g: 160, kcal: 210 }], source: 'kézi', confidence: null },
        note: null, created_at: '2026-09-04T12:40:00Z',
        is_deleted: true,
      },
      {
        id: '1a450200-0000-4000-8000-000000000009', created_by: MOCK_ANNA_ID, day: '2026-09-04', meal: 'vacsora',
        kcal: 605, payload: { items: [{ name: 'zöldségleves', g: 300, kcal: 120 }, { name: 'grillcsirke', g: 180, kcal: 300 }], source: 'kézi', confidence: null },
        note: 'könnyű vacsi', created_at: '2026-09-04T19:15:00Z',
      },
      {
        id: '1a450200-0000-4000-8000-000000000010', created_by: MOCK_BELA_ID, day: '2026-09-03', meal: 'reggeli',
        kcal: 480, payload: { items: [{ name: 'tojásrántotta', db: 2, kcal: 180 }, { name: 'teljes kiőrlésű pirítós', g: 60, kcal: 150 }], source: 'kézi', confidence: null },
        note: null, created_at: '2026-09-03T07:05:00Z',
      },
      {
        id: '1a450200-0000-4000-8000-000000000011', created_by: MOCK_OWNER_ID, day: '2026-09-03', meal: 'ebéd',
        kcal: 730, payload: { items: [{ name: 'bableves', g: 350, kcal: 310 }, { name: 'kolbász', g: 80, kcal: 260 }], source: 'kézi', confidence: null },
        note: 'vasárnapi ebéd', created_at: '2026-09-03T13:30:00Z',
      },
      {
        id: '1a450200-0000-4000-8000-000000000012', created_by: MOCK_ANNA_ID, day: '2026-09-03', meal: 'vacsora',
        kcal: 410, payload: { items: [{ name: 'saláta', g: 250, kcal: 90 }, { name: 'tonhal', g: 120, kcal: 200 }], source: 'etel-becsles', confidence: 0.71 },
        note: null, created_at: '2026-09-03T19:50:00Z',
        is_deleted: true,
      },
      {
        id: '1a450200-0000-4000-8000-000000000013', created_by: MOCK_BELA_ID, day: '2026-09-02', meal: 'uzsonna',
        kcal: 180, payload: { items: [{ name: 'alma', g: 150, kcal: 80 }, { name: 'mandula', g: 20, kcal: 115 }], source: 'kézi', confidence: null },
        note: null, created_at: '2026-09-02T16:00:00Z',
      },
      {
        id: '1a450200-0000-4000-8000-000000000014', created_by: MOCK_OWNER_ID, day: '2026-09-02', meal: 'reggeli',
        kcal: 520, payload: { items: [{ name: 'zabkása', g: 80, kcal: 300 }, { name: 'áfonya', g: 60, kcal: 35 }], source: 'kézi', confidence: null },
        note: 'napi rutin', created_at: '2026-09-02T07:30:00Z',
      },
      {
        id: '1a450200-0000-4000-8000-000000000015', created_by: MOCK_ANNA_ID, day: '2026-09-02', meal: 'ebéd',
        kcal: 750, payload: { items: [{ name: 'rizottó', g: 300, kcal: 480 }, { name: 'parmezán', g: 20, kcal: 90 }], source: 'kézi', confidence: null },
        note: null, created_at: '2026-09-02T13:10:00Z',
      },
      {
        id: '1a450200-0000-4000-8000-000000000016', created_by: MOCK_BELA_ID, day: '2026-09-01', meal: 'vacsora',
        kcal: 560, payload: { items: [{ name: 'gyros', g: 250, kcal: 480 }], source: 'etel-becsles', confidence: 0.68 },
        note: 'gyors kaja', created_at: '2026-09-01T20:05:00Z',
        is_deleted: true,
      },
      {
        id: '1a450200-0000-4000-8000-000000000017', created_by: MOCK_OWNER_ID, day: '2026-09-01', meal: 'reggeli',
        kcal: 470, payload: { items: [{ name: 'omlett', db: 3, kcal: 280 }, { name: 'sonka', g: 40, kcal: 60 }], source: 'kézi', confidence: null },
        note: null, created_at: '2026-09-01T07:15:00Z',
      },
      {
        id: '1a450200-0000-4000-8000-000000000018', created_by: MOCK_ANNA_ID, day: '2026-08-31', meal: 'ebéd',
        kcal: 665, payload: { items: [{ name: 'currys csirke', g: 250, kcal: 420 }, { name: 'basmati rizs', g: 150, kcal: 195 }], source: 'kézi', confidence: null },
        note: null, created_at: '2026-08-31T12:50:00Z',
      },
      {
        id: '1a450200-0000-4000-8000-000000000019', created_by: MOCK_BELA_ID, day: '2026-08-31', meal: 'reggeli',
        kcal: 390, payload: { items: [{ name: 'gyümölcssaláta', g: 200, kcal: 140 }, { name: 'kefir', g: 200, kcal: 120 }], source: 'etel-becsles', confidence: 0.85 },
        note: null, created_at: '2026-08-31T07:40:00Z',
      },
      {
        id: '1a450200-0000-4000-8000-000000000020', created_by: MOCK_OWNER_ID, day: '2026-08-30', meal: 'vacsora',
        kcal: 610, payload: { items: [{ name: 'sült hal', g: 200, kcal: 280 }, { name: 'párolt zöldség', g: 200, kcal: 90 }], source: 'kézi', confidence: null },
        note: 'egészséges vacsi', created_at: '2026-08-30T19:20:00Z',
      },
      {
        id: '1a450200-0000-4000-8000-000000000021', created_by: MOCK_ANNA_ID, day: '2026-08-30', meal: 'uzsonna',
        kcal: 250, payload: { items: [{ name: 'proteinturmix', g: 300, kcal: 250 }], source: 'kézi', confidence: null },
        note: 'edzés utáni', created_at: '2026-08-30T17:45:00Z',
      },
      {
        id: '1a450200-0000-4000-8000-000000000022', created_by: MOCK_BELA_ID, day: '2026-08-29', meal: 'ebéd',
        kcal: 700, payload: { items: [{ name: 'sertésborda', g: 200, kcal: 460 }, { name: 'krumplipüré', g: 200, kcal: 210 }], source: 'kézi', confidence: null },
        note: null, created_at: '2026-08-29T13:05:00Z',
        is_deleted: true,
      },
      {
        id: '1a450200-0000-4000-8000-000000000023', created_by: MOCK_OWNER_ID, day: '2026-08-29', meal: 'reggeli',
        kcal: 505, payload: { items: [{ name: 'shakshuka', db: 2, kcal: 320 }, { name: 'pita', g: 50, kcal: 130 }], source: 'kézi', confidence: null },
        note: null, created_at: '2026-08-29T07:50:00Z',
      },
      {
        id: '1a450200-0000-4000-8000-000000000024', created_by: MOCK_ANNA_ID, day: '2026-08-28', meal: 'vacsora',
        kcal: 445, payload: { items: [{ name: 'quinoa saláta', g: 250, kcal: 300 }, { name: 'avokádó', g: 80, kcal: 130 }], source: 'etel-becsles', confidence: 0.79 },
        note: null, created_at: '2026-08-28T19:35:00Z',
      },
      {
        id: '1a450200-0000-4000-8000-000000000025', created_by: MOCK_BELA_ID, day: '2026-08-28', meal: 'reggeli',
        kcal: 415, payload: { items: [{ name: 'zabkeksz', db: 4, kcal: 240 }, { name: 'kávé tejjel', g: 200, kcal: 40 }], source: 'kézi', confidence: null },
        note: null, created_at: '2026-08-28T07:00:00Z',
      },
    ],
  },
  train_session: {
    table: 'train_session',
    page: 0,
    size: 2,
    total: 2,
    columns: TRAIN_SESSION_COLUMNS,
    rows: [
      { id: 'aa000000-0000-4000-8000-000000000011', created_by: MOCK_ANNA_ID, day: '2026-09-07', kind: 'felső test', sets_count: 18, created_at: '2026-09-07T18:20:00Z' },
      { id: 'aa000000-0000-4000-8000-000000000012', created_by: MOCK_BELA_ID, day: '2026-09-05', kind: 'láb', sets_count: 14, created_at: '2026-09-05T17:10:00Z' },
    ],
  },
  journal_note: {
    table: 'journal_note',
    page: 0,
    size: 2,
    total: 2,
    columns: JOURNAL_NOTE_COLUMNS,
    rows: [
      { id: 'bb000000-0000-4000-8000-000000000021', created_by: MOCK_ANNA_ID, day: '2026-09-06', note: 'jó edzés volt', created_at: '2026-09-06T21:00:00Z' },
      { id: 'bb000000-0000-4000-8000-000000000022', created_by: MOCK_OWNER_ID, day: '2026-09-04', note: null, created_at: '2026-09-04T20:15:00Z' },
    ],
  },
  habit_tick: {
    table: 'habit_tick',
    page: 0,
    size: 2,
    total: 2,
    columns: HABIT_TICK_COLUMNS,
    rows: [
      { id: 'cc000000-0000-4000-8000-000000000031', created_by: MOCK_ANNA_ID, habit_key: 'meditation', day: '2026-09-07', created_at: '2026-09-07T06:30:00Z' },
      { id: 'cc000000-0000-4000-8000-000000000032', created_by: MOCK_BELA_ID, habit_key: 'water', day: '2026-09-07', created_at: '2026-09-07T09:00:00Z' },
    ],
  },
  memory_item: {
    table: 'memory_item',
    page: 0,
    size: 2,
    total: 2,
    columns: MEMORY_ITEM_COLUMNS,
    rows: [
      { id: 'dd000000-0000-4000-8000-000000000041', created_by: MOCK_ANNA_ID, kind: 'fact', payload: { text: 'reggel jobban tanul' }, created_at: '2026-09-06T08:00:00Z' },
      { id: 'dd000000-0000-4000-8000-000000000042', created_by: MOCK_OWNER_ID, kind: 'preference', payload: { text: 'nem szereti a brokkolit' }, created_at: '2026-09-03T08:00:00Z' },
    ],
  },
  app_user: {
    table: 'app_user',
    page: 0,
    size: 3,
    total: 3,
    columns: APP_USER_COLUMNS,
    rows: [
      { id: MOCK_OWNER_ID, email: 'daniel@mezo.local', name: 'Daniel', role: 'OWNER', status: 'ACTIVE', created_at: '2026-06-01T08:00:00Z' },
      { id: MOCK_ANNA_ID, email: 'anna@test.local', name: 'Anna', role: 'USER', status: 'ACTIVE', created_at: '2026-08-02T18:20:00Z' },
      { id: MOCK_BELA_ID, email: 'bela@test.local', name: 'Béla', role: 'USER', status: 'DISABLED', created_at: '2026-08-05T09:00:00Z' },
    ],
  },
}

export const ADMIN_ROWS_EMPTY: AdminRowPageResponse = { table: '', page: 0, size: 50, total: 0, columns: [], rows: [] }

/**
 * Shared row-shaping for the mock rows fixture and the MSW handler (Task 18's fix): sort → filter
 * by `userId` → filter soft-deleted rows unless `includeDeleted` → slice to `page`/`size`, with
 * `total` recomputed off the FILTERED set (not the fixture's raw length) so paging math and the
 * "N sor" header agree with what's actually being shown. `base.page`/`base.size` are only the
 * fallback when the caller doesn't specify — every param this reads mirrors the ones that ride in
 * `ADMIN_ROWS_KEY` (adminDataHooks.ts).
 */
export function sliceRows(base: AdminRowPageResponse, params: AdminRowsParams): AdminRowPageResponse {
  let rows = base.rows
  if (params.userId) {
    rows = rows.filter((r) => r.created_by === params.userId)
  }
  if (!params.includeDeleted) {
    rows = rows.filter((r) => !r.is_deleted)
  }
  if (params.sort) {
    const sortKey = params.sort
    const dir = params.dir ?? 'desc'
    rows = [...rows].sort((a, b) => {
      const av = a[sortKey] as string | number | boolean | null | undefined
      const bv = b[sortKey] as string | number | boolean | null | undefined
      if (av == null && bv == null) return 0
      if (av == null) return dir === 'asc' ? -1 : 1
      if (bv == null) return dir === 'asc' ? 1 : -1
      if (av < bv) return dir === 'asc' ? -1 : 1
      if (av > bv) return dir === 'asc' ? 1 : -1
      return 0
    })
  }
  const total = rows.length
  const size = params.size ?? base.size
  const page = params.page ?? 0
  const start = page * size
  return { ...base, page, size, total, rows: rows.slice(start, start + size) }
}

export function adminRowsMockFor(params: AdminRowsParams): AdminRowPageResponse {
  const base = ADMIN_ROWS_MOCK[params.table] ?? ADMIN_ROWS_MOCK.food_log
  return sliceRows(base, params)
}

/** Convenience lookup for a table's descriptor — used by the MSW default handler. */
export function adminTableDescriptor(name: string): AdminTableDescriptor | undefined {
  return ADMIN_TABLES_MOCK.tables.find((t) => t.name === name)
}
