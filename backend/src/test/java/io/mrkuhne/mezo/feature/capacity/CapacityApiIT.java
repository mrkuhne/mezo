package io.mrkuhne.mezo.feature.capacity;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.CapacityAdjustment;
import io.mrkuhne.mezo.api.dto.CapacityProposal;
import io.mrkuhne.mezo.api.dto.CapacityProposalAcceptRequest;
import io.mrkuhne.mezo.api.dto.CapacityWeek;
import io.mrkuhne.mezo.api.dto.CapacityWeekDay;
import io.mrkuhne.mezo.api.dto.PlannedSkipKind;
import io.mrkuhne.mezo.api.dto.PlannedSkipReason;
import io.mrkuhne.mezo.api.dto.PlannedSkipRequest;
import io.mrkuhne.mezo.feature.capacity.entity.AdjustmentState;
import io.mrkuhne.mezo.feature.capacity.entity.CapacityProposalEntity;
import io.mrkuhne.mezo.feature.capacity.entity.DayAdjustmentEntity;
import io.mrkuhne.mezo.feature.capacity.repository.CapacityProposalRepository;
import io.mrkuhne.mezo.feature.capacity.repository.DayAdjustmentRepository;
import io.mrkuhne.mezo.feature.capacity.service.AdjustmentDraft;
import io.mrkuhne.mezo.feature.capacity.service.AdjustmentPayload;
import io.mrkuhne.mezo.feature.capacity.service.ProposalService;
import io.mrkuhne.mezo.feature.train.entity.PlannedSkipEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.PlannedSkipRepository;
import io.mrkuhne.mezo.feature.train.service.PlannedSkipService;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.feature.wearable.entity.CalendarEventEntity;
import io.mrkuhne.mezo.feature.wearable.repository.CalendarEventRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.CalendarEventPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/**
 * Boop B7 K3 (mezo-r36n9.17, Task 17): the Átrendezés API over real data — the week read generates and stores the
 * proposals of the next week (fully ahead of the real clock, so every day is open), accept is idempotent by
 * {@code clientRef} and refuses a week that changed, decline suppresses the kind for the day, regenerate keeps the
 * accepted ones. Plus the Task 14 hardening: per-owner accept lock, replay scoped to the proposal, KAPACITAS refused on
 * the public skip path. The fixture week: a "Pull 1" gym session on Thursday 17:30 under a packed Thursday (three
 * meetings with people, 6 hours). Names and figures are invented.
 */
class CapacityApiIT extends ApiIntegrationTest {

    private static final ZoneId BUD = ZoneId.of("Europe/Budapest");

    @Autowired private TrainPopulator train;
    @Autowired private CalendarEventPopulator calendar;
    @Autowired private CalendarEventRepository events;
    @Autowired private CapacityProposalRepository proposals;
    @Autowired private DayAdjustmentRepository adjustments;
    @Autowired private ProposalService service;
    @Autowired private PlannedSkipService plannedSkips;
    @Autowired private PlannedSkipRepository skipRows;

    private final LocalDate monday = LocalDate.now(BUD).with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
        .plusWeeks(1);
    private final LocalDate thursday = monday.plusDays(3);
    private final LocalDate friday = monday.plusDays(4);
    private final LocalDate saturday = monday.plusDays(5);

    private WorkoutSessionEntity sessionOn(UUID owner, UUID mesoId, LocalDate day, String label) {
        int dow = day.getDayOfWeek().getValue() - 1;
        WorkoutSessionEntity s = train.createWorkoutSession(owner, mesoId, WorkoutService.HU_DAY_LABELS.get(dow), label,
            dow, "active");
        train.createExercise(owner, s.getId(), "Evezés", 0);
        train.createGymSlot(owner, dow, "17:30");
        return s;
    }

    private void withPeople(UUID owner, LocalDate date, String title, String startUtc, String endUtc) {
        CalendarEventEntity e = calendar.createEvent(owner, date, title,
            Instant.parse(date + "T" + startUtc + ":00Z"), Instant.parse(date + "T" + endUtc + ":00Z"));
        e.setAttendeeCount(4);
        events.saveAndFlush(e);
    }

    /** A user whose next-week Thursday is packed under a gym session. */
    private RegisteredUser packedThursday(String label) {
        RegisteredUser user = registerUser(label);
        var meso = train.createActiveMeso(user.id());
        sessionOn(user.id(), meso.getId(), thursday, "Pull 1");
        withPeople(user.id(), thursday, "Tervezés", "07:00", "11:00");
        withPeople(user.id(), thursday, "Egyeztetés", "12:00", "13:00");
        withPeople(user.id(), thursday, "Átadó", "13:30", "14:30");
        return user;
    }

