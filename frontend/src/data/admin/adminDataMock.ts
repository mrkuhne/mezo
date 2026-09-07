import { MOCK_ANNA_ID, MOCK_BELA_ID, MOCK_OWNER_ID } from '@/data/admin/adminMock'
import type {
  AdminRowPageResponse,
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

// The prototype's own worked example (5 food_log rows, one soft-deleted, one nested jsonb
// `payload`, `created_by` an FK into app_user) — kept close to admin-body.html's ROWS fixture.
export const ADMIN_ROWS_MOCK: Record<string, AdminRowPageResponse> = {
  food_log: {
    table: 'food_log',
    page: 0,
    size: 5,
    total: 8,
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

export function adminRowsMockFor(table: string): AdminRowPageResponse {
  return ADMIN_ROWS_MOCK[table] ?? ADMIN_ROWS_MOCK.food_log
}

/** Convenience lookup for a table's descriptor — used by the MSW default handler. */
export function adminTableDescriptor(name: string): AdminTableDescriptor | undefined {
  return ADMIN_TABLES_MOCK.tables.find((t) => t.name === name)
}
