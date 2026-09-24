package io.mrkuhne.mezo.feature.character.edition;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.character.service.CharacterCouncilBudget;
import io.mrkuhne.mezo.feature.character.service.edition.EditionCandidate;
import io.mrkuhne.mezo.feature.character.service.edition.EditionGenre;
import io.mrkuhne.mezo.feature.character.service.edition.EditionVoiceWriter;
import io.mrkuhne.mezo.feature.character.service.edition.TeamCharacter;
import io.mrkuhne.mezo.feature.character.service.edition.VoicedText;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * IT for {@link EditionVoiceWriter} (Task 13, csapatfal II. spec 2026-09-24 §3.4): one LLM call per
 * edition, a fact guard per post, and a fallback that NEVER throws.
 *
 * <p>The cycle budget is squeezed to its smallest legal size (3 — {@code @Min(3)} on
 * {@code cycleCalls}) on purpose: that is what makes
 * {@link #write_afterAWholeCycleWasSpent_opensItsOwn} a real assertion (the writer runs AFTER the
 * konzílium, in its own cycle) instead of a tautology.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.character.council-budget.cycle-calls=3")
class EditionVoiceWriterIT extends AbstractIntegrationTest {

    @Autowired private EditionVoiceWriter writer;
    @Autowired private CharacterCouncilBudget budget;
    @Autowired private LlmCallContextHolder calls;
    @Autowired private DatabasePopulator users;

    private static final String SLEEP_RECORD = "Az esti lefekvés és a másnapi energia együtt mozog.";
    private static final String TRAIN_RECORD = "A heti terhelésed három hete ugyanaz.";

    private static EditionCandidate candidate(TeamCharacter who, EditionGenre genre, String record, String... facts) {
        return new EditionCandidate("pattern", UUID.randomUUID().toString(), who, genre, "A cím",
                record, List.of(facts), List.of(), false, false, null, "/mezo/patterns/x");
    }

    private static String scripted(String json) {
        return "[fake-edition-json:" + Base64.getEncoder().encodeToString(json.getBytes(StandardCharsets.UTF_8)) + "]";
    }

    /** Spends the whole cycle allowance (cycle-calls=3), the way a konzílium round would. */
    private void burnTheCycle() {
        for (int i = 0; i < 3; i++) {
            calls.runWith(new LlmCallContext("character", "council-stand-in", null, null), () -> "ok");
        }
    }

    /** The fake keys on a LITERAL copy of the marker (companion must not import character). */
    @Test
    void marker_isMirroredByTheFake() {
        assertThat(FakeCompanionLlm.EDITION_MARKER_MIRROR).isEqualTo(EditionVoiceWriter.EDITION_MARKER);
    }

    @Test
    void write_defaultAnswer_voicesEveryPost() {
        UUID owner = users.populateUser("edition-voice-ok@test.local");
        var ranked = List.of(candidate(TeamCharacter.SZUNYA, EditionGenre.MEGFIGYELES, SLEEP_RECORD, "5 közös nap"),
                candidate(TeamCharacter.MOCOR, EditionGenre.KISERLET, TRAIN_RECORD));

        List<VoicedText> out = writer.write(owner, ranked);

        assertThat(out).hasSize(2).allMatch(VoicedText::voiced);
        assertThat(out.get(0).body()).isEqualTo(FakeCompanionLlm.editionBody(SLEEP_RECORD));
        assertThat(out.get(1).body()).isEqualTo(FakeCompanionLlm.editionBody(TRAIN_RECORD));
        assertThat(out.get(0).title()).isEqualTo("A cím"); // no title in the answer -> the record's own
    }

    @Test
    void write_emptySelection_returnsEmpty() {
        UUID owner = users.populateUser("edition-voice-empty@test.local");

        assertThat(writer.write(owner, List.of())).isEmpty();
    }

    @Test
    void write_unparseableAnswer_everyPostKeepsItsRecordText() {
        UUID owner = users.populateUser("edition-voice-malformed@test.local");
        String broken = SLEEP_RECORD + " " + FakeCompanionLlm.EDITION_MALFORMED;
        var ranked = List.of(candidate(TeamCharacter.SZUNYA, EditionGenre.MEGFIGYELES, broken),
                candidate(TeamCharacter.MOCOR, EditionGenre.KISERLET, TRAIN_RECORD));

        List<VoicedText> out = writer.write(owner, ranked);

        assertThat(out).hasSize(2).noneMatch(VoicedText::voiced);
        assertThat(out).extracting(VoicedText::body).containsExactly(broken, TRAIN_RECORD);
    }

