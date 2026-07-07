package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.ChallengeDecisionRequest;
import io.mrkuhne.mezo.api.dto.ChallengeResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.proactive.entity.ChallengeEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.ChallengePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

/** HTTP-level workout-challenge flow: session/day list (lazy propose) + L2 accept/dismiss + guards. */
@ActiveProfiles("companion-fake")
class ProactiveApiChallengeIT extends ApiIntegrationTest {

    @Autowired private ChallengePopulator challengePopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    private String challengeUri(UUID templateSessionId, LocalDate date) {
        return "/api/proactive/challenge?templateSessionId=" + templateSessionId + "&date=" + date;
    }

    /** A planted template session (the challenge FK target) + its exercise. */
    private record Plan(WorkoutSessionEntity session, ExerciseEntity exercise) {
    }

    private Plan plantTemplate(UUID user) {
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "Meso", "active");
        WorkoutSessionEntity session = trainPopulator.createWorkoutSession(user, meso.getId(), "Pull", "pull", 0, "planned");
        ExerciseEntity ex = trainPopulator.createExercise(user, session.getId(), "Chest Supported Row", 0);
        return new Plan(session, ex);
    }

    /** A template session with one exercise carrying logged-set history (the grounding gate passes). */
    private WorkoutSessionEntity seedTemplateWithHistory(UUID user) {
        Plan plan = plantTemplate(user);
        trainPopulator.createExerciseSet(user, plan.exercise().getId(), 0);
        trainPopulator.createExerciseSet(user, plan.exercise().getId(), 1);
        return plan.session();
    }

    @Test
    void testGetChallenges_shouldReturnEmpty_whenSessionHasNoHistory() {
        List<ChallengeResponse> challenges = getForList(
                challengeUri(UUID.randomUUID(), LocalDate.now()), ownerAuthHeaders(), HttpStatus.OK, ChallengeResponse.class);

        assertThat(challenges).isEmpty();   // no exercise history ⇒ grounding gate ⇒ honest empty, never 404
    }

    @Test
    void testGetChallenges_shouldLazilyPropose_whenSessionHasHistory() {
        WorkoutSessionEntity session = seedTemplateWithHistory(ownerId());

        List<ChallengeResponse> challenges = getForList(
                challengeUri(session.getId(), LocalDate.now()), ownerAuthHeaders(), HttpStatus.OK, ChallengeResponse.class);

        assertThat(challenges).hasSize(1);
        ChallengeResponse c = challenges.getFirst();
        assertThat(c.getStatus()).isEqualTo(ChallengeEntity.STATUS_PROPOSED);
        assertThat(c.getType()).isEqualTo(ChallengeEntity.TYPE_PR);
        assertThat(c.getTypeLabel()).isEqualTo("PR-attempt");
        assertThat(c.getTarget()).isNotBlank();
        assertThat(c.getExercise()).isEqualTo("Chest Supported Row");
    }

    @Test
    void testDecide_shouldAcceptThenReject409_whenAcceptedThenReDecided() {
        Plan plan = plantTemplate(ownerId());
        ChallengeEntity proposed = challengePopulator.challengePr(ownerId(), plan.session().getId(), LocalDate.now(),
                plan.exercise().getId(), ChallengeEntity.STATUS_PROPOSED, "90.00", 6);

        ChallengeResponse accepted = postForBody(
                "/api/proactive/challenge/" + proposed.getId() + "/decision",
                new ChallengeDecisionRequest().decision("accept"),
                ownerAuthHeaders(), HttpStatus.OK, ChallengeResponse.class);
        assertThat(accepted.getStatus()).isEqualTo(ChallengeEntity.STATUS_ACCEPTED);

        // re-deciding a now-accepted challenge is a conflict (only proposed rows are decidable)
        String body = postForBody(
                "/api/proactive/challenge/" + proposed.getId() + "/decision",
                new ChallengeDecisionRequest().decision("dismiss"),
                ownerAuthHeaders(), HttpStatus.CONFLICT, String.class);
        assertHasRequestError(body, "PROACTIVE_CHALLENGE_NOT_PROPOSED");
    }

    @Test
    void testDecide_shouldDismissAndDropFromList_whenDismissed() {
        Plan plan = plantTemplate(ownerId());
        UUID templateSessionId = plan.session().getId();
        ChallengeEntity proposed = challengePopulator.challengePr(ownerId(), templateSessionId, LocalDate.now(),
                plan.exercise().getId(), ChallengeEntity.STATUS_PROPOSED, "90.00", 6);

        postForBody("/api/proactive/challenge/" + proposed.getId() + "/decision",
                new ChallengeDecisionRequest().decision("dismiss"),
                ownerAuthHeaders(), HttpStatus.OK, ChallengeResponse.class);

        // dismissed rows are excluded from the session/day list (the row still exists ⇒ no lazy re-propose)
        assertThat(getForList(challengeUri(templateSessionId, LocalDate.now()),
                ownerAuthHeaders(), HttpStatus.OK, ChallengeResponse.class))
                .isEmpty();
    }

    @Test
    void testDecide_shouldReturn404_whenForeignOrMissing() {
        postForBody("/api/proactive/challenge/" + UUID.randomUUID() + "/decision",
                new ChallengeDecisionRequest().decision("accept"),
                ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
    }

    @Test
    void testDecide_shouldReturn400_whenDecisionInvalid() {
        Plan plan = plantTemplate(ownerId());
        ChallengeEntity proposed = challengePopulator.challengePr(ownerId(), plan.session().getId(), LocalDate.now(),
                plan.exercise().getId(), ChallengeEntity.STATUS_PROPOSED, "90.00", 6);

        String body = postForBody("/api/proactive/challenge/" + proposed.getId() + "/decision",
                new ChallengeDecisionRequest().decision("nope"),
                ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);

        assertThat(body).contains("decision");
    }

    @Test
    void testGetChallenges_shouldReturn401_whenNoToken() {
        getForBody(challengeUri(UUID.randomUUID(), LocalDate.now()), null, HttpStatus.UNAUTHORIZED, String.class);
    }
}