    private String weekUri() {
        return "/api/capacity/week?monday=" + monday;
    }

    private CapacityWeek week(RegisteredUser u) {
        return getForBody(weekUri(), u.headers(), HttpStatus.OK, CapacityWeek.class);
    }

    private CapacityWeek regenerate(RegisteredUser u) {
        return postForBody("/api/capacity/proposals/regenerate?monday=" + monday, null, u.headers(), HttpStatus.OK,
            CapacityWeek.class);
    }

    private static List<CapacityProposal> open(CapacityWeek w) {
        return w.getProposals().stream().filter(p -> p.getStatus() == CapacityProposal.StatusEnum.OPEN).toList();
    }

    private String accept(RegisteredUser u, UUID id, UUID clientRef, HttpStatus expected) {
        return postForBody("/api/capacity/proposals/" + id + "/accept",
            new CapacityProposalAcceptRequest().clientRef(clientRef), u.headers(), expected, String.class);
    }

    /** An open proposal written by hand (no fingerprint): the hardening tests need an exact bundle. */
    private CapacityProposalEntity storedProposal(UUID owner, AdjustmentPayload step) {
        CapacityProposalEntity p = new CapacityProposalEntity();
        p.setCreatedBy(owner);
        p.setWeekStart(monday);
        p.setDay(step.day());
        p.setKind(step.kind().name());
        p.setBundle(AdjustmentDraft.toBundle(List.of(AdjustmentDraft.of(step))));
        p.setTitle("például: átteszem");
        p.setGeneratorVersion((short) 1);
        p.setStatus("open");
        return proposals.saveAndFlush(p);
    }

