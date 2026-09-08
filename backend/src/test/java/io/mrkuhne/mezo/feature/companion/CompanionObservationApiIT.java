package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.ObservationResponse;
import io.mrkuhne.mezo.api.dto.PatternReplyRequest;
import io.mrkuhne.mezo.api.dto.PatternReplyResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import io.mrkuhne.mezo.feature.companion.entity.TestPlanEnvelope;
import io.mrkuhne.mezo.feature.companion.repository.AiConversationRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.PatternEventPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

/**
 * Reflexió S4 (mezo-eq85.4, spec 2026-09-06 §5) — the Észrevételek tab's HTTP contract: the four
 * card kinds in their fixed order, and the chip reply that answers one of them.
 */
@ActiveProfiles("companion-fake")
class CompanionObservationApiIT extends ApiIntegrationTest {

    private static final LocalDate TODAY = LocalDate.now();

    /**
     * A fixture instant inside the day these tests ASK for (mezo-z3ka).
     *
     * <p>{@code ObservationFeedService.forDay} serves a {@code [day 00:00, next day 00:00)} window
     * over {@code occurred_at}, so a fixture stamped {@code Instant.now().minus(N, HOURS)} silently
     * lands on YESTERDAY whenever the suite runs within N hours of local midnight — the card then
     * falls outside the queried window and the assertion sees an empty feed. That is exactly how
     * this class turned {@code main} red: CI reached it at 00:22 local time, and the 1 h, 2 h and
     * 5 h offsets all crossed back over midnight together.
     *
     * <p>Anchoring to the day's own start instead makes the fixtures clock-independent. Seconds,
     * not hours, keep the whole timeline inside the window even in the first minute of the day, and
     * the window's lower bound is INCLUSIVE, so {@code dayAt(0)} is a valid stamp. A stamp slightly
     * in the future is harmless here: the feed has no upper bound at wall-clock now, only the day's
     * end.
     */
    private static Instant dayAt(int secondsIntoTheDay) {
        return TODAY.atStartOfDay(ZoneId.systemDefault()).plusSeconds(secondsIntoTheDay).toInstant();
    }

    @Autowired private PatternPopulator patternPopulator;
    @Autowired private PatternEventPopulator patternEventPopulator;
    @Autowired private PatternRepository patternRepository;
    @Autowired private AiConversationRepository conversationRepository;
    @Autowired private UserPopulator userPopulator;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    private static TestPlanEnvelope plan(String seriesA) {
        return new TestPlanEnvelope(seriesA, "text-mood", 0,
                TestPlanEnvelope.DIRECTION_NEGATIVE, 8, 3, 30);
    }

    @Test
    void testListObservations_shouldReturnFreshWatchingConfirmedInThatOrder_whenAllThreeExist() {
        UUID owner = ownerId();

        PatternEntity fresh = patternPopulator.reflection(owner, plan("people:anna"),
                PatternEntity.STATUS_PROPOSED);
        PatternEventEntity freshEvent = patternEventPopulator.observation(owner, fresh.getId(),
                "Feltűnt, hogy Anna után többet alszol.\nFigyeljem tovább?",
                List.of("journal_entry:" + UUID.randomUUID()), true, dayAt(0));

        PatternEntity watching = patternPopulator.reflection(owner, plan("sleep-duration-h"),
                PatternEntity.STATUS_MONITORING);

        PatternEntity confirmed = patternPopulator.reflection(owner, plan("late-meal-hour"),
                PatternEntity.STATUS_CONFIRMED);
        patternEventPopulator.decision(owner, confirmed.getId(),
                PatternEventEntity.KIND_CONFIRMED, dayAt(60));

        List<ObservationResponse> cards = getForList(
                "/api/companion/observation?date=" + TODAY, ownerAuthHeaders(),
                HttpStatus.OK, ObservationResponse.class);

        assertThat(cards).extracting(ObservationResponse::getCard)
                .containsExactly("fresh", "watching", "confirmed");
        assertThat(cards.get(0).getId()).isEqualTo(freshEvent.getId());
        assertThat(cards.get(0).getPatternId()).isEqualTo(fresh.getId());
        assertThat(cards.get(0).getText()).isEqualTo("Feltűnt, hogy Anna után többet alszol.");
        assertThat(cards.get(0).getQuestion()).isEqualTo("Figyeljem tovább?");
        assertThat(cards.get(0).getSourceIcon()).isEqualTo("naplo");
        assertThat(cards.get(0).getRepliedChoice()).isNull();
        assertThat(cards.get(0).getEvidence()).hasSize(1);

        assertThat(cards.get(1).getId()).isEqualTo(watching.getId());
        assertThat(cards.get(1).getText()).isEmpty();
        assertThat(cards.get(1).getQuestion()).isNull();
        assertThat(cards.get(1).getMinN()).isEqualTo(8);
        assertThat(cards.get(1).getSourceIcon()).isEqualTo("alvas");

        assertThat(cards.get(2).getId()).isEqualTo(confirmed.getId());
        assertThat(cards.get(2).getStatus()).isEqualTo("confirmed");
        assertThat(cards.get(2).getSourceIcon()).isEqualTo("vacsora");
    }

