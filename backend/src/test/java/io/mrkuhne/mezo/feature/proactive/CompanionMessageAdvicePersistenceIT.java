package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.proactive.entity.AdviceActionKey;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEnvelope;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import io.mrkuhne.mezo.feature.proactive.service.AdviceCandidate;
import io.mrkuhne.mezo.feature.proactive.service.AdviceCardService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CompanionMessagePopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * S4 (bd mezo-d58h.4, spec 2026-09-03 §5): the {@code advice} kind is accepted by
 * {@code ck_companion_message_kind}, and an unknown kind is still rejected — the CHECK is pinned
 * from the DB side (native insert), not merely from the entity's annotations.
 *
 * <p>Plus the envelope's {@code suggestions} CONTRACT (mezo-wtl0), pinned through the real
 * delivery path rather than the populator: which candidates get a suggestion list written into
 * their row at all, and which get an empty one because their body already says it.
 */
@ActiveProfiles("companion-fake")
class CompanionMessageAdvicePersistenceIT extends AbstractIntegrationTest {

    /** The real {@code sleep_recover_tonight} library text (application.yml {@code text-hu}) —
     *  the exact sentence the card printed a second time, verbatim, under its own generated
     *  paragraph on 2026-09-08 (mezo-wtl0). Copied rather than read from config so the fixture
     *  stays stable if the library wording is tuned. */
    private static final String LIBRARY_TEXT = "Az elmúlt éjszakák alváshiánya összeadódott. "
        + "Ma este told előre a villanyoltást fél órával — a hétvégi pótalvás nem váltja ki.";

    @Autowired private CompanionMessagePopulator companionMessagePopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private CompanionMessageRepository companionMessageRepository;
    @Autowired private AdviceCardService adviceCardService;

    @Test
    void testKindCheck_shouldAcceptAdvice() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate date = LocalDate.now();

        companionMessagePopulator.rawInsertKind(owner, date, CompanionMessageEntity.KIND_ADVICE);

