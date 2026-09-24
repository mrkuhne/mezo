package io.mrkuhne.mezo.feature.character.edition;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.character.service.edition.EditionVoiceGuard;
import io.mrkuhne.mezo.feature.character.service.edition.TeamCharacter;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * A tény-őr (Task 12, csapatfal II. spec 2026-09-24 §3.4): a karakterhangon írt poszt csak akkor
 * mehet ki hangosan, ha MINDEN száma a forrásrekordból való, 2–4 mondat, a saját emoji-készletét
 * használja és nincs benne szaknyelv. A bukás nem hiba: a poszt a nyers rekordszöveggel jelenik meg.
 */
class EditionVoiceGuardTest {

    private static final List<String> FACTS = List.of("5 közös nap", "8 kell");
    private static final String RECORD = "Az esti lefekvés és a másnapi energia együtt mozog.";

    @Test
    void inventedNumber_isRejected() {
        assertThat(EditionVoiceGuard.check(TeamCharacter.SZUNYA,
                "Már **9 közös nap** gyűlt össze. Még figyelem tovább.", FACTS, RECORD))
                .contains("number");
    }

    @Test
    void numbersFromTheRecord_pass() {
        assertThat(EditionVoiceGuard.check(TeamCharacter.SZUNYA,
                "Eddig **5 közös nap** gyűlt össze. Még 8 kell, hogy merjek mondani valamit.",
                FACTS, RECORD))
                .isEmpty();
    }

    @Test
    void decimalComma_isNormalisedToTheRecordsDot() {
        assertThat(EditionVoiceGuard.check(TeamCharacter.SZUNYA,
                "Átlagosan **7,5 óra** alvás jött össze. Ez kezd úgy tűnni, mint egy szokás.",
                List.of("7.5 óra"), RECORD))
                .isEmpty();
    }

    @Test
    void oneSentence_isRejected() {
        assertThat(EditionVoiceGuard.check(TeamCharacter.SZUNYA, "Csak egyetlen mondat.", FACTS, RECORD))
                .contains("sentences");
    }

    @Test
    void fiveSentences_areRejected() {
        assertThat(EditionVoiceGuard.check(TeamCharacter.SZUNYA,
                "Egy. Kettő. Három. Négy. Öt.", FACTS, RECORD))
                .contains("sentences");
    }

    @Test
    void foreignEmoji_isRejected() {
        assertThat(EditionVoiceGuard.check(TeamCharacter.SZUNYA,
                "Ma is figyeltem az időzítést 🍽️. Kezd úgy tűnni, hogy csúszik a lefekvés.",
                FACTS, RECORD))
                .contains("emoji");
    }

    @Test
    void skeptic_mayNotUseAnyEmoji() {
        assertThat(EditionVoiceGuard.check(TeamCharacter.SZKEPTIKUS,
                "A hétvége önmagában is magyarázhatja 🌙. Ezt még nem zárnám ki.",
                FACTS, RECORD))
                .contains("emoji");
    }

    @Test
    void jargon_isRejected() {
        assertThat(EditionVoiceGuard.check(TeamCharacter.SZUNYA,
                "A korreláció elég erősnek látszik. Még figyelem tovább.", FACTS, RECORD))
                .contains("jargon");
    }

    @Test
    void ownVoiceWithOwnEmoji_passes() {
        assertThat(EditionVoiceGuard.check(TeamCharacter.SZUNYA,
                "Ma is figyeltem az időzítést 🌙. Kezd úgy tűnni, hogy csúszik a **lefekvés**. "
                        + "Még kevés adat van hozzá.", FACTS, RECORD))
                .isEmpty();
    }

    /** Ami a FORRÁSBAN már ott van, az nem kitalált dísz — a minta-címek nyila átmegy. */
    @Test
    void symbolQuotedFromTheRecord_passes() {
        String record = "Alvásminőség ↔ másnapi edzés-RPE: közepes együttmozgás.";
        assertThat(EditionVoiceGuard.check(TeamCharacter.SZUNYA,
                "Az **alvásminőség ↔ edzés** szál tovább él. Még figyelem, mi lesz belőle.",
                List.of(), record))
                .isEmpty();
    }

    /** A Szkeptikus kivétel: neki a forrásból sem jár jel — a hangja szó szerint jeltelen. */
    @Test
    void skeptic_mayNotEvenQuoteASymbolFromTheRecord() {
        String record = "Alvásminőség ↔ másnapi edzés-RPE: közepes együttmozgás.";
        assertThat(EditionVoiceGuard.check(TeamCharacter.SZKEPTIKUS,
                "Az alvásminőség ↔ edzés szál a hétvégével is magyarázható. Ezt még nem zárnám ki.",
                List.of(), record))
                .contains("emoji");
    }

    /** A saját készleten kívüli emoji akkor is bukik, ha a forrás egy MÁSIKAT tartalmaz. */
    @Test
    void foreignEmoji_staysRejectedEvenWhenTheRecordCarriesAnother() {
        assertThat(EditionVoiceGuard.check(TeamCharacter.SZUNYA,
                "Ez a szál tovább él 🍽️. Még figyelem, mi lesz belőle.",
                List.of(), "Alvásminőség ↔ másnapi edzés-RPE."))
                .contains("emoji");
    }

    /** A variációs szelektor (U+FE0F) nem tesz idegenné egy saját emojit — Falat 🍽️-je a sajátja. */
    @Test
    void variationSelector_doesNotMakeAnEmojiForeign() {
        assertThat(EditionVoiceGuard.check(TeamCharacter.FALAT,
                "A tányérodon megint ott volt a zöldség 🍽️. Ez kezd rendszer lenni.",
                FACTS, RECORD))
                .isEmpty();
    }
}
