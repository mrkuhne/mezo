package io.mrkuhne.mezo.feature.admin.controller;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.AdminFeatureBoardResponse;
import io.mrkuhne.mezo.api.dto.AdminFeatureRow;
import io.mrkuhne.mezo.api.dto.AiDraftOutcomeRequest;
import io.mrkuhne.mezo.feature.companion.feedback.entity.MessageFeedbackEntity;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.feature.llmlog.entity.CallStatus;
import io.mrkuhne.mezo.feature.llmlog.entity.LlmLogEntity;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmLogRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.FeedbackPopulator;
import io.mrkuhne.mezo.support.populator.LlmLogPopulator;
import io.mrkuhne.mezo.support.populator.MealPopulator;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/** GET /api/admin/features — the Funkciók scorecard (mezo-l096.3). */
class AdminFeatureBoardIT extends ApiIntegrationTest {

    private static final String URI = "/api/admin/features";
    private static final ZoneId ZONE = ZoneId.of("Europe/Budapest");

    @Autowired private LlmLogRepository llmLogRepository;
    @Autowired private LlmLogPopulator llmLogPopulator;
    @Autowired private MealPopulator mealPopulator;
    @Autowired private FeedbackPopulator feedbackPopulator;

    @Test
    void testBoard_shouldReturn403_whenCallerIsUser() {
        RegisteredUser anna = registerUser("Anna");
        assertHasRequestError(getForBody(URI, anna.headers(), HttpStatus.FORBIDDEN, String.class), "AUTH_FORBIDDEN");
    }

    @Test
    void testBoard_shouldUnionDomainAndLlmRowsWithCorrectKinds_whenBothSourcesHaveData() {
        RegisteredUser anna = registerUser("Anna");
        llmLogRepository.save(logRow(anna.id(), "meal_draft", CallStatus.SUCCESS, new BigDecimal("0.01")));
        mealPopulator.createBareMealAt(anna.id(), LocalDate.now(ZONE), "lunch", LocalTime.NOON);

        AdminFeatureBoardResponse body = getForBody(URI, ownerAuthHeaders(), HttpStatus.OK, AdminFeatureBoardResponse.class);

        assertThat(body.getRows()).filteredOn(r -> "meal_draft".equals(r.getKey()))
                .singleElement()
                .satisfies(r -> assertThat(r.getKind()).isEqualTo(AdminFeatureRow.KindEnum.AI));
        assertThat(body.getRows()).filteredOn(r -> "food".equals(r.getKey()))
                .singleElement()
                .satisfies(r -> assertThat(r.getKind()).isEqualTo(AdminFeatureRow.KindEnum.DOMAIN));
        // Every mezo.admin.feature-map domain key is always present, even with zero usage.
        assertThat(body.getRows()).extracting("key").contains("train", "sleep", "journal", "habits", "water", "weight");
    }

    @Test
    void testBoard_shouldFlagUnknownSlugAsSystemKind_whenFeatureIsUnknown() {
        llmLogRepository.save(logRow(null, "unknown", CallStatus.SUCCESS, null));

        AdminFeatureBoardResponse body = getForBody(URI, ownerAuthHeaders(), HttpStatus.OK, AdminFeatureBoardResponse.class);

        assertThat(body.getRows()).filteredOn(r -> "unknown".equals(r.getKey()))
                .singleElement()
                .satisfies(r -> assertThat(r.getKind()).isEqualTo(AdminFeatureRow.KindEnum.SYSTEM));
    }

