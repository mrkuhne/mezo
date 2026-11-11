package io.mrkuhne.mezo.ops;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Statement;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Rehearsal of scripts/ops/boop-b1-merge-accounts.sql + its rollback (mezo-r36n9.11) on a production-shaped
 * synthetic dataset: FROM = Boop account (35 apple_health nights, 12 on dates where TO has a night, 61 daily
 * metrics, 16 workouts, 9 calendar events, 1 brief, 1 weight); TO = original account (19 screenshot + 5 manual
 * nights, 39 weights).
 *
 * <p>The scripts are psql scripts. {@link #psql} runs their text over JDBC after a deliberately tiny
 * substitution: {@code \set}/{@code \echo} lines are dropped, {@code :'from_user'}/{@code :'to_user'} become
 * uuid literals, and the {@code \if :{?apply} ... \else ... \endif} tail keeps exactly one branch.
 */
class BoopB1MergeScriptIT extends AbstractIntegrationTest {

    private static final Path MERGE = Path.of("..", "scripts", "ops", "boop-b1-merge-accounts.sql");
    private static final Path ROLLBACK = Path.of("..", "scripts", "ops", "boop-b1-merge-accounts-rollback.sql");
    private static final List<String> TABLES = List.of("sleep_log", "daily_metric", "wearable_workout",
        "calendar_event", "boop_brief", "weight_log", "workout_time_override");
    private static final LocalDate TO_BASE = LocalDate.parse("2026-08-01");
    private static final LocalDate FROM_BASE = LocalDate.parse("2026-10-01");
    /** TO night indexes that FROM also has a night on: 9 screenshot (0..8) + 3 manual (19..21). */
    private static final int[] COLLIDING = {0, 1, 2, 3, 4, 5, 6, 7, 8, 19, 20, 21};

    @Autowired private JdbcTemplate jdbc;
    @Autowired private DatabasePopulator databasePopulator;

    private UUID from;
    private UUID to;

    @BeforeEach
    void seed() {
        dropBackups();
        from = databasePopulator.populateUser("boop-from@test.local");
        to = databasePopulator.populateUser("boop-to@test.local");

        // TO: 19 screenshot + 5 manual nights, quality set on all, 39 weights.
        for (int i = 0; i < 24; i++) {
            boolean screenshot = i < 19;
            jdbc.update("""
                insert into sleep_log (created_by, date, bedtime, wakeup, duration_h, quality, awakenings, notes,
                    source, source_quality_pct, in_bed_min, deep_min)
                values (?, ?, '23:30', '07:00', 7.5, ?, 2, 'note', ?, ?, ?, ?)""",
                to, TO_BASE.plusDays(i), 5 + i % 5, screenshot ? "screenshot" : "manual",
                screenshot ? 80 + i % 10 : null, screenshot ? 480 : null, screenshot ? 70 : null);
        }
        for (int i = 0; i < 39; i++) {
            jdbc.update("insert into weight_log (created_by, date, weight_kg) values (?, ?, ?)",
                to, TO_BASE.plusDays(i), 80 + i * 0.01);
        }

        // FROM: 35 apple_health nights: 12 on TO's dates, 23 on fresh dates.
        for (int k = 0; k < 35; k++) {
            LocalDate date = k < 12 ? TO_BASE.plusDays(COLLIDING[k]) : FROM_BASE.plusDays(k);
            jdbc.update("""
                insert into sleep_log (created_by, date, bedtime, wakeup, duration_h, source, in_bed_min, awake_min,
                    light_min, rem_min, deep_min, hypnogram, sleeping_hr, source_app, external_id)
                values (?, ?, '23:10', '06:50', 7.33, 'apple_health', 450, 20, 250, 90, 90,
                    '{"stages":[1,2,3]}'::jsonb, 52, 'Sleep Cycle', ?)""",
                from, date, "hk-night-" + k);
        }
        // FROM keeps a soft-deleted night and a live non-apple_health night: neither may move.
        jdbc.update("""
            insert into sleep_log (created_by, date, source, external_id, is_deleted)
            values (?, ?, 'apple_health', 'hk-tombstone', true)""", from, FROM_BASE.minusDays(5));

        // 61 daily metrics; TO already has a LIVE row on FROM day 0 (collision) and a TOMBSTONE on FROM day 1.
        for (int i = 0; i < 61; i++) {
            jdbc.update("insert into daily_metric (created_by, date, steps) values (?, ?, ?)",
                from, FROM_BASE.plusDays(i), 8000 + i);
        }
        jdbc.update("insert into daily_metric (created_by, date, steps) values (?, ?, 111)", to, FROM_BASE);
        jdbc.update("insert into daily_metric (created_by, date, steps, is_deleted) values (?, ?, 222, true)",
            to, FROM_BASE.plusDays(1));
        jdbc.update("insert into daily_metric (created_by, date, steps, is_deleted) values (?, ?, 333, true)",
            from, FROM_BASE.minusDays(1));

        for (int i = 0; i < 16; i++) {
            jdbc.update("""
                insert into wearable_workout (created_by, external_id, date, activity_type, start_at, end_at, kcal)
                values (?, ?, ?, 'strength', now() - interval '1 day' * ?, now() - interval '1 day' * ? + interval '1 hour', 300)""",
                from, "hk-wo-" + i, FROM_BASE.plusDays(i), i + 1, i + 1);
        }
        for (int i = 0; i < 9; i++) {
            jdbc.update("""
                insert into calendar_event (created_by, date, title, start_at, end_at, all_day, external_id)
                values (?, ?, 'meeting', now(), now() + interval '1 hour', false, ?)""",
                from, FROM_BASE.plusDays(i), "ek-" + i);
        }
        jdbc.update("""
            insert into boop_brief (created_by, date, payload, input_hash, generated_at)
            values (?, ?, '{"k":"v"}'::jsonb, 'h', now())""", from, FROM_BASE);
        jdbc.update("insert into weight_log (created_by, date, weight_kg, source, external_id) values (?, ?, 79.9, 'apple_health', 'hk-w-1')",
            from, FROM_BASE);
    }

    @AfterEach
    void cleanup() {
        dropBackups();
    }

    private void dropBackups() {
        for (String t : TABLES) {
            jdbc.execute("drop table if exists b1_backup_" + t);
        }
    }

    @Test
    void testMerge_shouldMoveAndMergePerRule_andRollbackShouldRestoreByteForByte() throws IOException {
        Map<String, List<String>> before = snapshot();

        psql(MERGE, false); // dry run
        assertThat(snapshot()).isEqualTo(before);
        assertThat(jdbc.queryForObject("select to_regclass('b1_backup_sleep_log') is null", Boolean.class)).isTrue();

        psql(MERGE, true);

        // sleep: 12 merged into TO's rows, 23 moved; TO now has 24 + 23 live nights, one per date.
        assertThat(live("sleep_log", to)).isEqualTo(24 + 23);
        assertThat(count("select count(*) from sleep_log where created_by = ? and not is_deleted and source = 'apple_health'", from)).isZero();
        assertThat(count("select count(*) from sleep_log where created_by = ? and is_deleted", from)).isEqualTo(1 + 12);
        assertThat(jdbc.queryForObject("""
            select count(*) from (select 1 from sleep_log where not is_deleted group by created_by, date having count(*) > 1) x""",
            Long.class)).isZero();
        for (int k = 0; k < 12; k++) {
            Map<String, Object> row = jdbc.queryForMap("select * from sleep_log where created_by = ? and date = ? and not is_deleted",
                to, TO_BASE.plusDays(COLLIDING[k]));
            int idx = COLLIDING[k];
            assertThat(row.get("source")).isEqualTo("apple_health");
            assertThat(row.get("external_id")).isEqualTo("hk-night-" + k);
            assertThat(row.get("bedtime")).isEqualTo("23:10");           // FROM's sensor values
            assertThat(row.get("deep_min")).isEqualTo(90);
            assertThat(row.get("sleeping_hr")).isEqualTo(52);
            assertThat(row.get("source_app")).isEqualTo("Sleep Cycle");
            assertThat(row.get("hypnogram")).isNotNull();
            assertThat(row.get("quality")).isEqualTo(5 + idx % 5);       // TO's subjective values
            assertThat(row.get("awakenings")).isEqualTo(2);
            assertThat(row.get("notes")).isEqualTo("note");
            if (idx < 19) {
                assertThat(row.get("source_quality_pct")).isEqualTo(80 + idx % 10);
            }
        }
        // moved nights keep their FROM values under TO.
        assertThat(count("select count(*) from sleep_log where created_by = ? and external_id like 'hk-night-%'", to)).isEqualTo(35);

        // the six reassign-only tables.
        assertThat(live("daily_metric", to)).isEqualTo(1 + 60);          // TO's colliding live row won
        assertThat(count("select steps from daily_metric where created_by = ? and date = ? and not is_deleted", to, FROM_BASE)).isEqualTo(111);
        assertThat(count("select count(*) from daily_metric where created_by = ? and date = ? and not is_deleted", to, FROM_BASE.plusDays(1))).isEqualTo(1); // tombstone replaced
        assertThat(live("daily_metric", from)).isZero();
        assertThat(count("select count(*) from daily_metric where created_by = ? and is_deleted", from)).isEqualTo(2); // collided + original tombstone
        assertThat(live("wearable_workout", to)).isEqualTo(16);
        assertThat(live("calendar_event", to)).isEqualTo(9);
        assertThat(live("boop_brief", to)).isEqualTo(1);
        assertThat(live("weight_log", to)).isEqualTo(39 + 1);
        assertThat(live("workout_time_override", to)).isZero();
        for (String t : TABLES) {
            assertThat(t.equals("sleep_log") ? 0 : live(t, from)).as(t).isZero();
        }

        // the merge refuses to run twice (backup tables exist).
        assertThatThrownBy(() -> psql(MERGE, true)).rootCause().hasMessageContaining("b1_backup_sleep_log");

        psql(ROLLBACK, false); // dry run leaves the merged state
        assertThat(live("sleep_log", to)).isEqualTo(24 + 23);

        psql(ROLLBACK, true);
        assertThat(snapshot()).isEqualTo(before); // every row of both users, full-row text
        assertThat(jdbc.queryForObject("select to_regclass('b1_backup_sleep_log') is not null", Boolean.class)).isTrue();
    }

    @Test
    void testMerge_shouldRejectIdenticalOrUnknownUsers() {
        assertThatThrownBy(() -> psqlWith(MERGE, from, from, true)).rootCause().hasMessageContaining("must differ");
        assertThatThrownBy(() -> psqlWith(MERGE, from, UUID.randomUUID(), true)).rootCause().hasMessageContaining("existing app_user");
    }

    @Test
    void testRollback_shouldFailWithoutBackups() {
        assertThatThrownBy(() -> psql(ROLLBACK, true)).rootCause().hasMessageContaining("is missing");
    }

    // ------------------------------------------------------------------ helpers

    private long live(String table, UUID owner) {
        return jdbc.queryForObject("select count(*) from " + table + " where created_by = ? and not is_deleted", Long.class, owner);
    }

    private long count(String sql, Object... args) {
        return jdbc.queryForObject(sql, Long.class, args);
    }

    /** Full-row text of every row of both users in every touched table. */
    private Map<String, List<String>> snapshot() {
        Map<String, List<String>> out = new java.util.LinkedHashMap<>();
        for (String t : TABLES) {
            out.put(t, jdbc.queryForList("select x::text from " + t + " x where created_by in (?, ?) order by x::text",
                String.class, from, to));
        }
        return out;
    }

    private void psql(Path script, boolean apply) throws IOException {
        psqlWith(script, from, to, apply);
    }

    private void psqlWith(Path script, UUID f, UUID t, boolean apply) {
        String sql = toJdbc(read(script), f, t, apply);
        jdbc.execute((ConnectionCallback<Void>) con -> {
            try (Statement st = con.createStatement()) {
                try {
                    st.execute(sql);
                } finally {
                    try { // a raising script leaves the pooled connection in an aborted transaction
                        st.execute("ROLLBACK");
                    } catch (Exception ignored) {
                        // no transaction open
                    }
                }
            }
            return null;
        });
    }

    private static String read(Path p) {
        try {
            return Files.readString(p);
        } catch (IOException e) {
            throw new java.io.UncheckedIOException(e);
        }
    }

    /** psql -> JDBC: drop \set / \echo, substitute :'from_user' / :'to_user', keep one branch of \if :{?apply}. */
    static String toJdbc(String script, UUID from, UUID to, boolean apply) {
        List<String> out = new ArrayList<>();
        boolean inIf = false;
        boolean keeping = true;
        for (String line : script.split("\n")) {
            String t = line.strip();
            if (t.startsWith("\\if ")) {
                inIf = true;
                keeping = apply;
            } else if (t.equals("\\else")) {
                keeping = !apply;
            } else if (t.equals("\\endif")) {
                inIf = false;
                keeping = true;
            } else if (t.startsWith("\\set ") || t.startsWith("\\echo ")) {
                continue;
            } else if (!inIf || keeping) {
                out.add(line.replace(":'from_user'", "'" + from + "'").replace(":'to_user'", "'" + to + "'"));
            }
        }
        return String.join("\n", out);
    }
}
