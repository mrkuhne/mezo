package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.character.entity.ConferenceDeliberationEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ConferenceTranscriptEnvelope;
import io.mrkuhne.mezo.feature.character.service.LegacyTranscriptParser;
import java.util.List;
import org.junit.jupiter.api.Test;

class LegacyTranscriptParserTest {

    private static ConferenceTranscriptEnvelope.Turn turn(String persona, String text) {
        return new ConferenceTranscriptEnvelope.Turn(persona, text, List.of());
    }

    private static List<ConferenceTranscriptEnvelope.Turn> realTranscript() {
        return List.of(
                turn("drill", "Drill: 2 javaslat a hét 9 megfigyeléséből.\n"
                        + "A naplóbejegyzések hiánya rendszerszintű kihívást jelent.\n"
                        + "A Cink & Magnézium bevitele 13 napon át elmaradt."),
                turn("szomnologus", "Szomnológus: 1 javaslat a hét 8 megfigyeléséből.\n"
                        + "Az alvásminőség romlása összefügg a teljesítménnyel."),
                turn("szkeptikus", "Szkeptikus: 3 javaslat véleményezve.\n"
                        + "P0: KILL — Egy hét naplóhiány nem elegendő bizonyíték.\n"
                        + "P1: KEEP — Az adatok igazolják az eltérést.\n"
                        + "P2: KILL — A korreláció nem jelent kauzalitást."),
                turn("mezo", "Mezo: 1/3 javaslat elfogadva.\n"
                        + "P0: ELUTASÍTVA (0.9) — Túlinterpretáció.\n"
                        + "P1: ELFOGADVA (0.90) — A 13 napos elmaradás egyértelmű.\n"
                        + "P2: ELUTASÍTVA (0.9) — Megalapozatlan ok-okozat.\n"
                        + "Új fejezet: Quest Rendszer Kalibráció — Kritikusan alacsony teljesítés."));
    }

    @Test
    void parse_realTranscript_threadsByExpert_withVerdictsAndRulings() {
        ConferenceDeliberationEnvelope envelope = LegacyTranscriptParser.parse(realTranscript());

        assertThat(envelope).isNotNull();
        assertThat(envelope.threads()).hasSize(2);
        ConferenceDeliberationEnvelope.Thread drill = envelope.threads().get(0);
        assertThat(drill.dimensionKey()).isNull();
        assertThat(drill.title()).isEqualTo("Drill");
        assertThat(drill.items()).hasSize(2);

        ConferenceDeliberationEnvelope.Item first = drill.items().get(0);
        assertThat(first.index()).isZero();
        assertThat(first.expertKey()).isEqualTo("drill");
        assertThat(first.text()).isEqualTo("A naplóbejegyzések hiánya rendszerszintű kihívást jelent.");
        assertThat(first.skeptic().verdict()).isEqualTo("KILL");
        assertThat(first.chair().accepted()).isFalse();
        assertThat(first.reactions()).isEmpty();

        ConferenceDeliberationEnvelope.Item second = drill.items().get(1);
        assertThat(second.skeptic().verdict()).isEqualTo("KEEP");
        assertThat(second.chair().accepted()).isTrue();
        assertThat(second.chair().confidence()).isEqualByComparingTo(new java.math.BigDecimal("0.90"));

        ConferenceDeliberationEnvelope.Item third = envelope.threads().get(1).items().get(0);
        assertThat(third.index()).isEqualTo(2);
        assertThat(third.expertKey()).isEqualTo("szomnologus");
    }

    @Test
    void parse_withoutASkepticTurn_stillParses_leavingTheVerdictOpen() {
        List<ConferenceTranscriptEnvelope.Turn> turns = List.of(
                turn("drill", "Drill: 1 javaslat a hét 3 megfigyeléséből.\nKimarad a napló."),
                turn("mezo", "Mezo: 1/1 javaslat elfogadva.\nP0: ELFOGADVA (0.70) — Rendben."));

        ConferenceDeliberationEnvelope envelope = LegacyTranscriptParser.parse(turns);

        assertThat(envelope).isNotNull();
        ConferenceDeliberationEnvelope.Item item = envelope.threads().get(0).items().get(0);
        assertThat(item.skeptic()).isNull();
        assertThat(item.chair().accepted()).isTrue();
    }

    @Test
    void parse_noExpertTurns_returnsNull() {
        List<ConferenceTranscriptEnvelope.Turn> turns = List.of(
                turn("mezo", "A teljes eddigi történet beolvasva — 9 kezdő állítás felvéve."));

        assertThat(LegacyTranscriptParser.parse(turns)).isNull();
    }

    @Test
    void parse_emptyTranscript_returnsNull() {
        assertThat(LegacyTranscriptParser.parse(List.of())).isNull();
    }
}
