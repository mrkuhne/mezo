package io.mrkuhne.mezo.feature.admin.repository;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.feedback.entity.MessageFeedbackEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryRetrievalResultEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryRetrievalRunEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.ScoreBreakdownEnvelope;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryRetrievalFeedbackRepository;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.FeedbackPopulator;
import io.mrkuhne.mezo.support.populator.LlmLogPopulator;
import io.mrkuhne.mezo.support.populator.MemoryItemPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Focused proof for {@link AdminFeatureQuery} (mezo-l096.1/.2): the percentile SQL is new to this
 * codebase and needs an exact-value proof of its own; the feedback/recall reads need proof that
 * soft-deleted rows never leak into a native read (JPA's {@code @SQLRestriction} does not apply
 * to native SQL, so this must be an explicit {@code where} clause, not an assumption).
 */
class AdminFeatureQueryIT extends AbstractIntegrationTest {

    private static final ZoneId ZONE = ZoneId.of("Europe/Budapest");

    @Autowired private AdminFeatureQuery query;
    @Autowired private LlmLogPopulator llmLogPopulator;
    @Autowired private FeedbackPopulator feedbackPopulator;
    @Autowired private MemoryItemPopulator memoryItemPopulator;
    @Autowired private MemoryRetrievalFeedbackRepository memoryRetrievalFeedbackRepository;
    @Autowired private UserPopulator userPopulator;
    @Autowired private JdbcTemplate jdbcTemplate;

    @Test
    void testP90LatencyByFeature_shouldComputeExactPercentiles_whenLatenciesAreKnown() {
        Instant now = Instant.now();
        UUID user = userPopulator.createUser().getId();
        // 10 rows, latencies 10..100ms in steps of 10 -> for 10 sorted values Postgres
        // percentile_cont interpolates linearly: rank 0.5*(10-1)=4.5 -> avg(50,60)=55;
        // rank 0.9*(10-1)=8.1 -> 90 + 0.1*(100-90)=91.
        for (int i = 1; i <= 10; i++) {
            var entity = llmLogPopulator.logAt(now.minus(1, ChronoUnit.HOURS), user, CallKind.CHAT,
                    "companion_chat", "gemini-2.5-flash", 10, 5, null, null);
            jdbcTemplate.update("update llm_log_history set latency_ms = ? where id = ?", i * 10, entity.getId());
        }

        Map<String, int[]> byFeature = query.p90LatencyByFeature(now.minus(2, ChronoUnit.HOURS));

        assertThat(byFeature).containsKey("companion_chat");
        assertThat(byFeature.get("companion_chat")[0]).isEqualTo(55); // p50
        assertThat(byFeature.get("companion_chat")[1]).isEqualTo(91); // p90
    }

    @Test
    void testFeedbackByFeature_shouldExcludeSoftDeletedRows_whenAVerdictWasRetracted() {
        UUID user = userPopulator.createUser().getId();
        feedbackPopulator.createVerdict(user, MessageFeedbackEntity.KIND_CHAT_MESSAGE, UUID.randomUUID(), "up", null);
        feedbackPopulator.createVerdict(user, MessageFeedbackEntity.KIND_CHAT_MESSAGE, UUID.randomUUID(), "down",
                MessageFeedbackEntity.REASON_INACCURATE);
        // A retracted vote (soft-deleted) must never surface in a native read.
        MessageFeedbackEntity retracted = feedbackPopulator.createVerdict(
                user, MessageFeedbackEntity.KIND_CHAT_MESSAGE, UUID.randomUUID(), "down", null);
        jdbcTemplate.update("update message_feedback set is_deleted = true where id = ?", retracted.getId());

        List<AdminFeatureQuery.FeedbackKindRow> rows = query.feedbackByFeature();

        long upCount = rows.stream()
                .filter(r -> MessageFeedbackEntity.KIND_CHAT_MESSAGE.equals(r.kind()) && "up".equals(r.verdict()))
                .mapToLong(AdminFeatureQuery.FeedbackKindRow::count).sum();
        long downCount = rows.stream()
                .filter(r -> MessageFeedbackEntity.KIND_CHAT_MESSAGE.equals(r.kind()) && "down".equals(r.verdict()))
                .mapToLong(AdminFeatureQuery.FeedbackKindRow::count).sum();

        assertThat(upCount).isEqualTo(1);
        assertThat(downCount).isEqualTo(1); // the retracted 2nd down row is excluded
    }

