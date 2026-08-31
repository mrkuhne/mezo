package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.CharacterConferenceSummary;
import io.mrkuhne.mezo.api.dto.CharacterDimensionResponse;
import io.mrkuhne.mezo.api.dto.CharacterDimensionSummary;
import io.mrkuhne.mezo.api.dto.CharacterExpertDto;
import io.mrkuhne.mezo.api.dto.CharacterExpertsResponse;
import io.mrkuhne.mezo.api.dto.CharacterFeedItem;
import io.mrkuhne.mezo.api.dto.CharacterOverviewResponse;
import io.mrkuhne.mezo.api.dto.CharacterRunResponse;
import io.mrkuhne.mezo.api.dto.CharacterRunSummary;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.character.entity.CharacterConferenceEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterObservationEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterRunEntity;
import io.mrkuhne.mezo.feature.character.entity.ConferenceOutcomeEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ConferenceTranscriptEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ObservationDimensionKeysEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ObservationSignalsEnvelope;
import io.mrkuhne.mezo.feature.character.entity.RunDetectorKeysEnvelope;
import io.mrkuhne.mezo.feature.character.entity.RunExpertKeysEnvelope;
import io.mrkuhne.mezo.feature.character.repository.CharacterConferenceRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterObservationRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterRunRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

class CharacterApiIT extends ApiIntegrationTest {

    @Autowired
    private CharacterObservationRepository observationRepository;

    @Autowired
    private CharacterConferenceRepository conferenceRepository;

    @Autowired
    private CharacterRunRepository runRepository;

    @Autowired
    private DatabasePopulator databasePopulator;

    @Autowired
    private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void overview_firstRead_lazilySeedsTheSevenCoreDimensions_emptyPortraits() {
        CharacterOverviewResponse res = getForBody("/api/character", ownerAuthHeaders(),
                HttpStatus.OK, CharacterOverviewResponse.class);
        assertThat(res.getDimensions()).hasSize(7);
        assertThat(res.getDimensions()).extracting(CharacterDimensionSummary::getKey)
                .containsExactly("physical", "athletic", "nutrition", "recovery",
                        "mental", "discipline", "life");
        assertThat(res.getDimensions()).allSatisfy(d -> {
            assertThat(d.getKind()).isEqualTo(CharacterDimensionSummary.KindEnum.CORE);
            assertThat(d.getMaturity()).isZero();
            assertThat(d.getPortrait()).isEmpty();
            assertThat(d.getTopClaims()).isEmpty();
        });
        // second read: still exactly 7 (idempotent seeding)
        CharacterOverviewResponse again = getForBody("/api/character", ownerAuthHeaders(),
                HttpStatus.OK, CharacterOverviewResponse.class);
        assertThat(again.getDimensions()).hasSize(7);
    }

    @Test
    void dimension_knownKey_returnsIt_unknownKeyIs404() {
        getForBody("/api/character", ownerAuthHeaders(), HttpStatus.OK, CharacterOverviewResponse.class);
        CharacterDimensionResponse d = getForBody("/api/character/dimension/discipline",
                ownerAuthHeaders(), HttpStatus.OK, CharacterDimensionResponse.class);
        assertThat(d.getTitle()).isEqualTo("Motiváció & fegyelem");
        assertThat(d.getExpertKey()).isEqualTo("drill");
        assertThat(d.getClaims()).isEmpty();
        assertThat(d.getRevisions()).isEmpty();
        String body = getForBody("/api/character/dimension/nonsense", ownerAuthHeaders(),
                HttpStatus.NOT_FOUND, String.class);
        assertHasRequestError(body, "CHARACTER_DIMENSION_NOT_FOUND");
    }

    @Test
    void feedAndConferences_emptyDossier_honestEmptyArrays() {
        assertThat(getForBody("/api/character/feed", ownerAuthHeaders(),
                HttpStatus.OK, CharacterFeedItem[].class)).isEmpty();
        assertThat(getForBody("/api/character/conference", ownerAuthHeaders(),
                HttpStatus.OK, CharacterConferenceSummary[].class)).isEmpty();
        String body = getForBody("/api/character/conference/" + UUID.randomUUID(), ownerAuthHeaders(),
                HttpStatus.NOT_FOUND, String.class);
        assertHasRequestError(body, "CHARACTER_CONFERENCE_NOT_FOUND");
    }