    @Test
    void weekListsProposalsWithEffects() {
        RegisteredUser user = packedThursday("cap-week");

        CapacityWeek w = week(user);

        assertThat(w.getMonday()).isEqualTo(monday);
        assertThat(w.getDays()).extracting(CapacityWeekDay::getDate)
            .containsExactly(monday, monday.plusDays(1), monday.plusDays(2), thursday, friday, saturday,
                monday.plusDays(6));
        CapacityWeekDay thu = w.getDays().get(3);
        assertThat(thu.getVerdict()).isIn(CapacityWeekDay.VerdictEnum.SZOROS, CapacityWeekDay.VerdictEnum.TUL_SOK);
        assertThat(thu.getLabel()).isIn("szoros", "túl sok");
        assertThat(thu.getRatio()).isPositive();
        assertThat(w.getPatterns()).isEmpty();
        assertThat(w.getAdjustments()).isEmpty();

        assertThat(w.getProposals()).isNotEmpty();
        CapacityProposal p = w.getProposals().get(0);
        assertThat(p.getStatus()).isEqualTo(CapacityProposal.StatusEnum.OPEN);
        assertThat(p.getDay()).isEqualTo(thursday);
        assertThat(p.getTouchedDays()).contains(thursday);
        assertThat(p.getTitle()).isNotBlank();
        assertThat(p.getMove()).isNotBlank();
        assertThat(p.getEffectLines()).hasSizeBetween(3, 4);
        assertThat(p.getSteps()).isNotEmpty();
        // "Minden hatása": the touched day's verdict before → after from the load model, and the week rows
        assertThat(p.getEffects()).anySatisfy(l -> {
            assertThat(l.getLabel()).isEqualTo("Csütörtök terhe");
            assertThat(l.getBefore()).isEqualTo(thu.getLabel());
            assertThat(l.getFavours()).isIn(0, 1); // lighter: the same word, or a lighter one
        });
        // the target day of the move: its own before → after row
        assertThat(p.getEffects()).filteredOn(l -> l.getLabel().endsWith(" terhe")).hasSizeGreaterThanOrEqualTo(2);
        assertThat(p.getEffectLines()).anySatisfy(l -> {
            assertThat(l).contains("csütörtök");
        });
        assertThat(p.getEffects()).extracting(c -> c.getLabel()).contains("Heti edzés", "Heti kalória", "Súlycél");

        // stored, not regenerated on the next read — and an unchanged week keeps them open
        CapacityWeek again = week(user);
        assertThat(again.getProposals()).extracting(CapacityProposal::getId)
            .containsExactlyElementsOf(w.getProposals().stream().map(CapacityProposal::getId).toList());
        assertThat(again.getProposals()).allSatisfy(x ->
            assertThat(x.getStatus()).isEqualTo(CapacityProposal.StatusEnum.OPEN));
        // a past week is read-only: no proposals are generated for it
        assertThat(getForBody("/api/capacity/week?monday=" + monday.minusWeeks(3), user.headers(), HttpStatus.OK,
            CapacityWeek.class).getProposals()).isEmpty();
        String bad = getForBody("/api/capacity/week?monday=" + thursday, user.headers(), HttpStatus.BAD_REQUEST,
            String.class);
        assertHasFieldError(bad, "monday", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void acceptIsIdempotentByClientRef() {
        RegisteredUser user = packedThursday("cap-accept");
        CapacityProposal p = week(user).getProposals().get(0);
        UUID clientRef = UUID.randomUUID();

        CapacityAdjustment[] first = postForBody("/api/capacity/proposals/" + p.getId() + "/accept",
            new CapacityProposalAcceptRequest().clientRef(clientRef), user.headers(), HttpStatus.OK,
            CapacityAdjustment[].class);
        CapacityAdjustment[] again = postForBody("/api/capacity/proposals/" + p.getId() + "/accept",
            new CapacityProposalAcceptRequest().clientRef(clientRef), user.headers(), HttpStatus.OK,
            CapacityAdjustment[].class);

        assertThat(first).isNotEmpty();
        assertThat(again).extracting(CapacityAdjustment::getId)
            .containsExactlyElementsOf(List.of(first).stream().map(CapacityAdjustment::getId).toList());
        assertThat(adjustments.findAll()).filteredOn(r -> user.id().equals(r.getCreatedBy()))
            .extracting(DayAdjustmentEntity::getBundleId).containsOnly(first[0].getBundleId())
            .hasSize(first.length);
        CapacityWeek after = week(user);
        assertThat(after.getProposals()).filteredOn(x -> x.getId().equals(p.getId())).singleElement()
            .satisfies(x -> assertThat(x.getStatus()).isEqualTo(CapacityProposal.StatusEnum.ACCEPTED));
        assertThat(after.getAdjustments()).extracting(CapacityAdjustment::getBundleId)
            .containsOnly(first[0].getBundleId());
    }

    @Test
    void acceptStaleProposalIs409() {
        RegisteredUser user = packedThursday("cap-stale");
        CapacityProposal p = week(user).getProposals().get(0);
        // the week changed on a day the proposal touches: a new meeting on Thursday
        withPeople(user.id(), thursday, "Új egyeztetés", "15:00", "15:30");

        String body = accept(user, p.getId(), UUID.randomUUID(), HttpStatus.CONFLICT);

        assertHasRequestError(body, "CAPACITY_PROPOSAL_STALE");
        assertThat(adjustments.findAll()).noneMatch(r -> user.id().equals(r.getCreatedBy()));
        assertThat(proposals.findById(p.getId()).orElseThrow().getStatus()).isEqualTo("open");
    }

    @Test
    void weekExpiresAProposalWhoseWeekChanged() {
        RegisteredUser user = packedThursday("cap-expire");
        CapacityProposal p = week(user).getProposals().get(0);
        withPeople(user.id(), thursday, "Új egyeztetés", "15:00", "15:30");

        CapacityWeek after = week(user);

        // the stale card is settled on the read, never left open to answer 409
        assertThat(after.getProposals()).filteredOn(x -> x.getId().equals(p.getId())).singleElement()
            .satisfies(x -> assertThat(x.getStatus()).isEqualTo(CapacityProposal.StatusEnum.EXPIRED));
        assertThat(open(after)).noneMatch(x -> x.getTouchedDays().contains(thursday));
        // "Kérek más javaslatot" fills the week again from the week as it is now
        CapacityWeek refilled = regenerate(user);
        assertThat(open(refilled)).anySatisfy(x -> assertThat(x.getDay()).isEqualTo(thursday));
        assertThat(refilled.getProposals()).filteredOn(x -> x.getId().equals(p.getId())).singleElement()
            .satisfies(x -> assertThat(x.getStatus()).isEqualTo(CapacityProposal.StatusEnum.EXPIRED));
    }

    @Test
    void declineSuppressesKindForTheDay() {
        RegisteredUser user = packedThursday("cap-decline");
        CapacityProposal first = week(user).getProposals().get(0);
        // regenerate without a decline proposes the same kind for the same day again (the old one is ignored)
        CapacityWeek again = regenerate(user);
        assertThat(again.getProposals()).filteredOn(x -> x.getId().equals(first.getId())).singleElement()
            .satisfies(x -> assertThat(x.getStatus()).isEqualTo(CapacityProposal.StatusEnum.IGNORED));
        CapacityProposal second = open(again).stream()
            .filter(x -> x.getKind() == first.getKind() && first.getDay().equals(x.getDay()))
            .findFirst().orElseThrow();

        CapacityProposal declined = postForBody("/api/capacity/proposals/" + second.getId() + "/decline", null,
            user.headers(), HttpStatus.OK, CapacityProposal.class);
        assertThat(declined.getStatus()).isEqualTo(CapacityProposal.StatusEnum.DECLINED);
        assertThat(declined.getDecidedAt()).isNotNull();
        assertThat(proposals.findById(second.getId()).orElseThrow().getDecidedAt()).isNotNull();

        CapacityWeek after = regenerate(user);
        assertThat(open(after)).noneMatch(x -> x.getKind() == second.getKind() && thursday.equals(x.getDay()));
        assertThat(after.getProposals()).filteredOn(x -> x.getId().equals(second.getId())).singleElement()
            .satisfies(x -> assertThat(x.getStatus()).isEqualTo(CapacityProposal.StatusEnum.DECLINED));
        // a declined proposal cannot be accepted any more
        assertHasRequestError(accept(user, second.getId(), UUID.randomUUID(), HttpStatus.CONFLICT),
            "CAPACITY_PROPOSAL_STALE");
    }

    @Test
    void regenerateKeepsAccepted() {
        RegisteredUser user = packedThursday("cap-regen");
        CapacityWeek w = week(user);
        CapacityProposal accepted = w.getProposals().get(0);
        List<UUID> others = w.getProposals().stream().skip(1).map(CapacityProposal::getId).toList();
        accept(user, accepted.getId(), UUID.randomUUID(), HttpStatus.OK);

        CapacityWeek after = regenerate(user);

        assertThat(after.getProposals()).filteredOn(x -> x.getId().equals(accepted.getId())).singleElement()
            .satisfies(x -> assertThat(x.getStatus()).isEqualTo(CapacityProposal.StatusEnum.ACCEPTED));
        assertThat(after.getProposals()).filteredOn(x -> others.contains(x.getId()))
            .allSatisfy(x -> assertThat(x.getStatus()).isEqualTo(CapacityProposal.StatusEnum.IGNORED));
        // the accepted change is in the week already: nothing proposes the same change for that day again
        assertThat(open(after)).noneMatch(x -> x.getKind() == accepted.getKind()
            && accepted.getDay().equals(x.getDay()));
        assertThat(after.getAdjustments()).isNotEmpty();
    }

    /**
     * Fix round 1: "Ha mindet jóváhagyod" — the week's lines with every open proposal applied together (the move of
     * Thursday's session to Saturday and a later Wednesday bedtime), from the engines; absent below two open ones.
     */
    @Test
    void weekCarriesAllEffectsOfTheOpenProposals() {
        RegisteredUser user = registerUser("cap-all");
        var meso = train.createActiveMeso(user.id());
        WorkoutSessionEntity pull = sessionOn(user.id(), meso.getId(), thursday, "Pull 1");
        withPeople(user.id(), thursday, "Tervezés", "07:00", "11:00");
        withPeople(user.id(), thursday, "Egyeztetés", "12:00", "13:00");
        withPeople(user.id(), thursday, "Átadó", "13:30", "14:30");
        CapacityProposalEntity move = storedProposal(user.id(),
            new AdjustmentPayload.MoveSessionDay(pull.getId(), thursday, saturday));
        storedProposal(user.id(), new AdjustmentPayload.ShiftBedtime(monday.plusDays(2), java.time.LocalTime.of(23, 15)));

        CapacityWeek w = week(user);

        assertThat(w.getAllEffects()).extracting(c -> c.getLabel())
            .containsExactly("Túl sok nap a héten", "Szoros nap", "Heti edzés", "Heti kalória", "Alvás a héten",
                "Súlycél");
        long overBefore = w.getDays().stream().filter(d -> "túl sok".equals(d.getLabel())).count();
        long tightBefore = w.getDays().stream().filter(d -> "szoros".equals(d.getLabel())).count();
        var over = w.getAllEffects().get(0);
        assertThat(over.getBefore()).isEqualTo(String.valueOf(overBefore));
        assertThat(Integer.parseInt(over.getAfter())).isLessThanOrEqualTo((int) overBefore);
        assertThat(over.getFavours()).isEqualTo(Integer.compare((int) overBefore, Integer.parseInt(over.getAfter())));
        assertThat(w.getAllEffects().get(1).getBefore()).isEqualTo(String.valueOf(tightBefore));
        // the move keeps the week's one session; the later bedtime keeps the full need
        assertThat(w.getAllEffects().get(2).getBefore()).isEqualTo("1");
        assertThat(w.getAllEffects().get(2).getAfter()).isEqualTo("1");
        assertThat(w.getAllEffects().get(4).getBefore()).isEqualTo(w.getAllEffects().get(4).getAfter());

        // one open proposal left: no "all" block
        postForBody("/api/capacity/proposals/" + move.getId() + "/decline", null, user.headers(), HttpStatus.OK,
            CapacityProposal.class);
        assertThat(week(user).getAllEffects()).isNull();
    }

    @Test
    void clientRefOfAnotherProposalIs409() {
        RegisteredUser user = registerUser("cap-ref");
        CapacityProposalEntity a = storedProposal(user.id(), new AdjustmentPayload.ShiftBedtime(thursday,
            java.time.LocalTime.of(23, 30)));
        CapacityProposalEntity b = storedProposal(user.id(), new AdjustmentPayload.ShiftBedtime(friday,
            java.time.LocalTime.of(23, 45)));
        UUID clientRef = UUID.randomUUID();
        accept(user, a.getId(), clientRef, HttpStatus.OK);

        String body = accept(user, b.getId(), clientRef, HttpStatus.CONFLICT);

        assertHasRequestError(body, "CAPACITY_CLIENT_REF_REUSED");
        assertThat(proposals.findById(b.getId()).orElseThrow().getStatus()).isEqualTo("open");
        assertThat(adjustments.findAll()).filteredOn(r -> user.id().equals(r.getCreatedBy()))
            .extracting(DayAdjustmentEntity::getProposalId).containsOnly(a.getId());
    }

    @Test
    void twoAcceptsAtOnceCannotClaimTheSameDay() throws Exception {
        RegisteredUser user = registerUser("cap-lock");
        var meso = train.createActiveMeso(user.id());
        WorkoutSessionEntity thu = sessionOn(user.id(), meso.getId(), thursday, "Pull 1");
        WorkoutSessionEntity fri = sessionOn(user.id(), meso.getId(), friday, "Push 1");
        UUID a = storedProposal(user.id(), new AdjustmentPayload.MoveSessionDay(thu.getId(), thursday, saturday))
            .getId();
        UUID b = storedProposal(user.id(), new AdjustmentPayload.MoveSessionDay(fri.getId(), friday, saturday))
            .getId();

        CountDownLatch start = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        List<Future<String>> results = new ArrayList<>();
        for (UUID id : List.of(a, b)) {
            results.add(pool.submit(() -> {
                start.await();
                try {
                    service.accept(user.id(), id, UUID.randomUUID());
                    return "ok";
                } catch (SystemRuntimeErrorException e) {
                    return e.getMessage();
                }
            }));
        }
        start.countDown();
        List<String> outcomes = new ArrayList<>();
        for (Future<String> f : results) {
            outcomes.add(f.get(30, TimeUnit.SECONDS));
        }
        pool.shutdown();

        assertThat(outcomes).containsExactlyInAnyOrder("ok", "CAPACITY_MOVE_NOT_EMPTY_DAY");
        assertThat(adjustments.findAll()).filteredOn(r -> user.id().equals(r.getCreatedBy()))
            .filteredOn(r -> AdjustmentState.ACTIVE.wire().equals(r.getState())).hasSize(1);
    }

    @Test
    void publicSkipPathRefusesKapacitas() {
        RegisteredUser user = registerUser("cap-skip");
        String body = putForBody("/api/train/skips", new PlannedSkipRequest()
                .date(LocalDate.now(BUD)).kind(PlannedSkipKind.GYM).reasonCategory(PlannedSkipReason.KAPACITAS),
            user.headers(), HttpStatus.BAD_REQUEST, String.class);

        assertHasRequestError(body, "TRAIN_SKIP_REASON_INVALID");
    }

    @Test
    void publicSkipPathCannotReReasonACapacitySkip() {
        RegisteredUser user = registerUser("cap-skip-owned");
        LocalDate today = LocalDate.now(BUD);
        UUID id = plannedSkips.upsertForCapacity(user.id(), today).getId();

        String body = putForBody("/api/train/skips", new PlannedSkipRequest()
                .date(today).kind(PlannedSkipKind.GYM).reasonCategory(PlannedSkipReason.TIRED),
            user.headers(), HttpStatus.CONFLICT, String.class);

        assertHasRequestError(body, "TRAIN_SKIP_CAPACITY_OWNED");
        assertThat(skipRows.findByIdAndCreatedByAndDeletedFalse(id, user.id()).orElseThrow().getReasonCategory())
            .isEqualTo(PlannedSkipEntity.Reason.KAPACITAS);
    }
}