    @Test
    void testBoard_shouldExcludeErrorCallsFromCostAndUses_whenAFeatureHasBothStatuses() {
        RegisteredUser anna = registerUser("Anna");
        llmLogRepository.save(logRow(anna.id(), "meal_coach", CallStatus.SUCCESS, new BigDecimal("0.05")));
        llmLogRepository.save(logRow(anna.id(), "meal_coach", CallStatus.ERROR, new BigDecimal("9.00")));

        AdminFeatureBoardResponse body = getForBody(URI, ownerAuthHeaders(), HttpStatus.OK, AdminFeatureBoardResponse.class);

        assertThat(body.getRows()).filteredOn(r -> "meal_coach".equals(r.getKey()))
                .singleElement()
                .satisfies(r -> {
                    assertThat(r.getCostUsd()).isEqualTo(0.05);
                    assertThat(r.getCostPerUse()).isEqualTo(0.05); // 1 non-ERROR call
                });
    }

    @Test
    void testBoard_shouldExcludeNullCreatedByFromUniqueUsers_whenRowIsBackgroundTraffic() {
        llmLogRepository.save(logRow(null, "nightly_recall", CallStatus.SUCCESS, new BigDecimal("0.02")));

        AdminFeatureBoardResponse body = getForBody(URI, ownerAuthHeaders(), HttpStatus.OK, AdminFeatureBoardResponse.class);

        assertThat(body.getRows()).filteredOn(r -> "nightly_recall".equals(r.getKey()))
                .singleElement()
                .satisfies(r -> {
                    assertThat(r.getUniqueUsers()).isZero();
                    assertThat(r.getCostUsd()).isEqualTo(0.02); // background cost is still real cost
                });
    }

    @Test
    void testBoard_shouldMapLiveFeedbackThroughArtifactFeatureMap_whenChatMessageVerdictsExist() {
        RegisteredUser anna = registerUser("Anna");
        feedbackPopulator.createVerdict(anna.id(), MessageFeedbackEntity.KIND_CHAT_MESSAGE, UUID.randomUUID(), "up", null);
        feedbackPopulator.createVerdict(anna.id(), MessageFeedbackEntity.KIND_CHAT_MESSAGE, UUID.randomUUID(), "up", null);
        feedbackPopulator.createVerdict(anna.id(), MessageFeedbackEntity.KIND_CHAT_MESSAGE, UUID.randomUUID(), "down",
                MessageFeedbackEntity.REASON_INACCURATE);
        // companion_chat must exist as a row even with zero LLM usage, so the mapped feedback lands.
        llmLogRepository.save(logRow(anna.id(), "companion_chat", CallStatus.SUCCESS, new BigDecimal("0.01")));

        AdminFeatureBoardResponse body = getForBody(URI, ownerAuthHeaders(), HttpStatus.OK, AdminFeatureBoardResponse.class);

        assertThat(body.getRows()).filteredOn(r -> "companion_chat".equals(r.getKey()))
                .singleElement()
                .satisfies(r -> {
                    assertThat(r.getHelped()).isNotNull();
                    assertThat(r.getHelped().getUp()).isEqualTo(2);
                    assertThat(r.getHelped().getDown()).isEqualTo(1);
                });
    }

    /** {@code artifactFeatureMap} gains {@code meal_coach: meal_coach} (Slice 8 Task 2, mezo-76f6) —
     *  a meal_coach vote must surface under the meal_coach feature's helped counts, same mapped
     *  live-feedback path {@code testBoard_shouldMapLiveFeedbackThroughArtifactFeatureMap_...}
     *  exercises for chat_message/companion_chat. */
    @Test
    void testBoard_shouldMapMealCoachFeedbackThroughArtifactFeatureMap_whenMealCoachVerdictsExist() {
        RegisteredUser anna = registerUser("Anna");
        feedbackPopulator.createVerdict(anna.id(), MessageFeedbackEntity.KIND_MEAL_COACH, UUID.randomUUID(), "up", null);
        // meal_coach must exist as a row even with zero LLM usage, so the mapped feedback lands.
        llmLogRepository.save(logRow(anna.id(), "meal_coach", CallStatus.SUCCESS, new BigDecimal("0.01")));

        AdminFeatureBoardResponse body = getForBody(URI, ownerAuthHeaders(), HttpStatus.OK, AdminFeatureBoardResponse.class);

        assertThat(body.getRows()).filteredOn(r -> "meal_coach".equals(r.getKey()))
                .singleElement()
                .satisfies(r -> {
                    assertThat(r.getHelped()).isNotNull();
                    assertThat(r.getHelped().getUp()).isEqualTo(1);
                });
    }