    @Test
    void testListObservations_shouldMarkTheCardAsReturn_whenTheRowWasRepliedToBeforeTheObservation() {
        UUID owner = ownerId();
        PatternEntity row = patternPopulator.reflection(owner, plan("topic:munka"),
                PatternEntity.STATUS_MONITORING);
        // the answer came FIRST — that is what makes the later observation a `return` card
        patternEventPopulator.userReply(owner, row.getId(), "chip", "watch", null, dayAt(0));
        patternEventPopulator.observation(owner, row.getId(),
                "Ahogy kérted, figyeltem — és tényleg.\nMaradjunk rajta?",
                List.of(), true, dayAt(60));

        List<ObservationResponse> cards = getForList(
                "/api/companion/observation?date=" + TODAY, ownerAuthHeaders(),
                HttpStatus.OK, ObservationResponse.class);

        // one `return` card for the event, one `watching` card for the row itself
        assertThat(cards).extracting(ObservationResponse::getCard)
                .containsExactly("return", "watching");
        assertThat(cards.getFirst().getSourceIcon()).isEqualTo("naplo");
    }

    @Test
    void testListObservations_shouldHideUnsurfacedObservations_whenTheBudgetSuppressedThem() {
        UUID owner = ownerId();
        PatternEntity row = patternPopulator.reflection(owner, plan("people:anna"),
                PatternEntity.STATUS_PROPOSED);
        patternEventPopulator.observation(owner, row.getId(), "Ezt sosem láttad.\nUgye?",
                List.of(), false, dayAt(0));

        assertThat(getForList("/api/companion/observation?date=" + TODAY, ownerAuthHeaders(),
                HttpStatus.OK, ObservationResponse.class)).isEmpty();
    }

    @Test
    void testReplyToPattern_shouldStartMonitoringAndMarkTheCard_whenChoiceIsWatch() {
        UUID owner = ownerId();
        PatternEntity row = patternPopulator.reflection(owner, plan("people:anna"),
                PatternEntity.STATUS_PROPOSED);
        // dayAt(0), not now-1h: the reply below is POSTed at real wall-clock now, and it must land
        // AFTER this observation or the card turns into a `return` one.
        patternEventPopulator.observation(owner, row.getId(), "Feltűnt valami.\nFigyeljem?",
                List.of(), true, dayAt(0));

        PatternReplyResponse reply = postForBody(
                "/api/companion/pattern/" + row.getId() + "/reply",
                new PatternReplyRequest().choice("watch"),
                ownerAuthHeaders(), HttpStatus.OK, PatternReplyResponse.class);

        assertThat(reply.getPattern().getStatus()).isEqualTo("monitoring");
        assertThat(reply.getConversationId()).isNull();
        assertThat(patternRepository.findById(row.getId()).orElseThrow().getStatus())
                .isEqualTo(PatternEntity.STATUS_MONITORING);

        List<ObservationResponse> cards = getForList(
                "/api/companion/observation?date=" + TODAY, ownerAuthHeaders(),
                HttpStatus.OK, ObservationResponse.class);
        assertThat(cards).filteredOn(c -> "fresh".equals(c.getCard()))
                .singleElement()
                .satisfies(card -> assertThat(card.getRepliedChoice()).isEqualTo("watch"));
    }

    @Test
    void testReplyToPattern_shouldOpenAConversationSeededWithTheRow_whenChoiceIsTalk() {
        UUID owner = ownerId();
        PatternEntity row = patternPopulator.reflection(owner, plan("people:anna"),
                PatternEntity.STATUS_PROPOSED);

        PatternReplyResponse reply = postForBody(
                "/api/companion/pattern/" + row.getId() + "/reply",
                new PatternReplyRequest().choice("talk").text("inkább mesélek róla"),
                ownerAuthHeaders(), HttpStatus.OK, PatternReplyResponse.class);

        assertThat(reply.getConversationId()).isNotNull();
        assertThat(conversationRepository.findById(reply.getConversationId()).orElseThrow()
                .getSeedPatternId()).isEqualTo(row.getId());
        // talk is not a verdict — the row does not move
        assertThat(reply.getPattern().getStatus()).isEqualTo("proposed");
    }

