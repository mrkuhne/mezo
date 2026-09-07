package io.mrkuhne.mezo.feature.admin.controller;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.AdminRowPageResponse;
import io.mrkuhne.mezo.api.dto.AdminTableListResponse;
import io.mrkuhne.mezo.api.dto.AdminViewDescriptor;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;

/** GET /api/admin/data/** — the generic read-only row browser (mezo-d5iy). */
class AdminDataBrowserIT extends ApiIntegrationTest {

    private static final String TABLES_URI = "/api/admin/data/tables";
    private static final String VIEWS_URI = "/api/admin/data/views";
    private static final String ROWS_URI = "/api/admin/data/tables/%s/rows";

    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private AppUserRepository appUserRepository;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    @Test
    void testTables_shouldReturn403_whenCallerIsUser() {
        RegisteredUser anna = registerUser("Anna");
        assertHasRequestError(getForBody(TABLES_URI, anna.headers(), HttpStatus.FORBIDDEN, String.class),
                "AUTH_FORBIDDEN");
        assertHasRequestError(getForBody(VIEWS_URI, anna.headers(), HttpStatus.FORBIDDEN, String.class),
                "AUTH_FORBIDDEN");
        assertHasRequestError(getForBody(ROWS_URI.formatted("app_user"), anna.headers(), HttpStatus.FORBIDDEN, String.class),
                "AUTH_FORBIDDEN");
    }

    @Test
    void testTables_shouldDescribeOwnedTablesWithoutSecretColumns_whenOwner() {
        AdminTableListResponse body = getForBody(TABLES_URI, ownerAuthHeaders(), HttpStatus.OK, AdminTableListResponse.class);

        assertThat(body.getTables()).extracting("name").contains("workout_session", "app_user", "llm_log_history");
        assertThat(body.getTables()).filteredOn(t -> "app_user".equals(t.getName())).singleElement()
                .satisfies(t -> {
                    assertThat(t.getOwnerColumn()).isEqualTo("id");
                    assertThat(t.getColumns()).extracting("name").doesNotContain("password_hash");
                });
        assertThat(body.getTables()).filteredOn(t -> "llm_log_history".equals(t.getName())).singleElement()
                .satisfies(t -> assertThat(t.getSoftDeletable()).isFalse());
    }

    @Test
    void testRows_shouldRejectUnknownTable_whenTableIsNotBrowsable() {
        assertHasRequestError(
                getForBody(ROWS_URI.formatted("databasechangelog"), ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class),
                "ADMIN_TABLE_UNKNOWN");
    }

    @Test
    void testRows_shouldRejectHiddenSortColumn_whenSortIsExcluded() {
        assertHasRequestError(
                getForBody(ROWS_URI.formatted("app_user") + "?sort=password_hash", ownerAuthHeaders(),
                        HttpStatus.BAD_REQUEST, String.class),
                "ADMIN_COLUMN_UNKNOWN");
    }

    @Test
    void testRows_shouldClampPageSize_whenSizeExceedsTheMaximum() {
        AdminRowPageResponse body = getForBody(ROWS_URI.formatted("app_user") + "?size=5000",
                ownerAuthHeaders(), HttpStatus.OK, AdminRowPageResponse.class);

        assertThat(body.getSize()).isEqualTo(200);
        assertThat(body.getRows().size()).isLessThanOrEqualTo(200);
    }

    @Test
    void testRows_shouldFilterByUser_whenUserIdGiven() {
        RegisteredUser anna = registerUser("Anna");

        AdminRowPageResponse body = getForBody(ROWS_URI.formatted("app_user") + "?userId=" + anna.id(),
                ownerAuthHeaders(), HttpStatus.OK, AdminRowPageResponse.class);

        assertThat(body.getTotal()).isEqualTo(1L);
        assertThat(body.getRows()).singleElement()
                .satisfies(row -> assertThat(row.get("id").toString()).isEqualTo(anna.id().toString()));
    }

    @Test
    void testRows_shouldHideDeletedRowsByDefault_andShowThemWhenAsked() {
        // Seed two workout_session rows for the owner directly (cheapest owned table to seed
        // without going through the train domain API), soft-delete one, then prove the default
        // view hides it while includeDeleted=true shows it — a test that would still pass if
        // includeDeleted were ignored entirely is worthless (task-7 judgement call 5).
        UUID owner = ownerId();
        jdbcTemplate.update(
                "insert into workout_session (created_by, day_label, type) values (?, 'Nap A', 'strength')", owner);
        UUID deletedId = jdbcTemplate.queryForObject(
                "insert into workout_session (created_by, day_label, type) values (?, 'Nap B', 'strength') returning id",
                UUID.class, owner);
        jdbcTemplate.update("update workout_session set is_deleted = true where id = ?", deletedId);

        long visible = getForBody(ROWS_URI.formatted("workout_session"), ownerAuthHeaders(),
                HttpStatus.OK, AdminRowPageResponse.class).getTotal();
        long withDeleted = getForBody(ROWS_URI.formatted("workout_session") + "?includeDeleted=true",
                ownerAuthHeaders(), HttpStatus.OK, AdminRowPageResponse.class).getTotal();

        assertThat(visible).isEqualTo(1L);
        assertThat(withDeleted).isEqualTo(2L);

        AdminRowPageResponse defaultPage = getForBody(ROWS_URI.formatted("workout_session"), ownerAuthHeaders(),
                HttpStatus.OK, AdminRowPageResponse.class);
        assertThat(defaultPage.getRows()).extracting(row -> row.get("id").toString())
                .doesNotContain(deletedId.toString());
    }