    @Test
    void feed_withSeededObservationAndConference_mergesNewestFirst() {
        UUID owner = ownerId();

        CharacterObservationEntity obs = new CharacterObservationEntity();
        obs.setCreatedBy(owner);
        obs.setExpertKey("drill");
        obs.setDimensionKeys(new ObservationDimensionKeysEnvelope(List.of("discipline")));
        obs.setDay(LocalDate.now().minusDays(1));
        obs.setText("Tegnap sem került be edzésnapló.");
        obs.setSalience((short) 3);
        obs.setSignals(new ObservationSignalsEnvelope(List.of(
                new ObservationSignalsEnvelope.Signal("logging-gap", "1 nap", List.of()))));
        observationRepository.save(obs);

        CharacterConferenceEntity conf = new CharacterConferenceEntity();
        conf.setCreatedBy(owner);
        conf.setKind("WEEKLY");
        conf.setTranscript(new ConferenceTranscriptEnvelope(List.of()));
        conf.setOutcome(new ConferenceOutcomeEnvelope(List.of(
                new ConferenceOutcomeEnvelope.Change(
                        "CLAIM_ACCEPTED", "discipline", null, "Új megfigyelés a fegyelemről."))));
        conf.setGeneratedAt(Instant.now());
        conferenceRepository.save(conf);

        CharacterFeedItem[] itemsArray = getForBody("/api/character/feed", ownerAuthHeaders(),
                HttpStatus.OK, CharacterFeedItem[].class);
        List<CharacterFeedItem> items = List.of(itemsArray);

        assertThat(items).hasSize(2);
        CharacterFeedItem first = items.get(0);
        CharacterFeedItem second = items.get(1);
        assertThat(first.getKind()).isEqualTo(CharacterFeedItem.KindEnum.CONFERENCE_CHANGE);
        assertThat(first.getText()).isEqualTo("Új megfigyelés a fegyelemről.");
        assertThat(first.getDimensionKeys()).containsExactly("discipline");
        assertThat(second.getKind()).isEqualTo(CharacterFeedItem.KindEnum.OBSERVATION);
        assertThat(second.getExpertKey()).isEqualTo("drill");
        assertThat(second.getText()).isEqualTo("Tegnap sem került be edzésnapló.");
    }

    @Test
    void experts_returnsNineInCatalogOrder_withCsapatCopy() {
        CharacterExpertsResponse res = getForBody("/api/character/experts", ownerAuthHeaders(),
                HttpStatus.OK, CharacterExpertsResponse.class);
        List<CharacterExpertDto> experts = res.getExperts();
        assertThat(experts).hasSize(9);
        assertThat(experts).extracting(CharacterExpertDto::getKey)
                .containsExactly("doki", "edzo", "taplalkozo", "szomnologus",
                        "pszichologus", "drill", "antropologus", "szkeptikus", "mezo");
        assertThat(experts.subList(0, 7)).allSatisfy(e -> {
            assertThat(e.getKind()).isEqualTo(CharacterExpertDto.KindEnum.EXPERT);
            assertThat(e.getDimensionKey()).isNotBlank();
        });
        CharacterExpertDto szkeptikus = experts.get(7);
        assertThat(szkeptikus.getKind()).isEqualTo(CharacterExpertDto.KindEnum.SKEPTIC);
        assertThat(szkeptikus.getDimensionKey()).isNull();
        assertThat(szkeptikus.getDisplayName()).isEqualTo("Szkeptikus");
        assertThat(szkeptikus.getVoiceLine()).isEqualTo("Száraz kontrás hang.");
        CharacterExpertDto mezo = experts.get(8);
        assertThat(mezo.getKind()).isEqualTo(CharacterExpertDto.KindEnum.CHAIR);
        assertThat(mezo.getDimensionKey()).isNull();
        assertThat(mezo.getDisplayName()).isEqualTo("Mezo");
        // spot-checked voiceLine, verbatim from the prototype's CSAPAT array
        CharacterExpertDto doki = experts.get(0);
        assertThat(doki.getVoiceLine()).isEqualTo("Tárgyilagos, orvosi hangon, röviden fogalmaz.");
        assertThat(doki.getWatch()).containsExactly(
                "testkompozíció, egészségjelek", "súlytrend", "gyógyszerciklus jelei");
    }