    @Test
    void testBoard_shouldComputeHabitShareFromThreeOfFourActiveIsoWeeks_whenAUserIsHabitual() {
        RegisteredUser anna = registerUser("Anna"); // habitual: active 3 of the last 4 ISO weeks
        RegisteredUser bela = registerUser("Bela"); // tried once, in the current week only

        LocalDate currentWeekMonday = LocalDate.now(ZONE).with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate week0 = currentWeekMonday.minusWeeks(3).plusDays(1); // Tuesday, oldest of the 4
        LocalDate week1 = currentWeekMonday.minusWeeks(2).plusDays(1);
        LocalDate week2 = currentWeekMonday.minusWeeks(1).plusDays(1);
        LocalDate week3 = currentWeekMonday.plusDays(1); // Tuesday of the current week

        mealPopulator.createBareMealAt(anna.id(), week0, "lunch", LocalTime.NOON);
        mealPopulator.createBareMealAt(anna.id(), week1, "lunch", LocalTime.NOON);
        mealPopulator.createBareMealAt(anna.id(), week2, "lunch", LocalTime.NOON);
        mealPopulator.createBareMealAt(bela.id(), week3, "lunch", LocalTime.NOON);

        AdminFeatureBoardResponse body = getForBody(URI, ownerAuthHeaders(), HttpStatus.OK, AdminFeatureBoardResponse.class);

        assertThat(body.getRows()).filteredOn(r -> "food".equals(r.getKey()))
                .singleElement()
                .satisfies(r -> {
                    assertThat(r.getUniqueUsers()).isEqualTo(2L);
                    assertThat(r.getHabitUserShare()).isEqualTo(0.5); // 1 habitual / 2 tried
                });
    }

    /**
     * Pins {@code usesPerWeek}'s FIXED 12-ISO-week trend window against being "simplified" into
     * reusing the period-scoped {@code since} bound (mezo-clgz fix round 1). With {@code
     * period=30d}, the period {@code since} only reaches back ~4.3 ISO weeks — a row dated 6 or 8
     * weeks back sits OUTSIDE that period window but INSIDE the 12-week trend window, on both the
     * domain and the LLM side. If {@code trendFrom} were ever collapsed into {@code since}, both
     * assertions below would fail (the older weeks would read back as zero).
     */
    @Test
    void testBoard_shouldKeepOlderWeeksNonZeroInUsesPerWeek_whenPeriodIs30dAndRowsAreFiveToElevenWeeksOld() {
        RegisteredUser anna = registerUser("Anna");
        LocalDate currentWeekMonday = LocalDate.now(ZONE).with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        // 8 weeks back (LLM side) and 6 weeks back (domain side) — both well past a 30d period's
        // ~4.3-week reach, both well inside the fixed 12-week trend window.
        LocalDate llmWeek = currentWeekMonday.minusWeeks(8);
        LocalDate domainWeek = currentWeekMonday.minusWeeks(6);
        Instant llmAt = llmWeek.plusDays(1).atTime(LocalTime.NOON).atZone(ZONE).toInstant();
        llmLogPopulator.logAt(llmAt, anna.id(), CallKind.CHAT, "meal_draft", "gemini-2.5-flash", 10, 5, null,
                new BigDecimal("0.01"));
        mealPopulator.createBareMealAt(anna.id(), domainWeek.plusDays(1), "lunch", LocalTime.NOON);

        AdminFeatureBoardResponse body =
                getForBody(URI + "?period=30d", ownerAuthHeaders(), HttpStatus.OK, AdminFeatureBoardResponse.class);

        // weekStarts[i] = trendFrom + i weeks, trendFrom = currentWeekMonday - 11 weeks, so a week
        // that is N weeks back from the current week sits at index (11 - N).
        int llmIndex = 11 - 8;
        int domainIndex = 11 - 6;
        assertThat(body.getRows()).filteredOn(r -> "meal_draft".equals(r.getKey()))
                .singleElement()
                .satisfies(r -> {
                    assertThat(r.getUsesPerWeek()).hasSize(12);
                    assertThat(r.getUsesPerWeek().get(llmIndex)).isGreaterThan(0);
                });
        assertThat(body.getRows()).filteredOn(r -> "food".equals(r.getKey()))
                .singleElement()
                .satisfies(r -> {
                    assertThat(r.getUsesPerWeek()).hasSize(12);
                    assertThat(r.getUsesPerWeek().get(domainIndex)).isGreaterThan(0);
                });
    }

