package io.mrkuhne.mezo.feature.admin.controller;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.AdminFeatureDetailResponse;
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
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/** GET /api/admin/features/{key} — the Funkciók detail panel (mezo-l096.4). */
class AdminFeatureDetailIT extends ApiIntegrationTest {

    private static final ZoneId ZONE = ZoneId.of("Europe/Budapest");

    @Autowired private LlmLogRepository llmLogRepository;
    @Autowired private LlmLogPopulator llmLogPopulator;
    @Autowired private MealPopulator mealPopulator;
    @Autowired private FeedbackPopulator feedbackPopulator;

    private static String uri(String key) {
        return "/api/admin/features/" + key;
    }

    @Test
    void testDetail_shouldReturn403_whenCallerIsUser() {
        RegisteredUser anna = registerUser("Anna");
        assertHasRequestError(getForBody(uri("food"), anna.headers(), HttpStatus.FORBIDDEN, String.class), "AUTH_FORBIDDEN");
    }

    @Test
    void testDetail_shouldReturn404_whenKeyIsNeitherADomainKeyNorSeenInLlmLog() {
        String body = getForBody(uri("no_such_feature"), ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
        assertHasRequestError(body, "ADMIN_FEATURE_NOT_FOUND");
    }

    @Test
    void testDetail_shouldReturn200_whenKeyOnlySeenInLlmLog() {
        RegisteredUser anna = registerUser("Anna");
        llmLogPopulator.log(anna.id(), CallKind.CHAT, "meal_draft", "gemini-2.5-flash", 10, 5);

        AdminFeatureDetailResponse body = getForBody(uri("meal_draft"), ownerAuthHeaders(), HttpStatus.OK, AdminFeatureDetailResponse.class);

        assertThat(body.getKey()).isEqualTo("meal_draft");
    }

    /**
     * The hand-built fixture from the brief: one user tried once, one user repeated (uses on 2
     * distinct days), one user habitual (active 3-of-4 last ISO weeks — which also makes them
     * "repeated", since their first and last active day necessarily differ).
     */
    @Test
    void testDetail_shouldComputeFunnelCounts_whenUsersHaveDistinctUsagePatterns() {
        RegisteredUser anna = registerUser("Anna"); // tried once
        RegisteredUser bela = registerUser("Bela"); // repeated: 2 distinct days, same week
        RegisteredUser csilla = registerUser("Csilla"); // habitual: active 3 of last 4 ISO weeks

        LocalDate currentWeekMonday = LocalDate.now(ZONE).with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));

        mealPopulator.createBareMealAt(anna.id(), currentWeekMonday.plusDays(1), "lunch", LocalTime.NOON);

        mealPopulator.createBareMealAt(bela.id(), currentWeekMonday.plusDays(1), "lunch", LocalTime.NOON);
        mealPopulator.createBareMealAt(bela.id(), currentWeekMonday.plusDays(2), "lunch", LocalTime.NOON);

        LocalDate week0 = currentWeekMonday.minusWeeks(3).plusDays(1);
        LocalDate week1 = currentWeekMonday.minusWeeks(2).plusDays(1);
        LocalDate week2 = currentWeekMonday.minusWeeks(1).plusDays(1);
        mealPopulator.createBareMealAt(csilla.id(), week0, "lunch", LocalTime.NOON);
        mealPopulator.createBareMealAt(csilla.id(), week1, "lunch", LocalTime.NOON);
        mealPopulator.createBareMealAt(csilla.id(), week2, "lunch", LocalTime.NOON);

        AdminFeatureDetailResponse body = getForBody(uri("food"), ownerAuthHeaders(), HttpStatus.OK, AdminFeatureDetailResponse.class);

