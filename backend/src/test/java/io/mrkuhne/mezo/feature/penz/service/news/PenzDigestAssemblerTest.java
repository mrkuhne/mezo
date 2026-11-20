package io.mrkuhne.mezo.feature.penz.service.news;

import static io.mrkuhne.mezo.feature.penz.service.news.DigestFixtures.HOLDINGS;
import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.penz.entity.PenzDigestItemJson;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Stories + figures + the model's raw answer → stored items (mezo-r36n9.104, build notes §3.6–3.7). */
class PenzDigestAssemblerTest {

    private static final DigestStory WORLD = DigestFixtures.worldStory("Egy kitalált cikk szövege.");
    private static final DigestStory FX = DigestFixtures.fxStory();
    private static final DigestStory RATES = DigestFixtures.ratesStory();
    private static final List<DigestStory> ALL = List.of(WORLD, FX, RATES);

    @Test
    void testAssemble_shouldShapeTheItemLikePenzDigestItem_withLedgerNameAndBackendFigures() {
        List<PenzDigestItemJson> items = DigestAssembler.assemble(List.of(WORLD), HOLDINGS,
            DigestFixtures.json(DigestFixtures.good()));

        assertThat(items).hasSize(1);
        PenzDigestItemJson i = items.get(0);
        assertThat(i.id()).isEqualTo(WORLD.id());
        assertThat(i.kind()).isEqualTo("holding");
        assertThat(i.holdingId()).isEqualTo(DigestFixtures.WORLD_ID);
        assertThat(i.holdingName()).isEqualTo("Mintavilág ETF");
        assertThat(i.sleeve()).isEqualTo("long");
        assertThat(i.effectHufMinor()).isEqualTo(-1_840_000L);
        assertThat(i.effectNote()).isEqualTo("a te részeden");
        assertThat(i.changePct()).isEqualByComparingTo("-1.1");
        assertThat(i.confidence()).isEqualTo(2);
        assertThat(i.title()).isEqualTo(DigestFixtures.GOOD_TITLE);
        assertThat(i.narratedBy()).isEqualTo("model");
        assertThat(i.publishedAt()).isEqualTo(WORLD.story().newest());
        assertThat(i.sources()).extracting(PenzDigestItemJson.Source::url).containsExactly("https://www.cnbc.com/w1");
    }

    @Test
    void testAssemble_shouldFallBackForEveryStory_whenTheAnswerIsMissingOrGarbage() {
        for (String raw : new String[] {null, "", "not json", "{\"items\":\"x\"}", "{\"items\":[1,2]}", "[]",
            "{\"items\":[{\"story\":", "```json\n{}\n```"}) {
            List<PenzDigestItemJson> items = DigestAssembler.assemble(ALL, HOLDINGS, raw);

            assertThat(items).as(String.valueOf(raw)).hasSize(3)
                .allSatisfy(i -> {
                    assertThat(i.narratedBy()).isEqualTo("fallback");
                    assertThat(i.confidence()).isZero();
                });
        }
    }

    @Test
    void testAssemble_shouldDropKeepFalseMacro_ignoreUnknownIds_andFallBackForMissingStories() {
        DigestModelItem dropFx = new DigestModelItem(FX.id(), false, "x", "x", "x", 1, "x", "x");
        DigestModelItem unknown = new DigestModelItem("holding-zzzzzzzzzz", true, "x", "x", "x", 1, "x", "x");

        List<PenzDigestItemJson> items = DigestAssembler.assemble(ALL, HOLDINGS,
            "Itt a válasz: " + DigestFixtures.json(DigestFixtures.good(), dropFx, unknown) + " köszönöm");

        assertThat(items).extracting(PenzDigestItemJson::id).containsExactly(WORLD.id(), RATES.id());
        assertThat(items).extracting(PenzDigestItemJson::narratedBy).containsExactly("model", "fallback");
        PenzDigestItemJson rates = items.get(1);
        assertThat(rates.holdingName()).isNull();
        assertThat(rates.sleeve()).isNull();
        assertThat(rates.effectNote()).isEqualTo("változatlan hozam");
        assertThat(rates.noAction()).isEqualTo(DigestFallbackCopy.noAction(DigestKind.RATES, null));
    }

    @Test
    void testAssemble_shouldReplaceAFailingItem_andReportWhy() {
        DigestModelItem bad = new DigestModelItem(WORLD.id(), true, DigestFixtures.GOOD_TITLE, "Add el most!",
            DigestFixtures.GOOD_BODY, 2, DigestFixtures.GOOD_UNCERTAINTY, DigestFixtures.GOOD_NO_ACTION);

        DigestAssembler.Assembly a = DigestAssembler.assembleWithReport(List.of(WORLD), HOLDINGS,
            DigestFixtures.json(bad));

        assertThat(a.items()).singleElement().satisfies(i -> {
            assertThat(i.narratedBy()).isEqualTo("fallback");
            assertThat(i.verdict()).isEqualTo(DigestFallbackCopy.verdict());
            assertThat(i.title()).isEqualTo("Mintavilág ETF: friss hír");
            assertThat(i.effectHufMinor()).isEqualTo(-1_840_000L);
        });
        assertThat(a.rejected().get(WORLD.id())).extracting(DigestViolation::rule)
            .contains(DigestViolation.Rule.BOUNDARY);
    }

    @Test
    void testAssemble_shouldCapConfidenceAtOne_whenNoArticleBodyWasRead() {
        DigestStory headlinesOnly = DigestFixtures.worldStory(null);

        List<PenzDigestItemJson> items = DigestAssembler.assemble(List.of(headlinesOnly), HOLDINGS,
            DigestFixtures.json(DigestFixtures.good()));

        assertThat(items.get(0).narratedBy()).isEqualTo("model");
        assertThat(items.get(0).confidence()).isEqualTo(1);
    }

    @Test
    void testAssemble_shouldTakeTheFirstEntryPerStory() {
        DigestModelItem second = new DigestModelItem(WORLD.id(), true, "Más cím", DigestFixtures.GOOD_VERDICT,
            DigestFixtures.GOOD_BODY, 1, DigestFixtures.GOOD_UNCERTAINTY, DigestFixtures.GOOD_NO_ACTION);

        List<PenzDigestItemJson> items = DigestAssembler.assemble(List.of(WORLD), HOLDINGS,
            DigestFixtures.json(DigestFixtures.good(), second));

        assertThat(items.get(0).title()).isEqualTo(DigestFixtures.GOOD_TITLE);
    }
}