    /** A kitalált szám CSAK azt a posztot némítja el — a többi hangos marad. */
    @Test
    void write_inventedNumber_silencesOnlyThatPost() {
        UUID owner = users.populateUser("edition-voice-number@test.local");
        String cleanVoice = "Ezen a héten semmi sem mozdult a terhelésedben. Még nézem tovább.";
        String script = scripted("[{\"rank\":1,\"body\":\"Már 9 közös nap gyűlt össze. Még figyelem.\"},"
                + "{\"rank\":2,\"body\":\"" + cleanVoice + "\"}]");
        var ranked = List.of(candidate(TeamCharacter.SZUNYA, EditionGenre.MEGFIGYELES, SLEEP_RECORD, "5 közös nap"),
                candidate(TeamCharacter.MOCOR, EditionGenre.KISERLET, TRAIN_RECORD + " " + script));

        List<VoicedText> out = writer.write(owner, ranked);

        assertThat(out.get(0).voiced()).isFalse();
        assertThat(out.get(0).body()).isEqualTo(SLEEP_RECORD);
        assertThat(out.get(1).voiced()).isTrue();
        assertThat(out.get(1).body()).isEqualTo(cleanVoice);
    }

    /** A modell címe is a tény-őrön megy át: kitalált számmal a rekord saját címe marad. */
    @Test
    void write_inventedNumberInTheTitle_keepsTheRecordsOwnTitle() {
        UUID owner = users.populateUser("edition-voice-title@test.local");
        String script = scripted("[{\"rank\":1,\"title\":\"Már 9 napja tart\","
                + "\"body\":\"Kezd úgy tűnni, hogy csúszik a lefekvésed. Még figyelem tovább.\"}]");
        var ranked = List.of(candidate(TeamCharacter.SZUNYA, EditionGenre.MEGFIGYELES, SLEEP_RECORD + " " + script));

        List<VoicedText> out = writer.write(owner, ranked);

        assertThat(out).singleElement().satisfies(text -> {
            assertThat(text.voiced()).isTrue();
            assertThat(text.title()).isEqualTo("A cím");
        });
    }

    @Test
    void write_llmFailure_neverThrows_andKeepsEveryRecordText() {
        UUID owner = users.populateUser("edition-voice-fail@test.local");
        String failing = SLEEP_RECORD + " " + FakeCompanionLlm.FAIL_COMPLETE;
        var ranked = List.of(candidate(TeamCharacter.SZUNYA, EditionGenre.MEGFIGYELES, failing));

        List<VoicedText> out = writer.write(owner, ranked);

        assertThat(out).singleElement().satisfies(text -> {
            assertThat(text.voiced()).isFalse();
            assertThat(text.body()).isEqualTo(failing);
        });
    }

    /** A konzílium ciklusa lefutott és elfogyott — az esti kiadás saját ciklusban szólal meg. */
    @Test
    void write_afterAWholeCycleWasSpent_opensItsOwn() {
        UUID owner = users.populateUser("edition-voice-cycle@test.local");
        budget.run(owner, false, () -> {
            burnTheCycle();
            return null;
        });
        var ranked = List.of(candidate(TeamCharacter.SZUNYA, EditionGenre.MEGFIGYELES, SLEEP_RECORD));

        assertThat(writer.write(owner, ranked)).singleElement().matches(VoicedText::voiced);
    }

    /**
     * Kimerült keretben sem dob. (A ciklus MAGA a végén így is elposzolja a saját hívóját — ez a
     * {@code CharacterCouncilBudget} szándékos szerződése, lásd {@code CharacterCouncilBudgetIT} —
     * de az író addigra már visszaesett a nyers szövegre ahelyett, hogy felfelé dobott volna.)
     */
    @Test
    void write_insideAnExhaustedCycle_fallsBackInsteadOfThrowing() {
        UUID owner = users.populateUser("edition-voice-exhausted@test.local");
        var ranked = List.of(candidate(TeamCharacter.SZUNYA, EditionGenre.MEGFIGYELES, SLEEP_RECORD));
        var written = new AtomicReference<List<VoicedText>>();

        assertThatThrownBy(() -> budget.run(owner, false, () -> {
            burnTheCycle();
            written.set(writer.write(owner, ranked));
            return null;
        })).isInstanceOf(RuntimeException.class);

        assertThat(written.get()).singleElement().satisfies(text -> {
            assertThat(text.voiced()).isFalse();
            assertThat(text.body()).isEqualTo(SLEEP_RECORD);
        });
    }
}
