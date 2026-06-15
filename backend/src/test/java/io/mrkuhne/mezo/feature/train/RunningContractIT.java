package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.RpeTarget;
import io.mrkuhne.mezo.api.dto.RunPrescribedSession;
import io.mrkuhne.mezo.api.dto.RunSegment;
import io.mrkuhne.mezo.api.dto.RunSessionLogRequest;
import io.mrkuhne.mezo.api.dto.RunSessionLogResponse;
import io.mrkuhne.mezo.api.dto.RunWeek;
import io.mrkuhne.mezo.api.dto.RunningBlockResponse;
import io.mrkuhne.mezo.api.dto.RunningBlockStructureDto;
import io.mrkuhne.mezo.api.dto.RunningBlockUpsertRequest;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

/** HTTP round-trips through the GENERATED Running ("Futás") contract interface (api/openapi.yml). */
class RunningContractIT extends ApiIntegrationTest {

    private static final String BLOCKS = "/api/train/running-blocks";
    private static final String SESSIONS = "/api/train/run-sessions";

    // ---- helpers ----------------------------------------------------------------

    /** One week, one sprint session with a couple of segments — DTO mirror of RunningPopulator.sampleStructure(). */
    private static RunningBlockStructureDto sampleStructure() {
        RunPrescribedSession sprint = RunPrescribedSession.builder()
            .key("tue-sprint").dayOfWeek(1).timeOfDay("18:00").label("Sprint-intervallum").kind("sprint")
            .rpeTarget(RpeTarget.builder().min(9).max(10).build()).rounds(6)
            .segments(List.of(
                RunSegment.builder().type("warmup").durationSec(300).build(),
                RunSegment.builder().type("work").durationSec(15).build(),
                RunSegment.builder().type("rest").durationSec(45).build(),
                RunSegment.builder().type("cooldown").durationSec(300).build()))
            .build();
        RunWeek w3 = RunWeek.builder()
            .weekNumber(3).phaseLabel("Alapozás").sessions(List.of(sprint)).build();
        return RunningBlockStructureDto.builder().weeks(List.of(w3)).build();
    }

    private static RunningBlockUpsertRequest sampleUpsert(String title) {
        return RunningBlockUpsertRequest.builder()
            .title(title)
            .goal("Sub-25 5k")
            .kind("interval")
            .startDate(LocalDate.parse("2026-06-16"))
            .endDate(LocalDate.parse("2026-08-11"))
            .weeks(8)
            .currentWeek(3)
            .summary("8 hetes intervallumblokk")
            .structure(sampleStructure())
            .build();
    }

    private static RunSessionLogRequest sampleLog(UUID blockId) {
        return RunSessionLogRequest.builder()
            .blockId(blockId)
            .weekNumber(3)
            .sessionKey("tue-sprint")
            .date(LocalDate.parse("2026-06-30"))
            .completedRounds(6)
            .rpeActual(9)
            .hrRecoverySec(40)
            .sprintLandmark("Híd")
            .durationMin(35)
            .notes("Jól ment")
            .build();
    }

    private RunningBlockResponse createBlock(String title, HttpHeaders auth) {
        return postForBody(BLOCKS, sampleUpsert(title), auth, HttpStatus.CREATED, RunningBlockResponse.class);
    }

    /** An 8-week block starting on {@code start}, carrying a deliberately-wrong currentWeek(5) the server must ignore. */
    private static RunningBlockUpsertRequest upsertStarting(LocalDate start) {
        return RunningBlockUpsertRequest.builder()
            .title("Futás derive").goal("").kind("interval")
            .startDate(start).endDate(start.plusWeeks(8))
            .weeks(8).currentWeek(5)
            .summary(null).structure(sampleStructure())
            .build();
    }

    // ---- list -------------------------------------------------------------------

    @Test
    void testListRunningBlocks_shouldReturnEmpty_whenNoneCreated() {
        List<RunningBlockResponse> blocks =
            getForList(BLOCKS, ownerAuthHeaders(), HttpStatus.OK, RunningBlockResponse.class);
        assertThat(blocks).isEmpty();
    }

    // ---- create -----------------------------------------------------------------