    private CharacterRunEntity saveRun(UUID owner, String kind, LocalDate day, UUID conferenceId) {
        CharacterRunEntity run = new CharacterRunEntity();
        run.setCreatedBy(owner);
        run.setKind(kind);
        run.setDay(day);
        run.setObservationCount(kind.equals("NIGHTLY") ? 1 : 2);
        run.setCallCount(kind.equals("NIGHTLY") ? 1 : 0);
        run.setDetectorKeys(new RunDetectorKeysEnvelope(List.of("logging-gap")));
        run.setExpertKeys(new RunExpertKeysEnvelope(List.of("drill")));
        run.setConferenceId(conferenceId);
        run.setGeneratedAt(Instant.now());
        return runRepository.save(run);
    }

    @Test
    void runs_rangeQuery_ordersDayDesc_andHonestlyEmptyOutsideIt() {
        UUID owner = ownerId();
        LocalDate day1 = LocalDate.of(2026, 8, 10);
        LocalDate day2 = LocalDate.of(2026, 8, 12);
        saveRun(owner, "NIGHTLY", day1, null);
        saveRun(owner, "WEEKLY", day2, UUID.randomUUID());

        CharacterRunSummary[] runs = getForBody(
                "/api/character/runs?from=2026-08-01&to=2026-08-31",
                ownerAuthHeaders(), HttpStatus.OK, CharacterRunSummary[].class);
        assertThat(runs).hasSize(2);
        assertThat(runs[0].getDay()).isEqualTo(day2);
        assertThat(runs[0].getKind()).isEqualTo(CharacterRunSummary.KindEnum.WEEKLY);
        assertThat(runs[0].getCallCount()).isZero(); // honest only for NIGHTLY
        assertThat(runs[1].getDay()).isEqualTo(day1);
        assertThat(runs[1].getKind()).isEqualTo(CharacterRunSummary.KindEnum.NIGHTLY);
        assertThat(runs[1].getCallCount()).isEqualTo(1);
        assertThat(runs[1].getDetectorKeys()).containsExactly("logging-gap");
        assertThat(runs[1].getExpertKeys()).containsExactly("drill");

        CharacterRunSummary[] outsideWindow = getForBody(
                "/api/character/runs?from=2026-09-01&to=2026-09-30",
                ownerAuthHeaders(), HttpStatus.OK, CharacterRunSummary[].class);
        assertThat(outsideWindow).isEmpty();
    }

