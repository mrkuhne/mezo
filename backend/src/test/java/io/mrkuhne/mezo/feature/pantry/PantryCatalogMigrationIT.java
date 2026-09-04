package io.mrkuhne.mezo.feature.pantry;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import liquibase.Contexts;
import liquibase.LabelExpression;
import liquibase.Liquibase;
import liquibase.database.Database;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.ClassLoaderResourceAccessor;
import org.junit.jupiter.api.Test;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * Drives Liquibase by hand on a throwaway Postgres: every changeset BEFORE the pantry_catalog
 * split, then legacy rows via JDBC (three users, overlapping foods, trim-only duplicates, an
 * identical-timestamp id-tiebreak pair, a meal_item/recipe_ingredient/protocol_item/
 * supplement_intake/pantry_import FK web, a soft-deleted-only row), then the split changeset — and
 * asserts the data-preserving invariants of spec §8. Standalone on purpose: the Spring test context
 * boots on an already-split schema, so this class does NOT extend AbstractIntegrationTest and never
 * touches the 147 seeded master rows.
 *
 * <p>Requires Docker unconditionally (both {@code @Test} methods start their own Testcontainer) —
 * it cannot run against a fixed/pre-migrated dev database, unlike most other ITs in this module.
 *
 * <p>NOTE on the brief: the brief's Step-1 snippet predates two amendments to the changeset —
 * (1) the {@code pantry_item_definition_archive} snapshot table (step 6, before the column drop),
 * and (2) the natural key being {@code lower(trim(...))} everywhere rather than plain {@code
 * lower(...)}. Both are exercised below; the brief's SQL literals are not used verbatim.
 */
@Testcontainers
class PantryCatalogMigrationIT {

    private static final String CHANGELOG = "db/changelog/db.changelog-master.yaml";
    private static final String SPLIT_SCRIPT = "202609021410_mezo-qw37.4_pantry_catalog_split.sql";
    private static final Path MASTER_YML = Path.of("src/main/resources/db/changelog/1.0.0/1.0.0_master.yml");

    // Instance (not static) field: the Testcontainers JUnit5 extension then starts a FRESH
    // container per @Test method. Both tests seed rows under the same static UUID constants and
    // commit some of them outside Liquibase's own transaction (plain autocommit JDBC), so sharing
    // one container/schema across methods would let one test's leftover rows corrupt the other's
    // natural-key uniqueness. A shared static container previously produced exactly that: a
    // spurious "uq_pantry_item_split_guard" duplicate in the dedupe test caused by the OTHER
    // test's Anna/Túró rows still sitting in the same database.
    @Container
    final PostgreSQLContainer PG = new PostgreSQLContainer(
        DockerImageName.parse("pgvector/pgvector:pg16").asCompatibleSubstituteFor("postgres"));

    private static final UUID ANNA = UUID.randomUUID();
    private static final UUID BELA = UUID.randomUUID();
    private static final UUID CSABA = UUID.randomUUID();

