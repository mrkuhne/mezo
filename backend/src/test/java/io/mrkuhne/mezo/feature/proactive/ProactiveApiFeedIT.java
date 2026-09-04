package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.FeedMessageResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.proactive.entity.AdviceActionKey;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEnvelope;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.CompanionMessagePopulator;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * HTTP-level companion-feed flow (unified {@code GET /api/proactive/feed}): the persisted-row
 * read plus the cron-kind miss-recovery (morning always; midday/evening once elapsed).
 * Midday/evening crons are overridden to midnight (HeartbeatLazyIT's technique, reused verbatim)
 * so BOTH windows have always fired for today by the time the suite runs (except the midnight
 * minute itself — the accepted micro-flake window the suite never runs in).
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = {
        "mezo.proactive.feed.midday-cron=0 0 0 * * *",
        "mezo.proactive.feed.evening-cron=0 1 0 * * *"})
class ProactiveApiFeedIT extends ApiIntegrationTest {

    @Autowired private DailySummaryPopulator dailySummaryPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private CompanionMessagePopulator companionMessagePopulator;
    @Autowired private CompanionMessageRepository companionMessageRepository;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    @Test
    void testGetFeed_shouldReturnEmptyList_whenNoMessagesAndNoNarrativeMemory() {
        List<FeedMessageResponse> feed = getForList(
                "/api/proactive/feed", ownerAuthHeaders(), HttpStatus.OK, FeedMessageResponse.class);

        assertThat(feed).isEmpty();
    }

    @Test
    void testGetFeed_shouldReturnMessagesInGeneratedOrder_whenRowsExist() {
        // no daily summaries planted -> the elapsed-window miss-recovery is a no-op (honest null),
        // so only the two pre-populated rows come back, in insertion (generatedAt) order
        CompanionMessageEntity morningRow = companionMessagePopulator.createMessage(ownerId(), LocalDate.now(),
                CompanionMessageEntity.KIND_MORNING, "Jó reggelt", List.of("Mai terv."));
        CompanionMessageEntity sleepRow = companionMessagePopulator.createMessage(ownerId(), LocalDate.now(),
                CompanionMessageEntity.KIND_SLEEP, "Jó alvás", List.of("Pihenten kelsz."));

        List<FeedMessageResponse> feed = getForList(
                "/api/proactive/feed", ownerAuthHeaders(), HttpStatus.OK, FeedMessageResponse.class);

        assertThat(feed).extracting(FeedMessageResponse::getKind)
                .containsExactly(FeedMessageResponse.KindEnum.MORNING, FeedMessageResponse.KindEnum.SLEEP);
        assertThat(feed.get(0).getDate()).isEqualTo(LocalDate.now());
        assertThat(feed.get(0).getEyebrow()).isEqualTo("Jó reggelt");
        assertThat(feed.get(0).getBody()).containsExactly("Mai terv.");
        assertThat(feed.get(0).getRefs()).isEmpty();
        assertThat(feed.get(0).getGeneratedAt()).isNotNull();
        assertThat(feed.get(0).getId()).isEqualTo(morningRow.getId());
        assertThat(feed.get(1).getEyebrow()).isEqualTo("Jó alvás");
        assertThat(feed.get(1).getBody()).containsExactly("Pihenten kelsz.");
        assertThat(feed.get(1).getId()).isEqualTo(sleepRow.getId());
    }

    @Test
    void testGetFeed_shouldStillServeExistingMessages_whenLazyGenerationThrows() {
        // The realistic case is a lost insert race against the cron; [fake-fail] reproduces the
        // shape (generation blows up mid-read) without one. The already-written message must
        // still reach the reader — and it only can if the generate ran in its OWN transaction.
        dailySummaryPopulator.summary(ownerId(), LocalDate.now().minusDays(1), "Tegnap pihenőnap volt.");
        checkInPopulator.createCheckIn(ownerId(), LocalDate.now(), "06:30", 4, 2, "[fake-fail]");
        CompanionMessageEntity sleepRow = companionMessagePopulator.createMessage(ownerId(), LocalDate.now(),
                CompanionMessageEntity.KIND_SLEEP, "Jó alvás", List.of("Pihenten kelsz."));

        List<FeedMessageResponse> feed = getForList(
                "/api/proactive/feed", ownerAuthHeaders(), HttpStatus.OK, FeedMessageResponse.class);

        assertThat(feed).extracting(FeedMessageResponse::getKind)
                .containsExactly(FeedMessageResponse.KindEnum.SLEEP);
        assertThat(feed.get(0).getEyebrow()).isEqualTo("Jó alvás");
        assertThat(feed.get(0).getId()).isEqualTo(sleepRow.getId());
    }