    @Test
    void runs_toBeforeFrom_400() {
        String body = getForBody("/api/character/runs?from=2026-08-10&to=2026-08-01",
                ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(body, "CHARACTER_RUN_RANGE_INVALID");
    }

    @Test
    void runs_spanExceeds62Days_400() {
        String body = getForBody("/api/character/runs?from=2026-01-01&to=2026-12-31",
                ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(body, "CHARACTER_RUN_RANGE_INVALID");
    }

    @Test
    void run_nightlyRow_resolvesObservationsByOwnerAndDay() {
        UUID owner = ownerId();
        LocalDate day = LocalDate.of(2026, 8, 10);
        CharacterRunEntity run = saveRun(owner, "NIGHTLY", day, null);

        CharacterObservationEntity obs = new CharacterObservationEntity();
        obs.setCreatedBy(owner);
        obs.setExpertKey("drill");
        obs.setDimensionKeys(new ObservationDimensionKeysEnvelope(List.of("discipline")));
        obs.setDay(day);
        obs.setText("Nincs edzésnapló.");
        obs.setSalience((short) 3);
        obs.setSignals(new ObservationSignalsEnvelope(List.of(
                new ObservationSignalsEnvelope.Signal("logging-gap", "1 nap", List.of(UUID.randomUUID().toString(),
                        UUID.randomUUID().toString())))));
        observationRepository.save(obs);

        // an observation on a different day must not leak in
        CharacterObservationEntity other = new CharacterObservationEntity();
        other.setCreatedBy(owner);
        other.setExpertKey("drill");
        other.setDimensionKeys(new ObservationDimensionKeysEnvelope(List.of("discipline")));
        other.setDay(day.plusDays(1));
        other.setText("Máshol.");
        other.setSalience((short) 3);
        other.setSignals(new ObservationSignalsEnvelope(List.of()));
        observationRepository.save(other);

        CharacterRunResponse res = getForBody("/api/character/run/" + run.getId(),
                ownerAuthHeaders(), HttpStatus.OK, CharacterRunResponse.class);
        assertThat(res.getSummary().getId()).isEqualTo(run.getId());
        assertThat(res.getObservations()).hasSize(1);
        assertThat(res.getObservations().get(0).getText()).isEqualTo("Nincs edzésnapló.");
        assertThat(res.getObservations().get(0).getSignals()).hasSize(1);
        assertThat(res.getObservations().get(0).getSignals().get(0).getDetectorKey()).isEqualTo("logging-gap");
        assertThat(res.getObservations().get(0).getSignals().get(0).getRefCount()).isEqualTo(2);
    }

    // Final review (mezo-1gim.14, M5): a user-feedback observation (expertKey "user", written by
    // CharacterFeedbackService whenever Daniel answers a claim) shares the NIGHTLY run's `day`
    // but was never produced by that night's pipeline — it belongs to the konzílium flow. The
    // resolution must EXCLUDE it, never count or list it as part of the nightly run's output.
    @Test
    void run_nightlyRow_excludesUserFeedbackObservations() {
        UUID owner = ownerId();
        LocalDate day = LocalDate.of(2026, 8, 10);
        CharacterRunEntity run = saveRun(owner, "NIGHTLY", day, null);

        CharacterObservationEntity nightly = new CharacterObservationEntity();
        nightly.setCreatedBy(owner);
        nightly.setExpertKey("drill");
        nightly.setDimensionKeys(new ObservationDimensionKeysEnvelope(List.of("discipline")));
        nightly.setDay(day);
        nightly.setText("Nincs edzésnapló.");
        nightly.setSalience((short) 3);
        nightly.setSignals(new ObservationSignalsEnvelope(List.of()));
        observationRepository.save(nightly);

        CharacterObservationEntity userFeedback = new CharacterObservationEntity();
        userFeedback.setCreatedBy(owner);
        userFeedback.setExpertKey("user");
        userFeedback.setDimensionKeys(new ObservationDimensionKeysEnvelope(List.of("discipline")));
        userFeedback.setDay(day); // same day as the nightly row — the leak this test guards against
        userFeedback.setText("Daniel visszajelzése egy állításra.");
        userFeedback.setSalience((short) 3);
        userFeedback.setSignals(new ObservationSignalsEnvelope(List.of()));
        observationRepository.save(userFeedback);

        CharacterRunResponse res = getForBody("/api/character/run/" + run.getId(),
                ownerAuthHeaders(), HttpStatus.OK, CharacterRunResponse.class);
        assertThat(res.getObservations()).hasSize(1);
        assertThat(res.getObservations().get(0).getText()).isEqualTo("Nincs edzésnapló.");
        assertThat(res.getObservations()).noneMatch(o -> "Daniel visszajelzése egy állításra.".equals(o.getText()));
    }

    @Test
    void run_weeklyRow_resolvesObservationsByConsumedConference() {
        UUID owner = ownerId();
        UUID conferenceId = UUID.randomUUID();
        LocalDate weekStart = LocalDate.of(2026, 8, 10);
        CharacterRunEntity run = saveRun(owner, "WEEKLY", weekStart, conferenceId);

        CharacterObservationEntity consumed = new CharacterObservationEntity();
        consumed.setCreatedBy(owner);
        consumed.setExpertKey("drill");
        consumed.setDimensionKeys(new ObservationDimensionKeysEnvelope(List.of("discipline")));
        consumed.setDay(weekStart.plusDays(1));
        consumed.setText("A hét megfigyelése.");
        consumed.setSalience((short) 3);
        consumed.setSignals(new ObservationSignalsEnvelope(List.of()));
        consumed.setConsumedByConferenceId(conferenceId);
        observationRepository.save(consumed);

        CharacterObservationEntity notConsumed = new CharacterObservationEntity();
        notConsumed.setCreatedBy(owner);
        notConsumed.setExpertKey("drill");
        notConsumed.setDimensionKeys(new ObservationDimensionKeysEnvelope(List.of("discipline")));
        notConsumed.setDay(weekStart.plusDays(2));
        notConsumed.setText("Nem ehhez a konzíliumhoz tartozik.");
        notConsumed.setSalience((short) 3);
        notConsumed.setSignals(new ObservationSignalsEnvelope(List.of()));
        observationRepository.save(notConsumed);

        CharacterRunResponse res = getForBody("/api/character/run/" + run.getId(),
                ownerAuthHeaders(), HttpStatus.OK, CharacterRunResponse.class);
        assertThat(res.getObservations()).hasSize(1);
        assertThat(res.getObservations().get(0).getText()).isEqualTo("A hét megfigyelése.");
    }

    @Test
    void run_unknownOrForeign_404() {
        String body = getForBody("/api/character/run/" + UUID.randomUUID(),
                ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
        assertHasRequestError(body, "CHARACTER_RUN_NOT_FOUND");
    }
}
