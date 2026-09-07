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
    void parse_selfAuditExpertKeyedSzkeptikus_threadsSeparately_fromTheVerdictTurn() {
        List<ConferenceTranscriptEnvelope.Turn> turns = List.of(
                turn("szkeptikus", "Szkeptikus: 2 javaslat a hét 5 megfigyeléséből.\n"
                        + "Az önreflexió szerint a heti célok túl agresszívak voltak.\n"
                        + "A visszajelzések figyelmen kívül hagyása ismétlődő minta."),
                turn("drill", "Drill: 1 javaslat a hét 4 megfigyeléséből.\n"
                        + "A pihenőnapok kihagyása fáradtsághoz vezetett."),
                turn("szkeptikus", "Szkeptikus: 3 javaslat véleményezve.\n"
                        + "P0: KILL — Az önértékelés torzított, nincs külső mérce.\n"
                        + "P1: KEEP — A visszajelzés-mintázat adatokkal alátámasztott.\n"
                        + "P2: KEEP — A pihenőnap-kihagyás a naplóban dokumentált."),
                turn("mezo", "Mezo: 2/3 javaslat elfogadva.\n"
                        + "P0: ELUTASÍTVA (0.85) — Nincs külső mérce.\n"
                        + "P1: ELFOGADVA (0.80) — Alátámasztott mintázat.\n"
                        + "P2: ELFOGADVA (0.75) — Dokumentált kihagyás."));

        ConferenceDeliberationEnvelope envelope = LegacyTranscriptParser.parse(turns);

        assertThat(envelope).isNotNull();
        assertThat(envelope.threads()).hasSize(2);

        ConferenceDeliberationEnvelope.Thread selfAudit = envelope.threads().get(0);
        assertThat(selfAudit.items()).hasSize(2);

        ConferenceDeliberationEnvelope.Item first = selfAudit.items().get(0);
        assertThat(first.index()).isZero();
        assertThat(first.expertKey()).isEqualTo("szkeptikus");
        assertThat(first.text()).isEqualTo("Az önreflexió szerint a heti célok túl agresszívak voltak.");
        assertThat(first.skeptic().verdict()).isEqualTo("KILL");
        assertThat(first.chair().accepted()).isFalse();

        ConferenceDeliberationEnvelope.Item second = selfAudit.items().get(1);
        assertThat(second.index()).isEqualTo(1);
        assertThat(second.text()).isEqualTo("A visszajelzések figyelmen kívül hagyása ismétlődő minta.");
        assertThat(second.skeptic().verdict()).isEqualTo("KEEP");
        assertThat(second.chair().accepted()).isTrue();

        ConferenceDeliberationEnvelope.Item third = envelope.threads().get(1).items().get(0);
        assertThat(third.index()).isEqualTo(2);
        assertThat(third.expertKey()).isEqualTo("drill");
        assertThat(third.skeptic().verdict()).isEqualTo("KEEP");
        assertThat(third.chair().accepted()).isTrue();
    }

    /** A "mezo" turn with no ruling line is NOT the chair turn: it threads like any other expert
     *  turn, and its lines are numbered into the shared proposal index. */
    @Test
    void parse_mezoTurnWithoutRulingLines_threadsAsAnExpertTurn() {
        List<ConferenceTranscriptEnvelope.Turn> turns = List.of(
                turn("mezo", "Mezo: 1 javaslat a hét 2 megfigyeléséből.\n"
                        + "A heti tervezés következetesebb lett."),
                turn("drill", "Drill: 1 javaslat a hét 4 megfigyeléséből.\n"
                        + "A pihenőnapok kihagyása fáradtsághoz vezetett."),
                turn("szkeptikus", "Szkeptikus: 2 javaslat véleményezve.\n"
                        + "P0: KEEP — Elfogadható.\n"
                        + "P1: KILL — Kevés adat."));

        ConferenceDeliberationEnvelope envelope = LegacyTranscriptParser.parse(turns);

        assertThat(envelope).isNotNull();
        assertThat(envelope.threads()).hasSize(2);
        ConferenceDeliberationEnvelope.Item chairAuthored = envelope.threads().get(0).items().get(0);
        assertThat(chairAuthored.index()).isZero();
        assertThat(chairAuthored.expertKey()).isEqualTo("mezo");
        assertThat(chairAuthored.skeptic().verdict()).isEqualTo("KEEP");
        assertThat(chairAuthored.chair()).isNull();
        assertThat(envelope.threads().get(1).items().get(0).index()).isEqualTo(1);
    }

    /** The same persona key WITH ruling lines is the chair turn: it is consumed as rulings and
     *  never threaded as an expert's proposals. */
    @Test
    void parse_mezoTurnWithRulingLines_isTheChairTurn_neverAnExpertThread() {
        List<ConferenceTranscriptEnvelope.Turn> turns = List.of(
                turn("drill", "Drill: 1 javaslat a hét 4 megfigyeléséből.\n"
                        + "A pihenőnapok kihagyása fáradtsághoz vezetett."),
                turn("mezo", "Mezo: 1/1 javaslat elfogadva.\n"
                        + "P0: ELFOGADVA (0.70) — Dokumentált kihagyás."));

        ConferenceDeliberationEnvelope envelope = LegacyTranscriptParser.parse(turns);

        assertThat(envelope).isNotNull();
        assertThat(envelope.threads()).singleElement()
                .satisfies(thread -> assertThat(thread.title()).isEqualTo("Drill"));
        assertThat(envelope.threads().get(0).items().get(0).chair().accepted()).isTrue();
    }

    /** C1 (mezo-xlvr final review): a proposal text carrying a newline makes the line count
     *  disagree with the header's own count — the transcript is then unindexable, and the parser
     *  must refuse rather than shift every later verdict/ruling onto the wrong claim. */
    @Test
    void parse_multiLineProposalText_refuses_ratherThanShiftingTheIndex() {
        List<ConferenceTranscriptEnvelope.Turn> turns = List.of(
                turn("drill", "Drill: 1 javaslat a hét 4 megfigyeléséből.\n"
                        + "A naplózás elmarad.\n"
                        + "Ez a mondat még ugyanannak a javaslatnak a szövege."),
                turn("szomnologus", "Szomnológus: 1 javaslat a hét 8 megfigyeléséből.\n"
                        + "Az alvásminőség romlik."),
                turn("szkeptikus", "Szkeptikus: 2 javaslat véleményezve.\n"
                        + "P0: KEEP — Elfogadható.\n"
                        + "P1: KILL — Kevés adat."),
                turn("mezo", "Mezo: 1/2 javaslat elfogadva.\n"
                        + "P0: ELFOGADVA (0.70) — Rendben.\n"
                        + "P1: ELUTASÍTVA (0.40) — Nem."));

        assertThat(LegacyTranscriptParser.parse(turns)).isNull();
    }

    /** The refusal must not swallow the well-formed case: the same shape, one line per proposal,
     *  still parses with every index intact. */
    @Test
    void parse_headerCountMatchesClaimLines_stillParses() {
        List<ConferenceTranscriptEnvelope.Turn> turns = List.of(
                turn("drill", "Drill: 2 javaslat a hét 4 megfigyeléséből.\n"
                        + "A naplózás elmarad.\n"
                        + "A pihenőnapok kimaradnak."),
                turn("szomnologus", "Szomnológus: 1 javaslat a hét 8 megfigyeléséből.\n"
                        + "Az alvásminőség romlik."),
                turn("szkeptikus", "Szkeptikus: 3 javaslat véleményezve.\n"
                        + "P0: KEEP — Elfogadható.\n"
                        + "P1: KILL — Kevés adat.\n"
                        + "P2: KEEP — Rendben."));

        ConferenceDeliberationEnvelope envelope = LegacyTranscriptParser.parse(turns);

        assertThat(envelope).isNotNull();
        assertThat(envelope.threads()).hasSize(2);
        assertThat(envelope.threads().get(0).items()).hasSize(2);
        assertThat(envelope.threads().get(1).items().get(0).index()).isEqualTo(2);
        assertThat(envelope.threads().get(1).items().get(0).skeptic().verdict()).isEqualTo("KEEP");
    }

    /** A turn whose header states no proposal count at all cannot be indexed either. */
    @Test
    void parse_expertTurnWithoutACountingHeader_refuses() {
        List<ConferenceTranscriptEnvelope.Turn> turns = List.of(
                turn("drill", "Drill jelentése a hétről.\nA naplózás elmarad."));

        assertThat(LegacyTranscriptParser.parse(turns)).isNull();
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
