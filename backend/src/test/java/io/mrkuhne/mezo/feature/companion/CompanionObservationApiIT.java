package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.ObservationEvidenceItem;
import io.mrkuhne.mezo.api.dto.ObservationResponse;
import io.mrkuhne.mezo.api.dto.PatternReplyRequest;
import io.mrkuhne.mezo.api.dto.PatternReplyResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.entity.PatternEvidenceEnvelope;
import io.mrkuhne.mezo.feature.companion.repository.PatternEventRepository;
import io.mrkuhne.mezo.feature.companion.entity.TestPlanEnvelope;
import io.mrkuhne.mezo.feature.companion.repository.AiConversationRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
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
    @Autowired private PatternEventRepository eventRepository;
    @Autowired private AiConversationRepository conversationRepository;
    @Autowired private UserPopulator userPopulator;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private CheckInRepository checkInRepository;

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

        // One thread, one card: the question takes precedence over the standing watching row.
        assertThat(cards).extracting(ObservationResponse::getCard)
                .containsExactly("return");
        assertThat(cards.getFirst().getSourceIcon()).isEqualTo("naplo");
    }

    @Test
    void testListObservations_shouldDropTheRecoveryMetaLead_whenAStoredCardStartsWithIt() {
        // mezo-23ry3: the recovery prompt once asked the model to announce the return, so stored
        // cards carry it; the read path strips it without a data migration.
        UUID owner = ownerId();
        PatternEntity row = patternPopulator.reflection(owner, plan("sport:vall"),
                PatternEntity.STATUS_PROPOSED);
        patternEventPopulator.observation(owner, row.getId(),
                "Korábbi bejegyzésekhez visszatérve: két röplabdanapon más volt a vállad.\nRád illik?",
                List.of(), true, dayAt(0));

        List<ObservationResponse> cards = getForList("/api/companion/observation?date=" + TODAY,
                ownerAuthHeaders(), HttpStatus.OK, ObservationResponse.class);

        assertThat(cards).singleElement().satisfies(card -> {
            assertThat(card.getText()).isEqualTo("Két röplabdanapon más volt a vállad.");
            assertThat(card.getQuestion()).isEqualTo("Rád illik?");
        });
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
    void testObservationEndpoints_shouldShowStatisticalMonitoringWithoutReflectionReplies() {
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
                HttpStatus.OK, ObservationResponse.class)).singleElement().satisfies(card -> {
                    assertThat(card.getPatternId()).isEqualTo(stat.getId());
                    assertThat(card.getKind()).isEqualTo("statistical");
                    assertThat(card.getHypothesisKey()).isEqualTo(stat.getPairKey());
                });

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
    @Test
    void testInbox_shouldKeepNewestUnansweredCard_whenOriginalDayPassed() {
        UUID owner = ownerId();
        PatternEntity row = patternPopulator.reflection(owner, plan("topic:munka"),
                PatternEntity.STATUS_PROPOSED);
        Instant yesterday = dayAt(0).minusSeconds(86400);
        patternEventPopulator.observation(owner, row.getId(), "Régi megfogalmazás.\nRád illik?",
                List.of(), true, yesterday.minusSeconds(60));
        PatternEventEntity latest = patternEventPopulator.observation(owner, row.getId(),
                "Munka után feszültebbnek írtad le magad.\nRád illik?", List.of(), true, yesterday);
        assertThat(getForList("/api/companion/observation", ownerAuthHeaders(),
                HttpStatus.OK, ObservationResponse.class)).singleElement().satisfies(card -> {
                    assertThat(card.getId()).isEqualTo(latest.getId());
                    assertThat(card.getOccurredAt().toInstant()).isEqualTo(yesterday);
                });
        // Explicit today is the same inbox, not a different data product.
        assertThat(getForList("/api/companion/observation?date=" + TODAY, ownerAuthHeaders(),
                HttpStatus.OK, ObservationResponse.class)).hasSize(1);
    }

    @Test
    void testInbox_shouldNotResurfaceOldAnsweredCard_whenUserAlreadyReplied() {
        UUID owner = ownerId();
        PatternEntity row = patternPopulator.reflection(owner, plan("topic:munka"),
                PatternEntity.STATUS_PROPOSED);
        Instant yesterday = dayAt(0).minusSeconds(86400);
        patternEventPopulator.observation(owner, row.getId(), "Munka és stressz.\nRád illik?",
                List.of(), true, yesterday);
        patternEventPopulator.userReply(owner, row.getId(), "chip", "reject", null,
                yesterday.plusSeconds(30));
        assertThat(getForList("/api/companion/observation", ownerAuthHeaders(),
                HttpStatus.OK, ObservationResponse.class)).isEmpty();
    }

    @Test
    void testHistoricalDay_shouldNotIncludeLaterObservation_whenInboxHasUnansweredCards() {
        UUID owner = ownerId();
        PatternEntity row = patternPopulator.reflection(owner, plan("topic:munka"),
                PatternEntity.STATUS_PROPOSED);
        patternEventPopulator.observation(owner, row.getId(), "Mai észrevétel.\nRád illik?",
                List.of(), true, dayAt(0));
        assertThat(getForList("/api/companion/observation?date=" + TODAY.minusDays(1), ownerAuthHeaders(),
                HttpStatus.OK, ObservationResponse.class)).isEmpty();
    }

    @Test
    void testInbox_shouldReleaseDeferredGroundedEvent_whenNextDayHasBudget() {
        UUID owner = ownerId();
        PatternEntity row = patternPopulator.reflection(owner, plan("topic:munka"),
                PatternEntity.STATUS_PROPOSED);
        PatternEventEntity event = patternEventPopulator.observation(owner, row.getId(),
                "Korábbi forrásból észrevétel.\nRád illik?", List.of("Napló · " + TODAY.minusDays(1)),
                false, dayAt(0).minusSeconds(86400));
        var old = event.getPayload();
        event.setPayload(new PatternEventPayloadEnvelope(null, null, null, null, null,
                null, null, "grounded", null, old.text(), old.evidenceRefs(), false));
        eventRepository.saveAndFlush(event);
        assertThat(getForList("/api/companion/observation", ownerAuthHeaders(),
                HttpStatus.OK, ObservationResponse.class)).singleElement().satisfies(card -> {
                    assertThat(card.getId()).isEqualTo(event.getId());
                    assertThat(card.getEvidence()).singleElement().satisfies(item -> {
                        assertThat(item.getType()).isEqualTo("tag");
                        assertThat(item.getText()).isEqualTo("Napló · " + TODAY.minusDays(1));
                    });
                });
        assertThat(getForList("/api/companion/observation", ownerAuthHeaders(),
                HttpStatus.OK, ObservationResponse.class)).hasSize(1);
    }

    @Test
    void testHistoricalDay_shouldExcludeCurrentWatchingState_whenAskingForPastDay() {
        patternPopulator.reflection(ownerId(), plan("topic:munka"), PatternEntity.STATUS_MONITORING);
        assertThat(getForList("/api/companion/observation?date=" + TODAY.minusDays(3), ownerAuthHeaders(),
                HttpStatus.OK, ObservationResponse.class)).isEmpty();
    }

    @Test
    void testInbox_shouldHideRefutedCard_whenLifecycleRefutesUnansweredPattern() {
        UUID owner = ownerId();
        PatternEntity row = patternPopulator.reflection(owner, plan("topic:munka"), PatternEntity.STATUS_REFUTED);
        patternEventPopulator.observation(owner, row.getId(), "Már cáfolt észrevétel.\nIgaz?", List.of(), true, dayAt(0));
        assertThat(getForList("/api/companion/observation", ownerAuthHeaders(),
                HttpStatus.OK, ObservationResponse.class)).isEmpty();
    }

    @Test
    void testInbox_shouldKeepDeferredCardPending_whenMidnightPublicationExhaustsDailyBudget() {
        UUID owner = ownerId();
        PatternEntity shown = patternPopulator.reflection(owner, plan("topic:munka"), PatternEntity.STATUS_PROPOSED);
        patternEventPopulator.observation(owner, shown.getId(), "Első.\nIgaz?", List.of(), true, dayAt(0));
        patternEventPopulator.observation(owner, shown.getId(), "Második.\nIgaz?", List.of(), true, dayAt(60));
        PatternEntity waiting = patternPopulator.reflection(owner, plan("topic:sport"), PatternEntity.STATUS_PROPOSED);
        var pending = patternEventPopulator.observation(owner, waiting.getId(), "Várakozó.\nIgaz?", List.of(), false,
                dayAt(0).minusSeconds(86400));
        var p = pending.getPayload();
        pending.setPayload(new PatternEventPayloadEnvelope(null, null, null, null, null,
                null, null, "grounded", null, p.text(), p.evidenceRefs(), false));
        eventRepository.saveAndFlush(pending);
        assertThat(getForList("/api/companion/observation", ownerAuthHeaders(), HttpStatus.OK,
                ObservationResponse.class)).extracting(ObservationResponse::getId).doesNotContain(pending.getId());
        assertThat(eventRepository.findById(pending.getId()).orElseThrow().getPayload().surfaced()).isFalse();
    }

    /** {@code patternEventPopulator.observation} has no channel parameter — grounded fixtures set
     *  it after the fact, mirroring the other grounded fixtures in this class. */
    private PatternEventEntity groundedObservation(UUID owner, UUID patternId, String text,
                                                    List<String> evidenceRefs, Instant occurredAt) {
        PatternEventEntity event = patternEventPopulator.observation(owner, patternId, text, evidenceRefs, true, occurredAt);
        var p = event.getPayload();
        event.setPayload(new PatternEventPayloadEnvelope(p.r(), p.n(), p.p(), p.reinforcementCount(),
                p.factId(), p.hit(), p.verdict(), "grounded", p.choice(), p.text(), p.evidenceRefs(), p.surfaced()));
        return eventRepository.saveAndFlush(event);
    }

    @Test
    void groundedEvidenceIsServedStructured() {
        UUID owner = ownerId();
        PatternEntity row = patternPopulator.reflection(owner, plan("topic:munka"), PatternEntity.STATUS_PROPOSED);
        var checkIn = checkInPopulator.createCheckIn(owner, TODAY, "08:00", 6, 3, "Meglepően jól indult a hét");
        String checkInRef = "check_in:" + checkIn.getId();
        groundedObservation(owner, row.getId(), "Feltűnt valami.\nIgaz?",
                List.of(checkInRef, "Check-in · " + TODAY + " · note=Meglepően jól indult a hét; energy=6"),
                dayAt(0));

        List<ObservationResponse> cards = getForList(
                "/api/companion/observation?date=" + TODAY, ownerAuthHeaders(),
                HttpStatus.OK, ObservationResponse.class);

        ObservationEvidenceItem item = cards.getFirst().getEvidence().getFirst();
        assertThat(item.getType()).isEqualTo("record");
        assertThat(item.getSource()).isEqualTo("check_in");
        assertThat(item.getDate()).isEqualTo(TODAY);
        assertThat(item.getQuote()).isEqualTo("Meglepően jól indult a hét");
        assertThat(item.getFields()).containsEntry("energy", "6");
        assertThat(item.getRef()).isEqualTo(checkInRef);
    }

    @Test
    void legacyEvidenceLabelsBecomeTags() {
        UUID owner = ownerId();
        PatternEntity row = patternPopulator.reflection(owner, plan("topic:munka"), PatternEntity.STATUS_PROPOSED);
        patternEventPopulator.observation(owner, row.getId(), "Hálanapló.\nIgaz?",
                List.of("4 hála-bejegyzés"), true, dayAt(0));

        List<ObservationResponse> cards = getForList(
                "/api/companion/observation?date=" + TODAY, ownerAuthHeaders(),
                HttpStatus.OK, ObservationResponse.class);

        ObservationEvidenceItem item = cards.getFirst().getEvidence().getFirst();
        assertThat(item.getType()).isEqualTo("tag");
        assertThat(item.getText()).isEqualTo("4 hála-bejegyzés");
    }

    /**
     * {@code validEventEvidence} hides an EVENT card outright when any of its canonical refs is
     * dead, so a per-item fallback can only be observed on a ROW ({@code watching}) card, whose
     * {@code validEvidence} gate skips strict re-validation for lists without an
     * {@code observation-topic:} marker (the S1 delta's documented benign limitation: this is
     * exactly the labelled-pair shape a real publisher-built row list never produces).
     */
    @Test
    void unreadableRefFallsBackToStoredLabel() {
        UUID owner = ownerId();
        PatternEntity row = patternPopulator.reflection(owner, plan("topic:munka"), PatternEntity.STATUS_MONITORING);
        var deletedCheckIn = checkInPopulator.createCheckIn(owner, TODAY, "08:00", 6, 3, "Törölt bejegyzés");
        String deletedRef = "check_in:" + deletedCheckIn.getId();
        var liveCheckIn = checkInPopulator.createCheckIn(owner, TODAY, "09:00", 5, 4, "Élő bejegyzés");
        String liveRef = "check_in:" + liveCheckIn.getId();
        checkInRepository.delete(deletedCheckIn);
        checkInRepository.flush();
        row.setEvidence(new PatternEvidenceEnvelope(List.of(
                deletedRef, "Check-in · " + TODAY + " · note=Törölt bejegyzés; energy=6", liveRef)));
        patternPopulator.save(row);

        List<ObservationResponse> cards = getForList(
                "/api/companion/observation?date=" + TODAY, ownerAuthHeaders(),
                HttpStatus.OK, ObservationResponse.class);
        ObservationResponse card = cards.stream().filter(c -> c.getPatternId().equals(row.getId())).findFirst().orElseThrow();
        List<ObservationEvidenceItem> items = card.getEvidence();

        assertThat(items).anySatisfy(i -> {
            assertThat(i.getType()).isEqualTo("tag");
            assertThat(i.getText()).startsWith("Check-in ·");
        });
        assertThat(items).anySatisfy(i -> {
            assertThat(i.getType()).isEqualTo("record");
            assertThat(i.getRef()).isEqualTo(liveRef);
        });
    }

}
