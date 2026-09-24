package io.mrkuhne.mezo.feature.character.edition;

import static io.mrkuhne.mezo.feature.character.service.edition.EditionGenre.ELOREJELZES;
import static io.mrkuhne.mezo.feature.character.service.edition.EditionGenre.KERDES;
import static io.mrkuhne.mezo.feature.character.service.edition.EditionGenre.KISERLET;
import static io.mrkuhne.mezo.feature.character.service.edition.EditionGenre.MEGFIGYELES;
import static io.mrkuhne.mezo.feature.character.service.edition.EditionGenre.SEJTES;
import static io.mrkuhne.mezo.feature.character.service.edition.TeamCharacter.DERU;
import static io.mrkuhne.mezo.feature.character.service.edition.TeamCharacter.FALAT;
import static io.mrkuhne.mezo.feature.character.service.edition.TeamCharacter.MEZO;
import static io.mrkuhne.mezo.feature.character.service.edition.TeamCharacter.MOCOR;
import static io.mrkuhne.mezo.feature.character.service.edition.TeamCharacter.SZUNYA;
import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.character.service.edition.EditionCandidate;
import io.mrkuhne.mezo.feature.character.service.edition.EditionGenre;
import io.mrkuhne.mezo.feature.character.service.edition.EditionSelector;
import io.mrkuhne.mezo.feature.character.service.edition.PriorShowing;
import io.mrkuhne.mezo.feature.character.service.edition.TeamCharacter;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class EditionSelectorTest {

    private static EditionCandidate c(String kind, String id, TeamCharacter character, EditionGenre genre,
            boolean waiting, Instant changedAt) {
        return new EditionCandidate(kind, id, character, genre, "title-" + id, "record-" + id,
                List.of(), List.of(), waiting, false, changedAt, "route-" + id, List.of());
    }

    private static <T> List<T> concat(List<T> a, List<T> b) {
        var all = new ArrayList<T>(a);
        all.addAll(b);
        return all;
    }

    @Test void capsAtSixAndRanksWaitingFirst() {
        var t = Instant.parse("2026-09-24T19:00:00Z");
        var candidates = List.of(
                c("pattern", "a1", SZUNYA, MEGFIGYELES, true, t),
                c("pattern", "a2", MOCOR, MEGFIGYELES, false, t),
                c("pattern", "a3", FALAT, MEGFIGYELES, false, t),
                c("pattern", "a4", DERU, MEGFIGYELES, false, t),
                c("pattern", "a5", MEZO, MEGFIGYELES, false, t),
                c("prediction", "b1", SZUNYA, ELOREJELZES, false, t),
                c("prediction", "b2", MOCOR, ELOREJELZES, false, t),
                c("prediction", "b3", FALAT, ELOREJELZES, false, t),
                c("prediction", "b4", DERU, ELOREJELZES, false, t));

        var picked = EditionSelector.select(candidates, List.of(), null);

        assertThat(picked).hasSize(6);
        assertThat(picked.get(0).sourceId()).isEqualTo("a1");
    }

    @Test void atMostTwoPerCharacter() {
        var t = Instant.parse("2026-09-24T19:00:00Z");
        var candidates = List.of(
                c("pattern", "s1", SZUNYA, MEGFIGYELES, false, t),
                c("pattern", "s2", SZUNYA, MEGFIGYELES, false, t),
                c("pattern", "s3", SZUNYA, MEGFIGYELES, false, t),
                c("pattern", "s4", SZUNYA, MEGFIGYELES, false, t),
                c("pattern", "s5", SZUNYA, MEGFIGYELES, false, t));

        var picked = EditionSelector.select(candidates, List.of(), null);

        assertThat(picked.stream().filter(p -> p.character() == SZUNYA).count()).isEqualTo(2);
    }

    @Test void atMostOnePerSource() {
        var t = Instant.parse("2026-09-24T19:00:00Z");
        var candidates = List.of(
                c("pattern", "dup", SZUNYA, MEGFIGYELES, false, t),
                c("pattern", "dup", SZUNYA, KISERLET, false, t));

        var picked = EditionSelector.select(candidates, List.of(), null);

        assertThat(picked).hasSize(1);
    }

    @Test void fillsWithFillersOnlyBelowThree() {
        var t = Instant.parse("2026-09-24T19:00:00Z");
        var main = List.of(c("pattern","a",SZUNYA,MEGFIGYELES,false,t), c("prediction","b",FALAT,ELOREJELZES,false,t));
        var fill = List.of(c("pair","x",MOCOR,SEJTES,false,t), c("pair","y",DERU,SEJTES,false,t), c("pair","z",MEZO,SEJTES,false,t));
        var picked = EditionSelector.select(concat(main, fill), List.of(), null);
        assertThat(picked).hasSize(3);
        assertThat(picked.subList(0, 2)).extracting(EditionCandidate::sourceId).containsExactly("b", "a");
        assertThat(picked.get(2).genre()).isEqualTo(SEJTES);
    }

    @Test void fewerThanThreeWhenNothingElseIsReal() {
        var t = Instant.parse("2026-09-24T19:00:00Z");
        var candidates = List.of(c("pattern", "only", SZUNYA, MEGFIGYELES, false, t));

        var picked = EditionSelector.select(candidates, List.of(), null);

        assertThat(picked).hasSize(1);
    }

    @Test void emptyInEmptyOut() {
        assertThat(EditionSelector.select(List.of(), List.of(), null)).isEmpty();
    }

    @Test void repeatBanWithinSevenDaysUnlessChanged() {
        var shownAt = Instant.parse("2026-09-20T10:00:00Z");
        var notChanged = c("pattern", "same", SZUNYA, MEGFIGYELES, false, Instant.parse("2026-09-19T10:00:00Z"));
        var changed = c("pattern", "same", SZUNYA, MEGFIGYELES, false, Instant.parse("2026-09-21T10:00:00Z"));

        var picked1 = EditionSelector.select(List.of(notChanged),
                List.of(new PriorShowing("pattern:same", shownAt)), null);
        assertThat(picked1).isEmpty();

        var picked2 = EditionSelector.select(List.of(changed),
                List.of(new PriorShowing("pattern:same", shownAt)), null);
        assertThat(picked2).hasSize(1);
    }

    @Test void deterministicTieBreak() {
        var earlier = Instant.parse("2026-09-24T10:00:00Z");
        var later = Instant.parse("2026-09-24T18:00:00Z");
        var a = c("pattern", "aaa", SZUNYA, KERDES, false, later);
        var b = c("prediction", "bbb", MOCOR, KERDES, false, later);
        var d = c("pair", "ddd", FALAT, KERDES, false, earlier);

        var picked = EditionSelector.select(List.of(a, b, d), List.of(), null);

        // a and b tie on score+changedAt: sourceKey asc -> "pattern:aaa" < "prediction:bbb"
        assertThat(picked.get(0).sourceId()).isEqualTo("aaa");
        assertThat(picked.get(1).sourceId()).isEqualTo("bbb");
        assertThat(picked.get(2).sourceId()).isEqualTo("ddd");
    }

    @Test void freshBonusFollowsLastEdition() {
        var lastEditionAt = Instant.parse("2026-09-23T00:00:00Z");
        var freshObservation = c("pattern", "fresh", SZUNYA, MEGFIGYELES, false, Instant.parse("2026-09-24T00:00:00Z"));
        var stalePrediction = c("prediction", "stale", MOCOR, ELOREJELZES, false, Instant.parse("2026-09-01T00:00:00Z"));

        var picked = EditionSelector.select(List.of(freshObservation, stalePrediction), List.of(), lastEditionAt);

        assertThat(picked.get(0).sourceId()).isEqualTo("fresh");
        assertThat(picked.get(1).sourceId()).isEqualTo("stale");
    }
}