    // Túró: Anna (earliest, kcal 130) vs Béla (later, different case, price 1490) vs Csaba
    // (latest, trailing-space) -> ONE catalog row, Anna's numbers win.
    private static final UUID ANNA_TURO = UUID.randomUUID();
    private static final UUID BELA_TURO = UUID.randomUUID();
    // Trim-only duplicate: Csaba's 'Túró ' (trailing space) must collapse into the SAME catalog row.
    private static final UUID CSABA_TURO_PADDED = UUID.randomUUID();
    // Anna's own, unshared food.
    private static final UUID ANNA_ZAB = UUID.randomUUID();
    // Béla's soft-deleted-only Kefir: no live row anywhere shares its key -> its own is_deleted catalog row.
    private static final UUID BELA_KEFIR_DELETED = UUID.randomUUID();
    // Unshared, single row whose name is ONLY padding-dirty ('Kölesgolyó '): the dedupe key comparison
    // can't tell trim() apart from no-op here (there is no untrimmed sibling to "win" against), so this
    // is the one fixture that isolates whether the changeset's INSERT select-list itself trims the
    // stored name (steps 3/4: `trim(name)`) rather than just the natural-key WHERE/ORDER BY expressions.
    private static final UUID CSABA_KOLES_PADDED = UUID.randomUUID();
    // Two identical-created_at pairs (Rizottó, Levendula; see RIZOTTO_CREATED_AT below): prove the
    // `, id asc` tiebreak in the changeset's ORDER BY (steps 3/4), not just `created_at asc`. Within
    // each pair, LOW must be the one that ends up authoring the catalog row regardless of insertion
    // order — Rizottó's HIGH is inserted first (LOW second) and Levendula's LOW is inserted first
    // (HIGH second), deliberately mirroring each other. That mirroring matters: Postgres does not
    // guarantee any particular order among tied rows for a plain (non-tiebroken) sort, and this is not
    // just a theoretical concern here — a single pair on its own was observed to keep landing on the
    // correct row (by coincidence of physical/scan order) even with `, id asc` removed from the
    // changeset, while adding this second, oppositely-ordered pair reliably exposed the bug on BOTH
    // pairs. Relying on one pair alone would have been a coin flip; see the task-9 report for the
    // mutation-testing detail.
    private static final UUID RIZOTTO_HIGH = UUID.fromString("ffffffff-ffff-ffff-ffff-ffffffffffff");
    private static final UUID RIZOTTO_LOW = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final String RIZOTTO_CREATED_AT = "2026-01-01 10:00:00+00";
    private static final UUID LEVENDULA_LOW = UUID.fromString("00000000-0000-0000-0000-000000000002");
    private static final UUID LEVENDULA_HIGH = UUID.fromString("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee");

    private static final UUID MEAL = UUID.randomUUID();
    private static final UUID MEAL_ITEM = UUID.randomUUID();
    private static final UUID RECIPE = UUID.randomUUID();
    private static final UUID RECIPE_INGREDIENT = UUID.randomUUID();
    private static final UUID PROTOCOL = UUID.randomUUID();
    private static final UUID PROTOCOL_ITEM = UUID.randomUUID();
    private static final UUID SUPPLEMENT_INTAKE = UUID.randomUUID();
    private static final UUID PANTRY_IMPORT = UUID.randomUUID();