    /**
     * {@code acceptedShare} = (accepted+edited)/total ai_draft_outcome rows for the feature in the
     * period (Slice 8 Task 2, mezo-76f6 plan Rulings) — 2 accepted + 1 edited + 1 discarded -> 0.75.
     * Outcomes are recorded through the real {@code POST /api/ai-drafts/{draftId}/outcome}
     * endpoint (Task 1), same as {@code AiDraftsApiIT}, rather than a direct repository save.
     */
    @Test
    void testBoard_shouldComputeAcceptedShare_whenOutcomesExistForAFeature() {
        RegisteredUser anna = registerUser("Anna");
        llmLogRepository.save(logRow(anna.id(), "meal_draft", CallStatus.SUCCESS, new BigDecimal("0.01")));
        recordOutcome(anna, "meal_draft", "accepted");
        recordOutcome(anna, "meal_draft", "accepted");
        recordOutcome(anna, "meal_draft", "edited");
        recordOutcome(anna, "meal_draft", "discarded");

        AdminFeatureBoardResponse body = getForBody(URI, ownerAuthHeaders(), HttpStatus.OK, AdminFeatureBoardResponse.class);

        assertThat(body.getRows()).filteredOn(r -> "meal_draft".equals(r.getKey()))
                .singleElement()
                .satisfies(r -> assertThat(r.getAcceptedShare()).isEqualTo(0.75));
    }

    @Test
    void testBoard_shouldLeaveAcceptedShareNull_whenFeatureHasZeroOutcomes() {
        RegisteredUser anna = registerUser("Anna");
        llmLogRepository.save(logRow(anna.id(), "meso_plan", CallStatus.SUCCESS, new BigDecimal("0.01")));

        AdminFeatureBoardResponse body = getForBody(URI, ownerAuthHeaders(), HttpStatus.OK, AdminFeatureBoardResponse.class);

        assertThat(body.getRows()).filteredOn(r -> "meso_plan".equals(r.getKey()))
                .singleElement()
                .satisfies(r -> assertThat(r.getAcceptedShare()).isNull());
    }

    private void recordOutcome(RegisteredUser user, String feature, String outcome) {
        postForBody("/api/ai-drafts/" + UUID.randomUUID() + "/outcome",
            AiDraftOutcomeRequest.builder().feature(feature).outcome(outcome).build(),
            user.headers(), HttpStatus.NO_CONTENT, Void.class);
    }

    /** Minimal valid audit row — same shape as {@code AdminUsageIT#logRow}. */
    private static LlmLogEntity logRow(UUID owner, String feature, CallStatus status, BigDecimal cost) {
        LlmLogEntity e = new LlmLogEntity();
        e.setCreatedBy(owner);
        e.setCallKind(CallKind.CHAT);
        e.setFeature(feature);
        e.setRequestedModel("gemini-2.5-flash");
        e.setServedModel(status == CallStatus.ERROR ? null : "gemini-2.5-flash");
        e.setStatus(status);
        e.setLatencyMs(100);
        e.setCostUsd(cost);
        return e;
    }
}