        assertThat(body.getFunnel().getTried()).isEqualTo(3);
        assertThat(body.getFunnel().getRepeated()).isEqualTo(2); // bela + csilla
        assertThat(body.getFunnel().getHabitual()).isEqualTo(1); // csilla only
        assertThat(body.getFunnel().getTriedUsers()).hasSize(3)
                .contains("Anna", "Bela", "Csilla");
        assertThat(body.getUsageByWeek()).hasSize(12);
    }

    /**
     * Pins the "legutóbbi vélemények" ruling: {@code feedbackTrend} is bucketed on
     * {@code message_feedback.updated_at}, so flipping a vote re-dates it into the CURRENT week's
     * bucket rather than staying under the week it was first cast in.
     */
    @Test
    void testDetail_shouldRedateFeedbackTrendOnVoteFlip_whenAVerdictIsRevoted() {
        RegisteredUser anna = registerUser("Anna");
        UUID artifactId = UUID.randomUUID();
        // Companion_chat needs at least one llm_log row to be a known key at all (companion_chat
        // is only in the artifact-feature-map, never in the domain feature-map).
        llmLogPopulator.log(anna.id(), CallKind.CHAT, "companion_chat", "gemini-2.5-flash", 10, 5);
        feedbackPopulator.createVerdict(anna.id(), MessageFeedbackEntity.KIND_CHAT_MESSAGE, artifactId, "up", null);

        AdminFeatureDetailResponse before = getForBody(
                uri("companion_chat"), ownerAuthHeaders(), HttpStatus.OK, AdminFeatureDetailResponse.class);
        assertThat(before.getFeedbackTrend()).isNotNull();
        String currentWeek = before.getFeedbackTrend().stream()
                .filter(p -> p.getUp() >= 1)
                .findFirst().orElseThrow().getWeek();

        // Re-vote through the real upsert path — bumps updated_at, same artifact.
        feedbackPopulator.revote(anna.id(), MessageFeedbackEntity.KIND_CHAT_MESSAGE, artifactId, "down",
                MessageFeedbackEntity.REASON_INACCURATE);

        AdminFeatureDetailResponse after = getForBody(
                uri("companion_chat"), ownerAuthHeaders(), HttpStatus.OK, AdminFeatureDetailResponse.class);
        assertThat(after.getFeedbackTrend()).isNotNull();
        assertThat(after.getFeedbackTrend()).filteredOn(p -> currentWeek.equals(p.getWeek()))
                .singleElement()
                .satisfies(p -> {
                    assertThat(p.getUp()).isZero(); // the up vote no longer exists in this week's bucket
                    assertThat(p.getDown()).isEqualTo(1); // it re-dated as a down in the SAME week
                });
        assertThat(after.getDownReasons()).filteredOn(r -> MessageFeedbackEntity.REASON_INACCURATE.equals(r.getReason()))
                .singleElement()
                .satisfies(r -> assertThat(r.getCount()).isEqualTo(1));
    }

    @Test
    void testDetail_shouldComputeTopErrorsAndCostByModel_whenLlmRowsHaveErrorsAndModels() {
        RegisteredUser anna = registerUser("Anna");
        llmLogPopulator.log(anna.id(), CallKind.CHAT, "meal_coach", "gemini-2.5-flash", 10, 5);
        llmLogPopulator.log(anna.id(), CallKind.CHAT, "meal_coach", "gemini-2.5-flash", 10, 5);
        llmLogPopulator.log(anna.id(), CallKind.CHAT, "meal_coach", "gemini-2.5-pro", 20, 10);
        llmLogRepository.save(errorRow(anna.id(), "meal_coach", "PROVIDER_TIMEOUT"));
        llmLogRepository.save(errorRow(anna.id(), "meal_coach", "PROVIDER_TIMEOUT"));
        llmLogRepository.save(errorRow(anna.id(), "meal_coach", "RATE_LIMIT"));

        AdminFeatureDetailResponse body = getForBody(uri("meal_coach"), ownerAuthHeaders(), HttpStatus.OK, AdminFeatureDetailResponse.class);

        assertThat(body.getReliability().getTopErrors()).hasSize(2);
        assertThat(body.getReliability().getTopErrors().get(0).getCode()).isEqualTo("PROVIDER_TIMEOUT");
        assertThat(body.getReliability().getTopErrors().get(0).getCount()).isEqualTo(2);
        assertThat(body.getReliability().getErrorPct()).isEqualTo(50.0); // 3 errors / 6 total

        assertThat(body.getCostByModel()).extracting("model")
                .containsExactlyInAnyOrder("gemini-2.5-flash", "gemini-2.5-pro");
        assertThat(body.getCostByModel()).filteredOn(m -> "gemini-2.5-flash".equals(m.getModel()))
                .singleElement()
                .satisfies(m -> assertThat(m.getCalls()).isEqualTo(2L));

        assertThat(body.getTopUsers()).extracting("name").containsExactly("Anna");
        assertThat(body.getTopUsers().get(0).getUses()).isEqualTo(3L);
    }

    private static LlmLogEntity errorRow(UUID owner, String feature, String errorCode) {
        LlmLogEntity e = new LlmLogEntity();
        e.setCreatedBy(owner);
        e.setCallKind(CallKind.CHAT);
        e.setFeature(feature);
        e.setRequestedModel("gemini-2.5-flash");
        e.setStatus(CallStatus.ERROR);
        e.setErrorCode(errorCode);
        e.setLatencyMs(37);
        e.setCostUsd(new BigDecimal("9.00"));
        return e;
    }
}