    @Test
    void testCreateRunningBlock_shouldPersistAsPlanned_whenValid() {
        HttpHeaders auth = ownerAuthHeaders();

        RunningBlockResponse created = createBlock("Futás A", auth);

        assertThat(created.getId()).isNotNull();
        assertThat(created.getTitle()).isEqualTo("Futás A");
        assertThat(created.getStatus()).isEqualTo(RunningBlockResponse.StatusEnum.PLANNED);
        // structure round-trips through jsonb
        assertThat(created.getStructure()).isNotNull();
        assertThat(created.getStructure().getWeeks()).hasSize(1);
        assertThat(created.getStructure().getWeeks().get(0).getSessions()).singleElement()
            .satisfies(s -> {
                assertThat(s.getKey()).isEqualTo("tue-sprint");
                assertThat(s.getTimeOfDay()).isEqualTo("18:00");
                assertThat(s.getRpeTarget().getMin()).isEqualTo(9);
                assertThat(s.getSegments()).hasSize(4);
            });

        List<RunningBlockResponse> blocks =
            getForList(BLOCKS, auth, HttpStatus.OK, RunningBlockResponse.class);
        assertThat(blocks).extracting(RunningBlockResponse::getId).containsExactly(created.getId());
    }

    @Test
    void testCreateRunningBlock_shouldForcePlanned_whenClientOmitsOrSends() {
        // The upsert request carries no status field — the server always forces "planned".
        RunningBlockResponse created = createBlock("Futás kényszerített", ownerAuthHeaders());
        assertThat(created.getStatus()).isEqualTo(RunningBlockResponse.StatusEnum.PLANNED);
    }

    @Test
    void testCreateRunningBlock_shouldDeriveCurrentWeekFromStartDate_ignoringClientValue() {
        HttpHeaders auth = ownerAuthHeaders();

        // A plan starting today is on week 1 — the bogus client currentWeek (5) is ignored.
        // Regression for mezo-478: a "mától induló" block used to persist currentWeek 0, which then
        // rendered "az aktuális hét (0) nincs a tervben" because weeks are 1-indexed.
        RunningBlockResponse today = postForBody(BLOCKS, upsertStarting(LocalDate.now()),
            auth, HttpStatus.CREATED, RunningBlockResponse.class);
        assertThat(today.getCurrentWeek()).isEqualTo(1);

        // A plan that started two weeks ago is on week 3.
        RunningBlockResponse twoWeeksIn = postForBody(BLOCKS, upsertStarting(LocalDate.now().minusWeeks(2)),
            auth, HttpStatus.CREATED, RunningBlockResponse.class);
        assertThat(twoWeeksIn.getCurrentWeek()).isEqualTo(3);
    }

    // ---- activate ---------------------------------------------------------------

    @Test
    void testActivateRunningBlock_shouldArchiveOtherActive_whenSecondActivated() {
        HttpHeaders auth = ownerAuthHeaders();
        RunningBlockResponse a = createBlock("Futás A", auth);
        RunningBlockResponse b = createBlock("Futás B", auth);

        postForBody(BLOCKS + "/" + a.getId() + "/activate", null, auth, HttpStatus.OK, RunningBlockResponse.class);
        postForBody(BLOCKS + "/" + b.getId() + "/activate", null, auth, HttpStatus.OK, RunningBlockResponse.class);

        List<RunningBlockResponse> blocks =
            getForList(BLOCKS, auth, HttpStatus.OK, RunningBlockResponse.class);
        assertThat(blocks).filteredOn(x -> x.getId().equals(b.getId())).singleElement()
            .satisfies(x -> assertThat(x.getStatus()).isEqualTo(RunningBlockResponse.StatusEnum.ACTIVE));
        assertThat(blocks).filteredOn(x -> x.getId().equals(a.getId())).singleElement()
            .satisfies(x -> assertThat(x.getStatus()).isEqualTo(RunningBlockResponse.StatusEnum.ARCHIVED));
        assertThat(blocks).filteredOn(x -> x.getStatus() == RunningBlockResponse.StatusEnum.ACTIVE).hasSize(1);
    }

    // ---- update -----------------------------------------------------------------