        assertThat(companionMessageRepository
            .findByCreatedByAndMessageDateAndKind(owner, date, CompanionMessageEntity.KIND_ADVICE))
            .isPresent();
    }

    @Test
    void testKindCheck_shouldStillRejectAnUnknownKind() {
        UUID owner = userPopulator.createUser().getId();

        assertThatThrownBy(() ->
            companionMessagePopulator.rawInsertKind(owner, LocalDate.now(), "nonsense"))
            .hasStackTraceContaining("ck_companion_message_kind");
    }

    /** The flag-sourced shape, exactly as delivery writes it since mezo-wtl0: facts present,
     *  suggestions EMPTY (the generated body already carries the recommendation). The empty list
     *  must survive the jsonb round-trip as empty and NOT as null — null is the pre-S4 legacy
     *  marker two tests below depend on, and the frontend renders the two differently. */
    @Test
    void testEnvelope_shouldRoundTripTheAdvicePayload() {
        UUID owner = userPopulator.createUser().getId();

        CompanionMessageEntity saved = companionMessagePopulator.createAdvice(
            owner, LocalDate.now(), "sleep_debt", "sleep_recover_tonight",
            "Mezo · észrevétel", "Ma este feküdj le korábban.",
            List.of("Alvásadósság: 1,4 óra/éjszaka"), List.of(), Instant.now());

        CompanionMessageEnvelope content = companionMessageRepository
            .findById(saved.getId()).orElseThrow().getContent();
        assertThat(content.adviceKey()).isEqualTo("sleep_debt");
        assertThat(content.interventionKey()).isEqualTo("sleep_recover_tonight");
        assertThat(content.setupKey()).isNull();
        assertThat(content.facts()).containsExactly("Alvásadósság: 1,4 óra/éjszaka");
        assertThat(content.suggestions()).isNotNull().isEmpty();
        // The shape production actually writes: an empty (non-null) actions list, never null —
        // this is the assertion that stops createAdvice's shape drifting from AdviceCardService's.
        assertThat(content.actions()).isEmpty();
        assertThat(content.applied()).isNull();
    }

    /** The ONE advice shape that still carries a suggestion list on the wire (mezo-wtl0): a
     *  once-ever question card, whose „suggestions" are its two one-tap answers — the frontend
     *  reads them as the answer key, so a lost list would silently unanswerable the card. */
    @Test
    void testEnvelope_shouldRoundTripAQuestionCardsAnswerChips() {
        UUID owner = userPopulator.createUser().getId();

        CompanionMessageEntity saved = companionMessagePopulator.createQuestion(
            owner, LocalDate.now(), "question_feature_abandonment", "Mezo · kérdés",
            "Tudatosan tetted félre, vagy csak kikopott? 👍 / 👎",
            List.of("Az elmúlt 30 napban nem volt bejegyzés."),
            List.of("👍 — igen", "👎 — nem"), Instant.now());

        CompanionMessageEnvelope content = companionMessageRepository
            .findById(saved.getId()).orElseThrow().getContent();
        assertThat(content.adviceKey()).isEqualTo("question_feature_abandonment");
        assertThat(content.setupKey()).isEqualTo("question_feature_abandonment");
        assertThat(content.interventionKey()).isNull();
        assertThat(content.suggestions()).containsExactly("👍 — igen", "👎 — nem");
    }

    /** Old rows have no advice components at all — jsonb deserializes the new trailing fields to
     *  null (no @JsonIgnoreProperties, no FAIL_ON_UNKNOWN_PROPERTIES override anywhere on this
     *  envelope). Adding a TRAILING component is safe; REMOVING one would not be. */
    @Test
    void testEnvelope_shouldDeserializeAPreS4RowWithNullAdviceFields() {
        UUID owner = userPopulator.createUser().getId();
        CompanionMessageEntity legacy = companionMessagePopulator.createIntervention(
            owner, LocalDate.now(), "stress_reset", "Régi kártya", Instant.now());

        CompanionMessageEnvelope content = companionMessageRepository
            .findById(legacy.getId()).orElseThrow().getContent();
        assertThat(content.adviceKey()).isNull();
        assertThat(content.facts()).isNull();
        assertThat(content.suggestions()).isNull();
    }

    @Test
    void testEnvelope_shouldRoundTripActionsAndApplied() {
        UUID owner = userPopulator.createUser().getId();

        CompanionMessageEntity saved = companionMessagePopulator.createAdviceWithActions(
            owner, LocalDate.now(), "sleep_debt", "sleep_recover_tonight",
            "Mezo · észrevétel", "Ma este feküdj le korábban.",
            List.of("Alvásadósság: 1,6 óra/éjszaka"), List.of("Told előre a villanyoltást."),
            List.of(new CompanionMessageEnvelope.Action(
                AdviceActionKey.SHIFT_SLEEP_ANCHOR, "Horgony −30 perc", Map.of("minutes", -30))),
            null, Instant.now());

        CompanionMessageEnvelope content = companionMessageRepository
            .findById(saved.getId()).orElseThrow().getContent();
        assertThat(content.actions()).hasSize(1);
        assertThat(content.actions().get(0).key()).isEqualTo(AdviceActionKey.SHIFT_SLEEP_ANCHOR);
        assertThat(content.actions().get(0).params()).containsEntry("minutes", -30);
        assertThat(content.applied()).isNull();
    }

    /** The pre-S5 advice rows on main carry neither component — trailing additions deserialize to
     *  null, which is what lets this slice ship without a data migration. */
    @Test
    void testEnvelope_shouldDeserializeAPreS5AdviceRowWithNullActionFields() {
        UUID owner = userPopulator.createUser().getId();
        CompanionMessageEntity legacy = companionMessagePopulator.createLegacyAdvice(
            owner, LocalDate.now(), "sleep_debt", "sleep_recover_tonight", "Mezo · észrevétel",
            "régi kártya", List.of("tény"), List.of("javaslat"), Instant.now());

        CompanionMessageEnvelope content = companionMessageRepository
            .findById(legacy.getId()).orElseThrow().getContent();
        assertThat(content.actions()).isNull();
        assertThat(content.applied()).isNull();
    }

    /**
     * mezo-wtl0, the defect itself: the card printed a long generated paragraph and then the
     * library sentence verbatim underneath — the same instruction twice, in two registers. The
     * body here is the fake's own answer, which is proof the prose really was generated (and so
     * really is a paraphrase of the suggestion), while the row carries no suggestion to display.
     */
    @Test
    void testDeliver_shouldWriteNoSuggestions_whenTheBodyWasGeneratedFromThem() {
        UUID owner = userPopulator.createUser().getId();

        CompanionMessageEntity card = adviceCardService.deliver(owner, AdviceCandidate.fromFlag(
            "sleep_debt", "sleep_recover_tonight", "Mezo · észrevétel",
            List.of("Alvásadósság: 1,6 óra/éjszaka"), List.of(LIBRARY_TEXT), LIBRARY_TEXT))
            .orElseThrow();

        CompanionMessageEnvelope content = companionMessageRepository
            .findById(card.getId()).orElseThrow().getContent();
        assertThat(content.body()).containsExactly(FakeCompanionLlm.ADVICE_DEFAULT_ANSWER);
        assertThat(content.suggestions()).isNotNull().isEmpty();
        // The facts list is untouched — it is the card's evidence („Miből gondolom"), not a
        // second copy of the advice, so nothing about it duplicates the body.
        assertThat(content.facts()).containsExactly("Alvásadósság: 1,6 óra/éjszaka");
    }

    /**
     * The other half of the mezo-wtl0 split, and the one a naive fix breaks: the model must STILL
     * be grounded on the suggestions, or the prose loses the actual recommendation. Scripting the
     * fake's answer from inside the SUGGESTION (not a fact, the way every other advice test does
     * it) is what makes that observable — the scripted sentence can only come back as the body if
     * the suggestion reached the prompt. Same row then shows it did not reach the card.
     */
    @Test
    void testDeliver_shouldStillGroundTheModelOnTheSuggestions_whileDisplayingNone() {
        UUID owner = userPopulator.createUser().getId();
        String scripted = "Told előre a villanyoltást, és ne a hétvégére hagyd a pótalvást.";

        CompanionMessageEntity card = adviceCardService.deliver(owner, AdviceCandidate.fromFlag(
            "sleep_debt", "sleep_recover_tonight", "Mezo · észrevétel",
            List.of("Alvásadósság: 1,6 óra/éjszaka"),
            List.of("[fake-advice:" + scripted + "]"), LIBRARY_TEXT))
            .orElseThrow();

        CompanionMessageEnvelope content = companionMessageRepository
            .findById(card.getId()).orElseThrow().getContent();
        assertThat(content.body())
            .as("the suggestion must still reach the model as grounding")
            .containsExactly(scripted);
        assertThat(content.suggestions()).isNotNull().isEmpty();
    }

    /** The verbatim exception (mezo-d58h.7.5): {@code verbatim} is the ONE discriminator behind
     *  both outcomes, so the emptied list above and the preserved chips here have to be pinned
     *  together — otherwise a future „just always clear the suggestions" simplification looks
     *  green while it silently strips the question card's answer key. */
    @Test
    void testDeliver_shouldKeepTheAnswerChips_whenTheCandidateIsVerbatim() {
        UUID owner = userPopulator.createUser().getId();
        String question = "Tudatosan tetted félre, vagy csak kikopott? 👍 / 👎";

        CompanionMessageEntity card = adviceCardService.deliver(owner,
            AdviceCandidate.fromQuestion("question_feature_abandonment", "Mezo · kérdés",
                List.of("Az elmúlt 30 napban nem volt bejegyzés."),
                List.of("👍 — igen", "👎 — nem"), question))
            .orElseThrow();

        CompanionMessageEnvelope content = companionMessageRepository
            .findById(card.getId()).orElseThrow().getContent();
        assertThat(content.body()).containsExactly(question);
        assertThat(content.suggestions()).containsExactly("👍 — igen", "👎 — nem");
    }
}