    @Test
    @SuppressWarnings("deprecation") // the Liquibase facade is deprecated in favour of CommandScope but still shipped
    void testSplit_shouldDedupeIntoOneCatalogRow_keepItemIdsAndFks_andArchiveDroppedColumns() throws Exception {
        int changesetsBeforeSplit = countChangesetsBeforeSplit();
        try (Connection conn = DriverManager.getConnection(PG.getJdbcUrl(), PG.getUsername(), PG.getPassword())) {
            Database db = DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(conn));
            Liquibase liquibase = new Liquibase(CHANGELOG, new ClassLoaderResourceAccessor(), db);
            liquibase.update(changesetsBeforeSplit, new Contexts(), new LabelExpression());
            seedLegacyRows(conn);
            conn.commit(); // Liquibase leaves the connection in manual-commit mode; make the seed durable before the split runs.

            // Bounded to exactly one more changeset (not an unbounded "apply everything remaining"):
            // changesets registered AFTER the split (mezo-qooi's status column, and others from main)
            // would otherwise run too, and this test only wants to exercise the split in isolation.
            liquibase.update(1, new Contexts(), new LabelExpression()); // applies exactly the split

            try (Statement st = conn.createStatement()) {
                // Túró group + Zabpehely + Kefir(deleted) + Kölesgolyó + Rizottó group + Levendula group
                // = 6 catalog rows, 5 live.
                assertThat(scalar(st, "select count(*) from pantry_catalog")).isEqualTo(6L);
                assertThat(scalar(st, "select count(*) from pantry_catalog where is_deleted = false")).isEqualTo(5L);

                // Dedupe: earliest created_at (Anna) wins the numbers and the trimmed name.
                assertThat(scalar(st, "select kcal from pantry_catalog where lower(trim(name)) = 'túró'"))
                    .isEqualTo(new BigDecimal("130"));
                assertThat(scalar(st, "select created_by from pantry_catalog where lower(trim(name)) = 'túró'"))
                    .isEqualTo(ANNA);
                assertThat(scalar(st, "select name from pantry_catalog where lower(trim(name)) = 'túró'"))
                    .isEqualTo("Túró"); // stored name is TRIMMED, not the padded legacy value

                // Trim behaviour: three items (Anna clean, Béla case-diff, Csaba trailing-space) collapse to ONE catalog row.
                assertThat(scalar(st, "select count(distinct catalog_id) from pantry_item where id in ('"
                    + ANNA_TURO + "','" + BELA_TURO + "','" + CSABA_TURO_PADDED + "')")).isEqualTo(1L);
                // ...and specifically all three of those pantry_item rows (not fewer) survived the split.
                assertThat(scalar(st, "select count(*) from pantry_item")).isEqualTo(10L);
                assertThat(scalar(st, "select count(*) from pantry_item where id in ('"
                    + ANNA_TURO + "','" + BELA_TURO + "','" + CSABA_TURO_PADDED + "')")).isEqualTo(3L);

                // Trim proof #2 (Important finding, spec review round 1): CSABA_KOLES_PADDED is the ONLY
                // row with this key, so there is no untrimmed sibling that could "win" the dedupe and make
                // this assertion pass by accident — it fails unless the changeset's INSERT select-list
                // itself trims the stored name (steps 3/4 `trim(name)`), not just the WHERE/ORDER BY key.
                // Verified: temporarily removing `trim(name)`/`trim(d.name)` from the two insert select-lists
                // in the changeset (leaving bare `name`/`d.name`) makes this assertion fail with the padded
                // value 'Kölesgolyó ' != 'Kölesgolyó'; restored the changeset byte-for-byte afterward.
                assertThat(scalar(st, "select name from pantry_catalog where lower(trim(name)) = 'kölesgolyó'"))
                    .isEqualTo("Kölesgolyó");

                // Id-tiebreak proof (Important finding, spec review round 1): each of the two pairs below
                // (Rizottó, Levendula) shares an IDENTICAL literal created_at within the pair, so only the
                // changeset's `, id asc` tiebreak (not `created_at asc` alone) can deterministically make the
                // LOWER id win. The pairs deliberately mirror each other's insertion order (Rizottó: HIGH
                // inserted first, LOW second; Levendula: LOW inserted first, HIGH second) because Postgres's
                // tie-order for a plain unstable sort is unspecified and, empirically, sensitive to the exact
                // row set being sorted (not just to one pair's own insertion order) — a single pair passed
                // this assertion even with `, id asc` removed from the changeset in one dataset shape and
                // failed in another, so relying on just one pair would have been a coin flip. With BOTH pairs
                // present, removing the tiebreak reliably breaks both (observed kcal 999/888 instead of
                // 50/60); restored the changeset byte-for-byte afterward. See mutation-testing notes in the
                // task-9 report for the empirical detail.
                assertThat(scalar(st, "select kcal from pantry_catalog where lower(trim(name)) = 'rizottó'"))
                    .isEqualTo(new BigDecimal("50"));
                assertThat(scalar(st, "select created_by from pantry_catalog where lower(trim(name)) = 'rizottó'"))
                    .isEqualTo(CSABA); // CSABA authored RIZOTTO_LOW
                assertThat(scalar(st, "select kcal from pantry_catalog where lower(trim(name)) = 'levendula'"))
                    .isEqualTo(new BigDecimal("60"));
                assertThat(scalar(st, "select created_by from pantry_catalog where lower(trim(name)) = 'levendula'"))
                    .isEqualTo(CSABA); // CSABA authored LEVENDULA_LOW

                // Losing rows' divergent values survive only in the archive, not in the winning catalog row.
                assertThat(scalar(st, "select price_huf from pantry_item where id = '" + BELA_TURO + "'"))
                    .isEqualTo(1490); // Béla's own per-user state is untouched (state column, not a definition column)
                assertThat(scalar(st, "select kcal from pantry_item_definition_archive where id = '" + BELA_TURO + "'"))
                    .isEqualTo(new BigDecimal("999")); // Béla's losing definition value preserved in the archive
                assertThat(scalar(st, "select kcal from pantry_item_definition_archive where id = '" + ANNA_TURO + "'"))
                    .isEqualTo(new BigDecimal("130")); // the winner's own pre-drop values are archived too (every row, not just losers)

                // catalog_id is NOT NULL for every row, including soft-deleted ones.
                assertThat(scalar(st, "select count(*) from pantry_item where catalog_id is null")).isEqualTo(0L);
                assertThat(scalar(st, "select catalog_id is not null from pantry_item where id = '" + BELA_KEFIR_DELETED + "'"))
                    .isEqualTo(true);

                // Soft-deleted-only Kefir got its own is_deleted catalog row; nothing orphaned.
                assertThat(scalar(st, "select is_deleted from pantry_catalog where lower(trim(name)) = 'kefir'")).isEqualTo(true);
                assertThat(scalar(st, "select created_by from pantry_catalog where lower(trim(name)) = 'kefir'")).isEqualTo(BELA);

                // pantry_item.id values are UNCHANGED and every FK consumer still resolves to the same rows.
                assertThat(scalar(st, "select pantry_item_id from meal_item where id = '" + MEAL_ITEM + "'")).isEqualTo(ANNA_TURO);
                assertThat(scalar(st, "select pantry_item_id from recipe_ingredient where id = '" + RECIPE_INGREDIENT + "'")).isEqualTo(ANNA_TURO);
                assertThat(scalar(st, "select pantry_item_id from protocol_item where id = '" + PROTOCOL_ITEM + "'")).isEqualTo(BELA_TURO);
                assertThat(scalar(st, "select pantry_item_id from supplement_intake where id = '" + SUPPLEMENT_INTAKE + "'")).isEqualTo(ANNA_ZAB);
                assertThat(scalar(st, "select pantry_item_id from pantry_import where id = '" + PANTRY_IMPORT + "'")).isEqualTo(BELA_KEFIR_DELETED);

                // The ON DELETE RESTRICT FKs are still enforced: deleting a referenced pantry_item must fail
                // (ANNA_TURO is referenced by both meal_item and recipe_ingredient; Postgres reports whichever
                // dependent it checks first, so assert on the row id rather than a specific constraint name).
                // Liquibase leaves this connection in manual-commit mode, so a failed statement aborts the
                // transaction until an explicit rollback() — each check below clears it for the next one.
                assertThatThrownBy(() -> st.execute("delete from pantry_item where id = '" + ANNA_TURO + "'"))
                    .hasMessageContaining("still referenced from table")
                    .hasMessageContaining(ANNA_TURO.toString());
                conn.rollback();
                assertThatThrownBy(() -> st.execute("delete from pantry_item where id = '" + BELA_TURO + "'"))
                    .hasMessageContaining("still referenced from table")
                    .hasMessageContaining(BELA_TURO.toString());
                conn.rollback();
                assertThatThrownBy(() -> st.execute("delete from pantry_item where id = '" + ANNA_ZAB + "'"))
                    .hasMessageContaining("still referenced from table")
                    .hasMessageContaining(ANNA_ZAB.toString());
                conn.rollback();

                // pantry_import's FK is SET NULL, not RESTRICT: deleting the soft-deleted Kefir shelf
                // row must succeed and null out the import feed's pointer rather than being blocked.
                st.execute("delete from pantry_item where id = '" + BELA_KEFIR_DELETED + "'");
                assertThat(scalar(st, "select pantry_item_id from pantry_import where id = '" + PANTRY_IMPORT + "'")).isNull();

                // Definition columns are gone from pantry_item, state columns stay.
                List<String> cols = columns(st, "pantry_item");
                assertThat(cols).doesNotContain("name", "brand", "kind", "kcal", "micros", "form", "caffeine", "source", "category");
                assertThat(cols).contains("catalog_id", "price_huf", "stock_qty", "dose", "protocol", "timing", "taken", "notes");

                // The archive exists, is unmanaged (not touched by ArchUnit's entity scan — no JPA mapping
                // expected), snapshotted one row per pre-split pantry_item (soft-deleted included), and its
                // column set is EXACTLY id + created_by + the 20 columns the changeset drops from pantry_item.
                assertThat(scalar(st, "select count(*) from pantry_item_definition_archive")).isEqualTo(10L);
                assertThat(scalar(st, "select name from pantry_item_definition_archive where id = '" + BELA_KEFIR_DELETED + "'"))
                    .isEqualTo("Kefir");
                assertThat(columns(st, "pantry_item_definition_archive")).containsExactlyInAnyOrder(
                    "id", "created_by", "kind", "name", "brand", "source", "category", "serving_amount",
                    "serving_unit", "kcal", "protein_g", "carbs_g", "fat_g", "fiber_g", "sugar_g", "salt_g",
                    "saturated_fat_g", "package_label", "micros", "nova", "form", "caffeine");

                assertThat(scalar(st, "select count(*) from pg_indexes where indexname = 'uq_pantry_item_created_by_catalog_id'")).isEqualTo(1L);
                assertThat(scalar(st, "select count(*) from pg_indexes where indexname = 'uq_pantry_catalog_natural'")).isEqualTo(1L);
                // The pre-flight guard index is created and dropped again within the same changeset — it must not linger.
                assertThat(scalar(st, "select count(*) from pg_indexes where indexname = 'uq_pantry_item_split_guard'")).isEqualTo(0L);
            }
        }
    }

    /**
     * Two LIVE rows for the SAME user sharing the trimmed natural key must make the split changeset
     * refuse cleanly (the pre-flight guard index in step 2), never half-apply.
     */
    @Test
    @SuppressWarnings("deprecation")
    void testSplit_shouldRefuseCleanly_whenOneUserHasTwoLiveRowsSharingTheNaturalKey() throws Exception {
        int changesetsBeforeSplit = countChangesetsBeforeSplit();
        try (Connection conn = DriverManager.getConnection(PG.getJdbcUrl(), PG.getUsername(), PG.getPassword())) {
            Database db = DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(conn));
            Liquibase liquibase = new Liquibase(CHANGELOG, new ClassLoaderResourceAccessor(), db);
            liquibase.update(changesetsBeforeSplit, new Contexts(), new LabelExpression());

            try (Statement st = conn.createStatement()) {
                st.execute("insert into app_user (id, email, password_hash, name) values ('" + ANNA
                    + "', 'anna@test.local', 'x', 'Anna')");
                st.execute("insert into pantry_item (id, created_by, created_at, kind, name, brand, source, "
                    + "serving_amount, serving_unit, kcal, price_huf) values "
                    + "(gen_random_uuid(), '" + ANNA + "', now() - interval '2 days', 'food', 'Túró', 'Mizo', 'manual', 100, 'g', 130, 990), "
                    // duplicate: same trimmed natural key, same user, both live
                    + "(gen_random_uuid(), '" + ANNA + "', now() - interval '1 day', 'food', ' túró ', 'MIZO', 'manual', 100, 'g', 140, 1200)");
            }
            conn.commit(); // Liquibase leaves the connection in manual-commit mode; make the seed durable before the split runs.

            // Bounded to exactly one more changeset for the same reason as the other test: an
            // unbounded update() would also attempt the changesets that now follow the split.
            assertThatThrownBy(() -> liquibase.update(1, new Contexts(), new LabelExpression()))
                .hasMessageContaining("uq_pantry_item_split_guard");

            // Rolled back cleanly: no half-applied split. The catalog table (created in the same
            // changeset, before the guard fires) must not exist as a leftover, and the pre-split
            // shape (two live pantry_item rows, definition columns still present) is untouched.
            // table_schema = 'public' pins these information_schema checks to OUR schema, so a
            // same-named object left behind in another schema can't silently pass "no partial state".
            try (Statement st = conn.createStatement()) {
                assertThat(scalar(st, "select count(*) from information_schema.tables "
                    + "where table_schema = 'public' and table_name = 'pantry_catalog'")).isEqualTo(0L);
                assertThat(scalar(st, "select count(*) from information_schema.tables "
                    + "where table_schema = 'public' and table_name = 'pantry_item_definition_archive'")).isEqualTo(0L);
                assertThat(scalar(st, "select count(*) from information_schema.columns "
                    + "where table_schema = 'public' and table_name = 'pantry_item' and column_name = 'catalog_id'")).isEqualTo(0L);
                assertThat(scalar(st, "select count(*) from pantry_item where created_by = '" + ANNA + "'")).isEqualTo(2L);
            }
        }
    }

    /**
     * Count of `- changeSet:` entries before the split's own entry, located by searching for the
     * split script rather than assuming it is the LAST one registered: several changesets now
     * follow it in master.yml (mezo-qooi's status column among them). Asserts the marker is unique
     * so a future rename cannot make this silently count the wrong prefix.
     */
    private static int countChangesetsBeforeSplit() throws IOException {
        String yml = Files.readString(MASTER_YML, StandardCharsets.UTF_8);
        String marker = "path: script/" + SPLIT_SCRIPT;
        int splitPathStart = yml.indexOf(marker);
        assertThat(splitPathStart).isNotNegative();
        assertThat(yml.indexOf(marker, splitPathStart + marker.length())).isEqualTo(-1);
        int changesetsThroughSplit = yml.substring(0, splitPathStart).split("- changeSet:", -1).length - 1;
        return changesetsThroughSplit - 1;
    }

    private static void seedLegacyRows(Connection conn) throws Exception {
        try (Statement st = conn.createStatement()) {
            st.execute("insert into app_user (id, email, password_hash, name) values "
                + "('" + ANNA + "', 'anna@test.local', 'x', 'Anna'), "
                + "('" + BELA + "', 'bela@test.local', 'x', 'Béla'), "
                + "('" + CSABA + "', 'csaba@test.local', 'x', 'Csaba')");

            // Anna: Túró/Mizo (kcal 130, earliest -> author) + Zabpehely.
            // Béla: túró/MIZO (kcal 999, later, price 1490) + a soft-deleted-only Kefir.
            // Csaba: 'Túró ' (trailing space) + 'MIZO' brand, latest -> trim-only duplicate of the same key.
            st.execute("insert into pantry_item (id, created_by, created_at, kind, name, brand, source, "
                + "serving_amount, serving_unit, kcal, price_huf) values "
                + "('" + ANNA_TURO + "', '" + ANNA + "', now() - interval '3 days', 'food', 'Túró', 'Mizo', 'manual', 100, 'g', 130, 990), "
                + "('" + BELA_TURO + "', '" + BELA + "', now() - interval '2 days', 'food', 'túró', 'MIZO', 'manual', 100, 'g', 999, 1490), "
                + "('" + CSABA_TURO_PADDED + "', '" + CSABA + "', now() - interval '1 day', 'food', 'Túró ', ' Mizo ', 'manual', 100, 'g', 777, 800), "
                + "('" + ANNA_ZAB + "', '" + ANNA + "', now(), 'food', 'Zabpehely', null, 'manual', 100, 'g', 370, null)");
            st.execute("insert into pantry_item (id, created_by, is_deleted, kind, name, source, "
                + "serving_amount, serving_unit, kcal) values "
                + "('" + BELA_KEFIR_DELETED + "', '" + BELA + "', true, 'food', 'Kefir', 'manual', 100, 'ml', 55)");

            // Unshared, padding-only food (see CSABA_KOLES_PADDED javadoc): isolates the INSERT
            // select-list's own trim(name) from the natural-key comparison's trim().
            st.execute("insert into pantry_item (id, created_by, created_at, kind, name, brand, source, "
                + "serving_amount, serving_unit, kcal) values ('"
                + CSABA_KOLES_PADDED + "', '" + CSABA + "', now(), 'food', 'Kölesgolyó ', null, 'manual', 100, 'g', 210)");

            // Identical-created_at pair (see RIZOTTO_* javadoc): HIGH inserted first, LOW second, so only
            // the changeset's explicit `, id asc` tiebreak can make the lower id (LOW) win deterministically.
            st.execute("insert into pantry_item (id, created_by, created_at, kind, name, brand, source, "
                + "serving_amount, serving_unit, kcal) values "
                + "('" + RIZOTTO_HIGH + "', '" + BELA + "', timestamptz '" + RIZOTTO_CREATED_AT + "', 'food', 'Rizottó', null, 'manual', 100, 'g', 999), "
                + "('" + RIZOTTO_LOW + "', '" + CSABA + "', timestamptz '" + RIZOTTO_CREATED_AT + "', 'food', 'Rizottó', null, 'manual', 100, 'g', 50)");

            // Reverse-insertion-order sibling pair (Levendula): LOW inserted FIRST, HIGH second — the mirror
            // image of Rizottó's insertion order. Together the two pairs cover both possible correlations
            // between id order and physical/insertion order (see the class-level comment above).
            st.execute("insert into pantry_item (id, created_by, created_at, kind, name, brand, source, "
                + "serving_amount, serving_unit, kcal) values "
                + "('" + LEVENDULA_LOW + "', '" + CSABA + "', timestamptz '" + RIZOTTO_CREATED_AT + "', 'food', 'Levendula', null, 'manual', 100, 'g', 60), "
                + "('" + LEVENDULA_HIGH + "', '" + BELA + "', timestamptz '" + RIZOTTO_CREATED_AT + "', 'food', 'Levendula', null, 'manual', 100, 'g', 888)");

            st.execute("insert into meal (id, created_by, logged_at, meal_date, slot) values ('"
                + MEAL + "', '" + ANNA + "', now(), current_date, 'breakfast')");
            st.execute("insert into meal_item (id, created_by, meal_id, line_order, source, pantry_item_id, amount, unit, "
                + "snapshot_name, snapshot_per, snapshot_basis_unit, snapshot_kcal, snapshot_protein_g, snapshot_carbs_g, snapshot_fat_g) values ('"
                + MEAL_ITEM + "', '" + ANNA + "', '" + MEAL + "', 0, 'pantry', '" + ANNA_TURO
                + "', 150, 'g', 'Túró', 100, 'g', 130, 18, 3.5, 5)");

            st.execute("insert into recipe (id, created_by, name, category) values ('"
                + RECIPE + "', '" + ANNA + "', 'Reggeli túrós', 'breakfast')");
            st.execute("insert into recipe_ingredient (id, created_by, recipe_id, pantry_item_id, amount, unit, line_order, "
                + "snapshot_name, snapshot_per, snapshot_basis_unit, snapshot_kcal, snapshot_protein_g, snapshot_carbs_g, snapshot_fat_g) values ('"
                + RECIPE_INGREDIENT + "', '" + ANNA + "', '" + RECIPE + "', '" + ANNA_TURO
                + "', 100, 'g', 0, 'Túró', 100, 'g', 130, 18, 3.5, 5)");

            st.execute("insert into protocol (id, created_by, version, built_at, status) values ('"
                + PROTOCOL + "', '" + BELA + "', 1, now(), 'active')");
            st.execute("insert into protocol_item (id, created_by, protocol_id, pantry_item_id, item_order) values ('"
                + PROTOCOL_ITEM + "', '" + BELA + "', '" + PROTOCOL + "', '" + BELA_TURO + "', 0)");

            st.execute("insert into supplement_intake (id, created_by, pantry_item_id, taken_at, taken_date) values ('"
                + SUPPLEMENT_INTAKE + "', '" + ANNA + "', '" + ANNA_ZAB + "', now(), current_date)");

            st.execute("insert into pantry_import (id, created_by, source, item_name, pantry_item_id, imported_at) values ('"
                + PANTRY_IMPORT + "', '" + BELA + "', 'manual', 'Kefir', '" + BELA_KEFIR_DELETED + "', now())");
        }
    }

    private static Object scalar(Statement st, String sql) throws Exception {
        try (ResultSet rs = st.executeQuery(sql)) {
            assertThat(rs.next()).as(sql).isTrue();
            return rs.getObject(1);
        }
    }

    private static List<String> columns(Statement st, String table) throws Exception {
        List<String> out = new ArrayList<>();
        try (ResultSet rs = st.executeQuery(
                "select column_name from information_schema.columns "
                    + "where table_schema = 'public' and table_name = '" + table + "'")) {
            while (rs.next()) out.add(rs.getString(1));
        }
        return out;
    }
}