    @Test
    void testFeedbackCountsByUserSince_shouldExcludeSoftDeletedRows_whenAVerdictWasRetracted() {
        UUID user = userPopulator.createUser().getId();
        Instant since = Instant.now().minus(1, ChronoUnit.HOURS);
        feedbackPopulator.createVerdict(user, MessageFeedbackEntity.KIND_CHAT_MESSAGE, UUID.randomUUID(), "up", null);
        feedbackPopulator.createVerdict(user, MessageFeedbackEntity.KIND_CHAT_MESSAGE, UUID.randomUUID(), "down",
                MessageFeedbackEntity.REASON_INACCURATE);
        // A retracted vote (soft-deleted) must never surface in a native read.
        MessageFeedbackEntity retracted = feedbackPopulator.createVerdict(
                user, MessageFeedbackEntity.KIND_CHAT_MESSAGE, UUID.randomUUID(), "down", null);
        jdbcTemplate.update("update message_feedback set is_deleted = true where id = ?", retracted.getId());

        List<AdminFeatureQuery.UserVerdictRow> rows = query.feedbackCountsByUserSince(since);

        long upCount = rows.stream()
                .filter(r -> user.equals(r.owner()) && "up".equals(r.verdict()))
                .mapToLong(AdminFeatureQuery.UserVerdictRow::count).sum();
        long downCount = rows.stream()
                .filter(r -> user.equals(r.owner()) && "down".equals(r.verdict()))
                .mapToLong(AdminFeatureQuery.UserVerdictRow::count).sum();

        assertThat(upCount).isEqualTo(1);
        assertThat(downCount).isEqualTo(1); // the retracted 2nd down row is excluded
    }

    @Test
    void testFeedbackByKindForUser_shouldExcludeSoftDeletedRows_whenAVerdictWasRetracted() {
        UUID user = userPopulator.createUser().getId();
        feedbackPopulator.createVerdict(user, MessageFeedbackEntity.KIND_CHAT_MESSAGE, UUID.randomUUID(), "up", null);
        feedbackPopulator.createVerdict(user, MessageFeedbackEntity.KIND_CHAT_MESSAGE, UUID.randomUUID(), "down",
                MessageFeedbackEntity.REASON_INACCURATE);
        // A retracted vote (soft-deleted) must never surface in a native read.
        MessageFeedbackEntity retracted = feedbackPopulator.createVerdict(
                user, MessageFeedbackEntity.KIND_CHAT_MESSAGE, UUID.randomUUID(), "down", null);
        jdbcTemplate.update("update message_feedback set is_deleted = true where id = ?", retracted.getId());

        List<AdminFeatureQuery.FeedbackKindRow> rows = query.feedbackByKindForUser(user);

        long upCount = rows.stream()
                .filter(r -> MessageFeedbackEntity.KIND_CHAT_MESSAGE.equals(r.kind()) && "up".equals(r.verdict()))
                .mapToLong(AdminFeatureQuery.FeedbackKindRow::count).sum();
        long downCount = rows.stream()
                .filter(r -> MessageFeedbackEntity.KIND_CHAT_MESSAGE.equals(r.kind()) && "down".equals(r.verdict()))
                .mapToLong(AdminFeatureQuery.FeedbackKindRow::count).sum();

        assertThat(upCount).isEqualTo(1);
        assertThat(downCount).isEqualTo(1); // the retracted 2nd down row is excluded
    }

    @Test
    void testRecallFeedbackTotalsForUser_shouldExcludeSoftDeletedRows_whenAFeedbackRowWasRetracted() {
        UUID user = userPopulator.createUser().getId();
        MemoryItemEntity item = memoryItemPopulator.item(user, "journal_entry", UUID.randomUUID(),
                "friss", LocalDate.of(2026, 6, 3));
        MemoryRetrievalRunEntity run = memoryItemPopulator.run(user, UUID.randomUUID());
        MemoryRetrievalResultEntity result1 = memoryItemPopulator.result(user, run, item, 1, true,
                ScoreBreakdownEnvelope.empty());
        MemoryRetrievalResultEntity result2 = memoryItemPopulator.result(user, run, item, 2, true,
                ScoreBreakdownEnvelope.empty());
        memoryItemPopulator.feedback(user, run, result1, item, "useful");
        // A retracted recall vote (soft-deleted) must never surface in a native read.
        var retracted = memoryItemPopulator.feedback(user, run, result2, item, "useful");
        jdbcTemplate.update("update memory_retrieval_feedback set is_deleted = true where id = ?", retracted.getId());

        Map<String, Long> totals = query.recallFeedbackTotalsForUser(user);

        assertThat(totals).containsEntry("useful", 1L); // the retracted 2nd useful row is excluded
    }

    @Test
    void testRecallFeedbackTotals_shouldGroupByAction_whenRowsExist() {
        UUID user = userPopulator.createUser().getId();
        MemoryItemEntity item = memoryItemPopulator.item(user, "journal_entry", UUID.randomUUID(),
                "friss", LocalDate.of(2026, 6, 3));
        MemoryRetrievalRunEntity run = memoryItemPopulator.run(user, UUID.randomUUID());
        MemoryRetrievalResultEntity result1 = memoryItemPopulator.result(user, run, item, 1, true,
                ScoreBreakdownEnvelope.empty());
        MemoryRetrievalResultEntity result2 = memoryItemPopulator.result(user, run, item, 2, true,
                ScoreBreakdownEnvelope.empty());
        memoryItemPopulator.feedback(user, run, result1, item, "useful");
        memoryItemPopulator.feedback(user, run, result2, item, "irrelevant");

        Map<String, Long> totals = query.recallFeedbackTotals(Instant.now().minus(1, ChronoUnit.HOURS));

        assertThat(totals).containsEntry("useful", 1L);
        assertThat(totals).containsEntry("irrelevant", 1L);
        assertThat(totals).doesNotContainKey("suppress");
    }
}
