package io.mrkuhne.mezo.feature.penz.service.news;

import static io.mrkuhne.mezo.feature.penz.service.news.WeeklyFixtures.HOLDINGS;
import static io.mrkuhne.mezo.feature.penz.service.news.WeeklyFixtures.PELDA_ID;
import static io.mrkuhne.mezo.feature.penz.service.news.WeeklyFixtures.T0;
import static io.mrkuhne.mezo.feature.penz.service.news.WeeklyFixtures.good;
import static io.mrkuhne.mezo.feature.penz.service.news.WeeklyFixtures.holdingItem;
import static io.mrkuhne.mezo.feature.penz.service.news.WeeklyFixtures.json;
import static io.mrkuhne.mezo.feature.penz.service.news.WeeklyFixtures.src;
import static io.mrkuhne.mezo.feature.penz.service.news.WeeklyFixtures.with;
import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.penz.entity.PenzDigestItemJson;
import io.mrkuhne.mezo.feature.penz.entity.PenzWeeklySectionJson;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

/** The weekly assembler (mezo-r36n9.120): quiet, model, fallback per sleeve; stories shown; never throws. */
class PenzWeeklyReviewAssemblerTest {

    private static List<WeeklySection> twoSleeves() {
        return WeeklyFixtures.sections(WeeklyFixtures.worldItem("holding-w"), WeeklyFixtures.peldaItem("holding-p"));
    }

    @Test
    void testAssemble_shouldNarrateCleanSections_andQuietTheEmptyOne() {
        WeeklyModelSection mid = new WeeklyModelSection("mid", false, List.of(),
            "Ezen a héten semmi nem változtatott az 5–10 éves képen.", "Napi zaj volt.", "Csak címeket láttam.",
            "Ez a rész 5–10 évre szól, nincs vele teendőd.");

        List<PenzWeeklySectionJson> out = WeeklyReviewAssembler.assemble(twoSleeves(), HOLDINGS,
            json(good("long", "holding-w"), mid)).sections();

        assertThat(out).extracting(PenzWeeklySectionJson::sleeve).containsExactly("short", "mid", "long");
        assertThat(out).extracting(PenzWeeklySectionJson::narratedBy).containsExactly("quiet", "model", "model");
        assertThat(out.get(0).matters()).isFalse();
        assertThat(out.get(0).storyCount()).isZero();
        assertThat(out.get(2).matters()).isTrue();
        assertThat(out.get(2).horizonLabel()).isEqualTo("10+ év");
        assertThat(out.get(2).stories()).extracting(PenzWeeklySectionJson.Story::holdingName)
            .containsExactly("Mintavilág ETF");
    }

    @Test
    void testAssemble_shouldFallBackPerSleeve_onAViolationOrAMissingSection() {
        WeeklyReviewAssembler.Assembly a = WeeklyReviewAssembler.assemble(twoSleeves(), HOLDINGS,
            json(with(good("long", "holding-w"), "verdict", "Add el most, mielőtt késő.")));

        assertThat(a.sections()).extracting(PenzWeeklySectionJson::narratedBy)
            .containsExactly("quiet", "fallback", "fallback");
        assertThat(a.rejected()).containsOnlyKeys("long");
        assertThat(a.sections().get(2).verdict()).doesNotContain("Add el");
        assertThat(a.sections().get(2).matters()).isFalse();
        assertThat(a.sections().get(2).body()).startsWith("Egy hír érintette");
    }

    @Test
    void testAssemble_shouldFallBackEverywhere_onGarbageOrNoAnswer() {
        for (String raw : new String[] {null, "", "not json", "{\"sections\":7}", "{\"sections\":[{\"sleeve\":3}]}"}) {
            assertThat(WeeklyReviewAssembler.assemble(twoSleeves(), HOLDINGS, raw).sections())
                .extracting(PenzWeeklySectionJson::narratedBy).containsExactly("quiet", "fallback", "fallback");
        }
    }

    @Test
    void testAssemble_shouldShowTheReliedOnStoryFirst_andCapTheStories() {
        List<PenzDigestItemJson> many = new ArrayList<>();
        for (int i = 0; i < 9; i++) {
            many.add(holdingItem("holding-" + i, PELDA_ID, "Példabank Nyrt", "mid", T0.plusSeconds(i), "v",
                src("Lap " + i, "Story " + i)));
        }
        List<WeeklySection> sections = WeeklyReviewSectioner.sections(many, HOLDINGS, null);
        WeeklyModelSection mid = new WeeklyModelSection("mid", true, List.of("holding-0"),
            "A héten volt egy tartós változás az 5–10 éves részednél.", "A Példabank Nyrt új egysége szerkezeti lépés.",
            "Csak címeket láttam.", "Ez a rész 5–10 évre szól, nincs vele teendőd.");

        PenzWeeklySectionJson out = WeeklyReviewAssembler.assemble(sections, HOLDINGS, json(mid)).sections().get(1);

        assertThat(out.narratedBy()).isEqualTo("model");
        assertThat(out.storyCount()).isEqualTo(9);
        assertThat(out.stories()).hasSize(WeeklyReviewAssembler.STORIES_SHOWN);
        assertThat(out.stories().get(0).id()).isEqualTo("holding-0");
        assertThat(out.stories().get(1).id()).isEqualTo("holding-8"); // then newest
    }
}