    @Test
    void testReplyToPattern_shouldReturn404_whenTheRowBelongsToSomeoneElse() {
        PatternEntity foreign = patternPopulator.reflection(userPopulator.createUser().getId(),
                plan("people:anna"), PatternEntity.STATUS_PROPOSED);

        postForBody("/api/companion/pattern/" + foreign.getId() + "/reply",
                new PatternReplyRequest().choice("watch"),
                ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
        postForBody("/api/companion/pattern/" + UUID.randomUUID() + "/reply",
                new PatternReplyRequest().choice("watch"),
                ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
    }

    @Test
    void testListObservations_shouldReturnOnlyOwnCards_whenAForeignRowHasObservations() {
        UUID stranger = userPopulator.createUser().getId();
        PatternEntity foreign = patternPopulator.reflection(stranger, plan("people:anna"),
                PatternEntity.STATUS_MONITORING);
        patternEventPopulator.observation(stranger, foreign.getId(), "Idegen észrevétel.\nNa?",
                List.of(), true, dayAt(0));

        assertThat(getForList("/api/companion/observation", ownerAuthHeaders(),
                HttpStatus.OK, ObservationResponse.class)).isEmpty();
    }

    @Test
    void testObservationEndpoints_shouldReturn401_whenNoToken() {
        getForBody("/api/companion/observation", null, HttpStatus.UNAUTHORIZED, Void.class);
        postForBody("/api/companion/pattern/" + UUID.randomUUID() + "/reply",
                new PatternReplyRequest().choice("watch"), null,
                HttpStatus.UNAUTHORIZED, Void.class);
    }

    /**
     * A {@code statistical} catalog row can legitimately be {@code monitoring} with a stamped test
     * plan (the Minták screen's "figyeld", plus {@code PatternDetectionService.stampTestPlan}) or
     * be {@code confirmed} by the user — but the Pearson job owns its lifecycle, so it must never
     * surface as an Észrevétel card, nor be answerable through the chip endpoint (S4 review).
     */
    @Test
    void testObservationEndpoints_shouldIgnoreStatisticalRows_whenTheyAreMonitoringOrConfirmed() {
        UUID owner = ownerId();
        PatternEntity stat = patternPopulator.statistical(owner, "pair-monitored",
                PatternEntity.STATUS_MONITORING);
        stat.setTestPlan(plan("sleep-duration-h"));
        patternPopulator.save(stat);

        PatternEntity statConfirmed = patternPopulator.statistical(owner, "pair-confirmed",
                PatternEntity.STATUS_CONFIRMED);
        patternEventPopulator.decision(owner, statConfirmed.getId(),
                PatternEventEntity.KIND_CONFIRMED, dayAt(0));

        assertThat(getForList("/api/companion/observation?date=" + TODAY, ownerAuthHeaders(),
                HttpStatus.OK, ObservationResponse.class)).isEmpty();

        postForBody("/api/companion/pattern/" + stat.getId() + "/reply",
                new PatternReplyRequest().choice("reject"),
                ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
        assertThat(patternRepository.findById(stat.getId()).orElseThrow().getStatus())
                .isEqualTo(PatternEntity.STATUS_MONITORING);
    }

    /**
     * {@code repliedChoice} on a {@code watching} card is the ROW's newest chip answer, not one
     * anchored on {@code lastDetectedAt} — the nightly evaluation bumps that field, which used to
     * silently drop the answer and re-arm the chips (and a re-armed „nem stimmel” is a verdict).
     */
    @Test
    void testListObservations_shouldKeepTheChipAnswer_whenTheNightlyPassBumpedLastDetectedAt() {
        UUID owner = ownerId();
        PatternEntity row = patternPopulator.reflection(owner, plan("sleep-duration-h"),
                PatternEntity.STATUS_MONITORING);
        patternEventPopulator.userReply(owner, row.getId(), "chip", "watch", null, dayAt(0));
        // the nightly pass ran AFTER the answer and moved the row's own timestamp forward
        row.setLastDetectedAt(dayAt(60));
        patternPopulator.save(row);

        List<ObservationResponse> cards = getForList(
                "/api/companion/observation?date=" + TODAY, ownerAuthHeaders(),
                HttpStatus.OK, ObservationResponse.class);

        assertThat(cards).singleElement().satisfies(card -> {
            assertThat(card.getCard()).isEqualTo("watching");
            assertThat(card.getRepliedChoice()).isEqualTo("watch");
        });
    }

    @Test
    void testReplyToPattern_shouldReturn400_whenChoiceIsUnknown() {
        PatternEntity row = patternPopulator.reflection(ownerId(), plan("people:anna"),
                PatternEntity.STATUS_PROPOSED);

        String body = postForBody("/api/companion/pattern/" + row.getId() + "/reply",
                new PatternReplyRequest().choice("shrug"),
                ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);

        assertThat(body).contains("choice");
    }
}