    @Test
    void testUpdateRunningBlock_shouldReplaceFields_whenPut() {
        HttpHeaders auth = ownerAuthHeaders();
        RunningBlockResponse created = createBlock("Futás eredeti", auth);

        RunningBlockUpsertRequest changed = sampleUpsert("Futás módosított");
        changed.setWeeks(10);
        // PUT fully replaces the jsonb structure — use a distinct phaseLabel + session key.
        RunPrescribedSession tempo = RunPrescribedSession.builder()
            .key("thu-tempo").dayOfWeek(3).label("Tempófutás").kind("tempo")
            .rpeTarget(RpeTarget.builder().min(6).max(7).build()).rounds(1)
            .segments(List.of(RunSegment.builder().type("work").durationSec(1200).build()))
            .build();
        changed.setStructure(RunningBlockStructureDto.builder()
            .weeks(List.of(RunWeek.builder()
                .weekNumber(5).phaseLabel("Csúcsformázás").sessions(List.of(tempo)).build()))
            .build());

        RunningBlockResponse updated = putForBody(BLOCKS + "/" + created.getId(), changed,
            auth, HttpStatus.OK, RunningBlockResponse.class);

        assertThat(updated.getId()).isEqualTo(created.getId());
        assertThat(updated.getTitle()).isEqualTo("Futás módosított");
        assertThat(updated.getWeeks()).isEqualTo(10);
        // The replaced structure is reflected back (jsonb round-trip), not the created one.
        assertThat(updated.getStructure().getWeeks()).singleElement().satisfies(w -> {
            assertThat(w.getPhaseLabel()).isEqualTo("Csúcsformázás");
            assertThat(w.getSessions()).singleElement()
                .satisfies(s -> assertThat(s.getKey()).isEqualTo("thu-tempo"));
        });
    }

    // ---- close ------------------------------------------------------------------

    @Test
    void testCloseRunningBlock_shouldArchive_whenClosed() {
        HttpHeaders auth = ownerAuthHeaders();
        RunningBlockResponse created = createBlock("Futás lezárandó", auth);

        postForBody(BLOCKS + "/" + created.getId() + "/activate", null, auth, HttpStatus.OK, RunningBlockResponse.class);
        RunningBlockResponse closed = postForBody(BLOCKS + "/" + created.getId() + "/close",
            null, auth, HttpStatus.OK, RunningBlockResponse.class);

        assertThat(closed.getStatus()).isEqualTo(RunningBlockResponse.StatusEnum.ARCHIVED);
    }

    // ---- delete -----------------------------------------------------------------

    @Test
    void testDeleteRunningBlock_shouldSoftDelete_whenDeleted() {
        HttpHeaders auth = ownerAuthHeaders();
        RunningBlockResponse created = createBlock("Futás törlendő", auth);

        deleteAndExpect(BLOCKS + "/" + created.getId(), auth, HttpStatus.NO_CONTENT);

        List<RunningBlockResponse> blocks =
            getForList(BLOCKS, auth, HttpStatus.OK, RunningBlockResponse.class);
        assertThat(blocks).extracting(RunningBlockResponse::getId).doesNotContain(created.getId());
    }

    // ---- run-session log --------------------------------------------------------

    @Test
    void testLogRunSession_shouldPersist_whenBlockOwned() {
        HttpHeaders auth = ownerAuthHeaders();
        RunningBlockResponse block = createBlock("Futás naplózáshoz", auth);

        RunSessionLogResponse logged = postForBody(SESSIONS, sampleLog(block.getId()),
            auth, HttpStatus.CREATED, RunSessionLogResponse.class);

        assertThat(logged.getId()).isNotNull();
        assertThat(logged.getBlockId()).isEqualTo(block.getId());
        assertThat(logged.getRpeActual()).isEqualTo(9);

        List<RunSessionLogResponse> sessions =
            getForList(SESSIONS, auth, HttpStatus.OK, RunSessionLogResponse.class);
        assertThat(sessions).extracting(RunSessionLogResponse::getId).containsExactly(logged.getId());
    }

    // ---- 401 --------------------------------------------------------------------

    @Test
    void testListRunningBlocks_shouldReturn401_whenNoToken() {
        // Security-layer 401s are produced by Spring Security's BearerTokenAuthenticationEntryPoint
        // BEFORE the dispatcher, so they carry no SystemMessage body by design — status-only is correct.
        getForBody(BLOCKS, null, HttpStatus.UNAUTHORIZED, Void.class);
    }
}
