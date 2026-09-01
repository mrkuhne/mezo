package io.mrkuhne.mezo.feature.proactive;

import io.mrkuhne.mezo.api.dto.MemoirArchiveResponse;
import io.mrkuhne.mezo.api.dto.MemoirResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.proactive.service.ProactiveMemoirService;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.MemoirPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

import static org.assertj.core.api.Assertions.assertThat;

/** F7.5 (mezo-d20.8.5): the memoir archive shelf — list read, ordering, ownership, honest empty. */
class ProactiveMemoirArchiveIT extends ApiIntegrationTest {

    private static final String ARCHIVE_URI = "/api/proactive/memoir/archive";

    @Autowired private MemoirPopulator memoirPopulator;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private ProactiveMemoirService memoirService;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    @Test
    void testGetMemoirArchive_shouldReturn401_whenNoToken() {
        getForBody(ARCHIVE_URI, null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testGetMemoirArchive_shouldListOwnedNewestWeekFirst_whenMemoirsExist() {
        UUID owner = ownerId();
        UUID stranger = databasePopulator.populateUser("memoir-stranger@test.local");
        LocalDate older = LocalDate.of(2026, 8, 10);
        LocalDate newer = LocalDate.of(2026, 8, 24);
        memoirPopulator.memoir(owner, older);
        memoirPopulator.memoir(owner, newer);
        memoirPopulator.memoir(stranger, LocalDate.of(2026, 8, 17));

        MemoirArchiveResponse archive = getForBody(
                ARCHIVE_URI, ownerAuthHeaders(), HttpStatus.OK, MemoirArchiveResponse.class);

        // desc by weekStart, and only the owner's rows — the stranger's week never appears
        assertThat(archive.getEntries())
                .extracting(MemoirResponse::getWeekStart)
                .containsSubsequence(newer, older)
                .doesNotContain(LocalDate.of(2026, 8, 17));
        assertThat(archive.getEntries())
                .filteredOn(e -> e.getWeekStart().equals(newer))
                .singleElement()
                .satisfies(e -> {
                    assertThat(e.getId()).isNotNull();
                    assertThat(e.getBody()).isNotBlank();
                    assertThat(e.getAnchors()).isNotEmpty();
                });
    }

    @Test
    void testArchive_shouldReturnEmptyList_whenUserHasNoMemoirs() {
        // service-level: a fresh user has no rows and the archive NEVER lazily generates
        UUID fresh = databasePopulator.populateUser("memoir-empty@test.local");

        assertThat(memoirService.archive(fresh).getEntries()).isEmpty();
    }
}