    @Test
    void testRows_shouldUnwrapJsonbColumns_toRealJsonRatherThanAQuotedString() {
        // recipe.tags is jsonb (task-7 judgement call 4): prove the PGobject is unwrapped to a
        // real JSON array in the response, not re-serialized as its quoted text form.
        UUID owner = ownerId();
        jdbcTemplate.update("""
                insert into recipe (created_by, name, category, tags)
                values (?, 'jsonb-browser-test', 'lunch', '["reggeli","gyors"]'::jsonb)
                """, owner);

        AdminRowPageResponse body = getForBody(ROWS_URI.formatted("recipe") + "?size=200",
                ownerAuthHeaders(), HttpStatus.OK, AdminRowPageResponse.class);

        assertThat(body.getRows())
                .filteredOn(row -> "jsonb-browser-test".equals(row.get("name")))
                .singleElement()
                .satisfies(row -> assertThat(row.get("tags")).isInstanceOf(List.class)
                        .asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.LIST)
                        .containsExactly("reggeli", "gyors"));
    }

    @Test
    void testRows_shouldUnwrapArrayColumns_toRealJsonRatherThanAnOpaqueObject() {
        // Final review Finding 2: mesocycle.phase_curve is TEXT[] (information_schema reports
        // its data_type as the literal string "ARRAY", not a concrete element type — neither the
        // json/jsonb branch nor the old USER-DEFINED/secret drop list caught it), and it sits on
        // the FIRST convenience view (mezociklusok). Before the fix a PgArray survived unmapped
        // past the read-only transaction's commit and either serialized as driver internals or
        // 500'd on response write; this proves the request succeeds at all and the array comes
        // back as a real, usable JSON list.
        UUID owner = ownerId();
        jdbcTemplate.update("""
                insert into mesocycle (created_by, title, short_title, status, goal, start_date,
                        end_date, weeks, split, style, phase_curve)
                values (?, 'Array-browser test', 'Array test', 'planned', null,
                        current_date, current_date + 28, 4, 'push-pull-legs', 'hypertrophy',
                        array['accumulation','deload']::text[])
                """, owner);

        AdminRowPageResponse body = getForBody(ROWS_URI.formatted("mesocycle") + "?size=200",
                ownerAuthHeaders(), HttpStatus.OK, AdminRowPageResponse.class);

        assertThat(body.getRows())
                .filteredOn(row -> "Array-browser test".equals(row.get("title")))
                .singleElement()
                .satisfies(row -> assertThat(row.get("phase_curve")).isInstanceOf(List.class)
                        .asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.LIST)
                        .containsExactly("accumulation", "deload"));
    }

    @Test
    void testViews_shouldListTheV1ConvenienceViews_whenOwner() {
        List<AdminViewDescriptor> views = getForList(VIEWS_URI, ownerAuthHeaders(), HttpStatus.OK, AdminViewDescriptor.class);

        assertThat(views).extracting(AdminViewDescriptor::getId)
                .containsExactlyInAnyOrder("mezociklusok", "edzesek", "gyakorlatok", "mintak", "llm-history", "memoria-elemek");
        assertThat(views).allSatisfy(v -> assertThat(v.getTable()).isNotBlank());
    }

    @Test
    void testTables_shouldCoverEveryOwnedTableInTheResetList_soNothingIsSilentlyMissing() {
        AdminTableListResponse body = getForBody(TABLES_URI, ownerAuthHeaders(), HttpStatus.OK, AdminTableListResponse.class);

        // ResetDatabase (backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java) holds
        // the independent inventory of owned tables, but only as a string embedded in a TRUNCATE
        // statement — no public List to assert set-equality against (task-7 judgement call 3).
        // Keep a size floor instead: as of this change the TRUNCATE list plus app_user is well
        // over 90 tables, so hasSizeGreaterThan(50) has real margin against a silent regression
        // that drops a whole swath of tables from the catalog, without hard-coding the count.
        assertThat(body.getTables()).hasSizeGreaterThan(50);
    }
}