    @Test
    void testGetFeed_shouldLazilyGenerateMorning_whenTodayAndMissing() {
        dailySummaryPopulator.summary(ownerId(), LocalDate.now().minusDays(1), "Tegnap pihenőnap volt.");
        checkInPopulator.createCheckIn(ownerId(), LocalDate.now(), "06:30", 4, 2,
                "[fake-feed-morning:{\"eyebrow\":\"Jó reggelt\",\"body\":[\"Mai terv.\"],\"refIndexes\":[]}]");

        List<FeedMessageResponse> feed = getForList(
                "/api/proactive/feed", ownerAuthHeaders(), HttpStatus.OK, FeedMessageResponse.class);

        FeedMessageResponse morning = feed.stream()
                .filter(m -> FeedMessageResponse.KindEnum.MORNING.equals(m.getKind()))
                .findFirst().orElseThrow(() -> new AssertionError("no morning message in feed: " + feed));
        assertThat(morning.getEyebrow()).isEqualTo("Jó reggelt");
        assertThat(morning.getBody()).containsExactly("Mai terv.");
        assertThat(morning.getDate()).isEqualTo(LocalDate.now());
        assertThat(morning.getGeneratedAt()).isNotNull();
        // lazily generated inside the endpoint — no populated row to pin identity against
        assertThat(morning.getId()).isNotNull();
    }

    @Test
    void testGetFeed_shouldLazilyGenerateElapsedWindows_whenTodayAfterMidday() {
        // narrative memory present -> morning ALSO lazily generates (its own gate is the same
        // window) alongside both cron windows, since midday/evening cron always "elapsed" here
        dailySummaryPopulator.summary(ownerId(), LocalDate.now().minusDays(1), "Tegnap pihenőnap volt.");

        List<FeedMessageResponse> feed = getForList(
                "/api/proactive/feed", ownerAuthHeaders(), HttpStatus.OK, FeedMessageResponse.class);

        assertThat(feed).extracting(FeedMessageResponse::getKind)
                .contains(FeedMessageResponse.KindEnum.MIDDAY, FeedMessageResponse.KindEnum.EVENING);
        // all rows here are lazily generated inside the endpoint — no populated row to pin
        // identity against, so only assert every row's id came back non-null
        assertThat(feed).extracting(FeedMessageResponse::getId).doesNotContainNull();
    }

    @Test
    void testGetFeed_shouldExposeTheAdviceCardsFactsAndSuggestions() {
        companionMessagePopulator.createAdvice(ownerId(), LocalDate.now(), "sleep_debt",
                "sleep_recover_tonight", "Mezo · észrevétel", "kártya szöveg",
                List.of("Alvásadósság: 1,6 óra/éjszaka"), List.of("Told előre a villanyoltást."),
                Instant.now());

        List<FeedMessageResponse> feed = getForList(
                "/api/proactive/feed", ownerAuthHeaders(), HttpStatus.OK, FeedMessageResponse.class);

        assertThat(feed).hasSize(1);
        assertThat(feed.get(0).getKind()).isEqualTo(FeedMessageResponse.KindEnum.ADVICE);
        assertThat(feed.get(0).getFacts()).containsExactly("Alvásadósság: 1,6 óra/éjszaka");
        assertThat(feed.get(0).getSuggestions()).containsExactly("Told előre a villanyoltást.");
    }

    @Test
    void testGetFeed_shouldExposeTheAdviceCardsActions() {
        companionMessagePopulator.createAdviceWithActions(ownerId(), LocalDate.now(), "sleep_debt",
                "sleep_recover_tonight", "Mezo · észrevétel", "kártya szöveg",
                List.of("tény"), List.of("javaslat"),
                List.of(new CompanionMessageEnvelope.Action(
                        AdviceActionKey.SHIFT_SLEEP_ANCHOR, "Horgony −30 perc", Map.of("minutes", -30))),
                null, Instant.now());

        List<FeedMessageResponse> feed = getForList(
                "/api/proactive/feed", ownerAuthHeaders(), HttpStatus.OK, FeedMessageResponse.class);

        assertThat(feed).hasSize(1);
        assertThat(feed.get(0).getActions()).hasSize(1);
        assertThat(feed.get(0).getActions().get(0).getKey().getValue())
                .isEqualTo(AdviceActionKey.SHIFT_SLEEP_ANCHOR);
        assertThat(feed.get(0).getActions().get(0).getLabel()).isEqualTo("Horgony −30 perc");
        assertThat(feed.get(0).getApplied()).isNull();
    }

    @Test
    void testGetFeed_shouldNotGenerate_whenPastDate() {
        // deliberately plant everything morning-generation needs FOR the past date (a daily
        // summary inside its pastDays window + a working [fake-feed-morning:…] sentinel) so
        // that WITHOUT the today-only guard, a row would visibly be generated — proving the
        // 200 [] comes from the guard, not merely from missing ingredients
        LocalDate pastDate = LocalDate.now().minusDays(1);
        dailySummaryPopulator.summary(ownerId(), pastDate.minusDays(1), "Tegnap pihenőnap volt.");
        checkInPopulator.createCheckIn(ownerId(), pastDate, "06:30", 4, 2,
                "[fake-feed-morning:{\"eyebrow\":\"Jó reggelt\",\"body\":[\"Mai terv.\"],\"refIndexes\":[]}]");

        List<FeedMessageResponse> feed = getForList(
                "/api/proactive/feed?date=" + pastDate,
                ownerAuthHeaders(), HttpStatus.OK, FeedMessageResponse.class);

        assertThat(feed).isEmpty();
        assertThat(companionMessageRepository
                .findByCreatedByAndMessageDateOrderByGeneratedAtAsc(ownerId(), pastDate))
                .isEmpty();
    }
}
