package io.mrkuhne.mezo.feature.character.edition;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.character.entity.EditionRef;
import io.mrkuhne.mezo.feature.character.entity.TeamChatThreadEntity;
import io.mrkuhne.mezo.feature.character.repository.TeamChatThreadRepository;
import io.mrkuhne.mezo.feature.character.service.edition.EditionCandidate;
import io.mrkuhne.mezo.feature.character.service.edition.EditionCandidateCollector;
import io.mrkuhne.mezo.feature.character.service.edition.EditionGenre;
import io.mrkuhne.mezo.feature.character.service.edition.TeamCharacter;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagCatalog;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * Csapatfal Act III Task 15 (mezo-a9bo7.25): the evening edition's {@code team_chat_day} candidate,
 * over the real team chat tables. The switched-off half lives in {@code TeamChatSwitchOffIT} (its
 * context already has {@code mezo.feature.team-chat.enabled=false}).
 */
@ActiveProfiles("companion-fake")
class EditionCandidateCollectorIT extends ApiIntegrationTest {

    static final LocalDate DAY = LocalDate.of(2026, 9, 20);
    private static final ZoneId ZONE = ZoneId.of("Europe/Budapest");

    @Autowired private EditionCandidateCollector collector;
    @Autowired private TeamChatThreadRepository threads;
    @Autowired private OwnerProperties ownerProperties;

    private UUID owner;

    @BeforeEach
    void owner() {
        owner = databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    static Instant at(LocalDate day, int hour) {
        return day.atTime(hour, 0).atZone(ZONE).toInstant();
    }

    static TeamChatThreadEntity thread(UUID owner, String flagKey, String status, Instant openedAt, Instant closedAt) {
        TeamChatThreadEntity t = new TeamChatThreadEntity();
        t.setCreatedBy(owner);
        t.setFlagKey(flagKey);
        t.setOwnerCharacter("szunya");
        t.setStatus(status);
        t.setOpenedAt(openedAt);
        t.setClosedAt(closedAt);
        return t;
    }

    private List<EditionCandidate> teamChatCandidates(LocalDate day) {
        return collector.collect(owner, day, null).stream()
                .filter(c -> "team_chat_day".equals(c.sourceKind()))
                .toList();
    }

    @Test
    void dayWithTwoThreads_oneResolved_yieldsOneRecapCandidate() {
        threads.saveAndFlush(thread(owner, FlagKey.SLEEP_DEBT, "RESOLVED", at(DAY, 8), at(DAY, 15)));
        threads.saveAndFlush(thread(owner, FlagKey.ACUTE_BAD_DAY, "OPEN", at(DAY, 10), null));
        // noise: another day's ügy, never touched on DAY
        threads.saveAndFlush(thread(owner, FlagKey.JOINT_OVERUSE, "RESOLVED",
                at(DAY.minusDays(3), 9), at(DAY.minusDays(2), 9)));

        List<EditionCandidate> out = teamChatCandidates(DAY);

        assertThat(out).hasSize(1);
        EditionCandidate c = out.get(0);
        assertThat(c.character()).isEqualTo(TeamCharacter.MEZO);
        assertThat(c.genre()).isEqualTo(EditionGenre.ERTEKELES);
        assertThat(c.sourceId()).isEqualTo("2026-09-20");
        assertThat(c.sourceRoute()).isEqualTo("/mezo/elo?d=2026-09-20");
        assertThat(c.refs()).containsExactly(new EditionRef("team_chat_day", "2026-09-20"));
        assertThat(c.facts()).containsExactly("2", "1", "1");
        assertThat(c.recordText()).isEqualTo("Ma 2 ügyön dolgoztunk: "
                + FlagCatalog.labelOf(FlagKey.SLEEP_DEBT) + ", " + FlagCatalog.labelOf(FlagKey.ACUTE_BAD_DAY)
                + ". 1 rendeződött, 1 nyitva maradt.");
        assertThat(c.changedAt()).isEqualTo(at(DAY, 15));
    }

    @Test
    void threadOpenedEarlierButResolvedToday_counts() {
        threads.saveAndFlush(thread(owner, FlagKey.SLEEP_DEBT, "RESOLVED", at(DAY.minusDays(2), 9), at(DAY, 11)));

        List<EditionCandidate> out = teamChatCandidates(DAY);

        assertThat(out).singleElement().satisfies(c -> assertThat(c.facts()).containsExactly("1", "1", "0"));
    }

    @Test
    void threadWhoseOnlyTouchIsExpiry_doesNotCount() {
        threads.saveAndFlush(thread(owner, FlagKey.SLEEP_DEBT, "RESOLVED", at(DAY, 8), at(DAY, 15)));
        threads.saveAndFlush(thread(owner, FlagKey.JOINT_OVERUSE, "EXPIRED", at(DAY.minusDays(7), 9), at(DAY, 4)));

        List<EditionCandidate> out = teamChatCandidates(DAY);

        assertThat(out).singleElement().satisfies(c -> {
            assertThat(c.facts()).containsExactly("1", "1", "0");
            assertThat(c.recordText()).doesNotContain(FlagCatalog.labelOf(FlagKey.JOINT_OVERUSE));
        });
    }

    @Test
    void expiryAloneOnTheDay_yieldsNothing() {
        threads.saveAndFlush(thread(owner, FlagKey.JOINT_OVERUSE, "EXPIRED", at(DAY.minusDays(7), 9), at(DAY, 4)));

        assertThat(teamChatCandidates(DAY)).isEmpty();
    }

    @Test
    void invariantBroken_nNotEqualROPlusO_skipsTheCandidate() {
        // opened on DAY but already EXPIRED: counted in n, yet neither resolved nor open → n != r + o
        threads.saveAndFlush(thread(owner, FlagKey.SLEEP_DEBT, "RESOLVED", at(DAY, 8), at(DAY, 15)));
        threads.saveAndFlush(thread(owner, FlagKey.ACUTE_BAD_DAY, "EXPIRED", at(DAY, 9), at(DAY, 20)));

        assertThat(teamChatCandidates(DAY)).isEmpty();
    }

    @Test
    void dayWithoutThreads_yieldsNothing() {
        threads.saveAndFlush(thread(owner, FlagKey.SLEEP_DEBT, "OPEN", at(DAY.minusDays(1), 9), null));

        assertThat(teamChatCandidates(DAY)).isEmpty();
    }
}
