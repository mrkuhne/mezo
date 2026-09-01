package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.character.config.CharacterProperties;
import io.mrkuhne.mezo.feature.character.entity.CharacterClaimEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterDimensionEntity;
import io.mrkuhne.mezo.feature.character.entity.ClaimConfidenceHistoryEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ClaimEvidenceEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ClaimFeedbackEnvelope;
import io.mrkuhne.mezo.feature.character.repository.CharacterClaimRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterDimensionRepository;
import io.mrkuhne.mezo.feature.companion.CharacterPromptSource;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * IT for the [Karakter] prompt-block rendering contract (mezo-1gim.8): catalog ordering, human
 * confidence words (never the raw decimal), the ÉRZÉKENY marker, the per-dimension/total-chars
 * caps (whole dimension blocks only, never a mid-line cut), and the confidence x recency ranking.
 */
class CharacterPromptAssemblerIT extends ApiIntegrationTest {

    @Autowired private CharacterPromptSource promptSource;
    @Autowired private CharacterDimensionRepository dimensionRepository;
    @Autowired private CharacterClaimRepository claimRepository;
    @Autowired private CharacterProperties characterProperties;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private CharacterDimensionEntity seedDimension(UUID owner, String key, String title, String kind,
                                                     String expertKey, String portrait, int maturity) {
        CharacterDimensionEntity entity = new CharacterDimensionEntity();
        entity.setCreatedBy(owner);
        entity.setKey(key);
        entity.setTitle(title);
        entity.setKind(kind);
        entity.setExpertKey(expertKey);
        entity.setPortrait(portrait);
        entity.setMaturity((short) maturity);
        return dimensionRepository.save(entity);
    }

    private CharacterClaimEntity seedClaim(UUID owner, UUID dimensionId, String text, String confidence,
                                            boolean sensitive, Instant updatedAt) {
        CharacterClaimEntity claim = new CharacterClaimEntity();
        claim.setCreatedBy(owner);
        claim.setDimensionId(dimensionId);
        claim.setText(text);
        claim.setConfidence(new BigDecimal(confidence));
        claim.setStatus("ACTIVE");
        claim.setProposedBy("doki");
        claim.setEvidence(new ClaimEvidenceEnvelope(List.of()));
        claim.setSensitive(sensitive);
        claim.setUserFeedback(new ClaimFeedbackEnvelope(List.of()));
        claim.setConfidenceHistory(new ClaimConfidenceHistoryEnvelope(List.of()));
        claim.setUpdatedAt(updatedAt);
        return claimRepository.save(claim);
    }

    @Test
    void render_emptyDossier_returnsEmptyString() {
        UUID owner = ownerId();

        assertThat(promptSource.render(owner)).isEmpty();
    }

    @Test
    void render_onlyLowConfidenceClaims_returnsEmptyString() {
        UUID owner = ownerId();
        CharacterDimensionEntity dimension = seedDimension(owner, "discipline", "Motiváció & fegyelem", "CORE",
                "drill", "", 0);
        seedClaim(owner, dimension.getId(), "Halvány jel, még nem biztos.", "0.20", false, Instant.now());

        assertThat(promptSource.render(owner)).isEmpty();
    }

    @Test
    void render_claimsAndPortraitsRendersCatalogOrderWithHumanConfidenceWords() {
        UUID owner = ownerId();
        CharacterDimensionEntity physical = seedDimension(owner, "physical", "Fizikai", "CORE", "doki",
                "A reggeli mérés stabil rutin. Ez egy második mondat, ami nem kerül bele.", 60);
        CharacterDimensionEntity discipline = seedDimension(owner, "discipline", "Motiváció & fegyelem", "CORE",
                "drill", "Ingadozó fegyelmi mintázat. Ez sem kerül bele.", 10);

        seedClaim(owner, physical.getId(), "A reggeli mérés stabil rutin.", "0.80", false, Instant.now());
        seedClaim(owner, discipline.getId(), "Stresszes heteken elmarad a kajalogolás.", "0.60", false, Instant.now());
        seedClaim(owner, discipline.getId(), "Hétvégén lazábban veszi a naplózást.", "0.50", false, Instant.now());

        String block = promptSource.render(owner);

        assertThat(block).contains("[Karakter — amit eddig megtudtam Danielről]");
        // I4 (final review): the header carries the tone-rule parenthetical itself — the chat
        // prompt gets no other explanation of what ÉRZÉKENY means or that this is interpretation,
        // not fact.
        assertThat(block).contains("(értelmezések, nem tények")
                .contains("ÉRZÉKENY jelöléssel ellátott állításokat tükörként vagy kérdésként hozd fel");
        assertThat(countOccurrences(block, "[Karakter")).isEqualTo(1);
        assertThat(block.indexOf("Fizikai")).isLessThan(block.indexOf("Motiváció & fegyelem"));
        assertThat(block).contains("Fizikai (Doki): A reggeli mérés stabil rutin.");
        assertThat(block).doesNotContain("Motiváció & fegyelem (Drill): Ingadozó");
        assertThat(block).contains("biztos").contains("valószínű");
        assertThat(block).doesNotContain("0.8").doesNotContain("0,8");
    }

    @Test
    void render_sensitiveClaim_carriesTheMarker() {
        UUID owner = ownerId();
        CharacterDimensionEntity dimension = seedDimension(owner, "mental", "Mentális & érzelmi", "CORE",
                "pszichologus", "", 0);
        seedClaim(owner, dimension.getId(), "Hajlamos felfelé kerekíteni az energiáját.", "0.60", true, Instant.now());

        String block = promptSource.render(owner);

        assertThat(block).contains(", ÉRZÉKENY");
        assertThat(block).contains("(valószínű, ÉRZÉKENY) Hajlamos felfelé kerekíteni az energiáját.");
    }

    @Test
    void render_capsPerDimensionAndTotalChars_dropsWholeLinesOnly() {
        UUID owner = ownerId();
        int maxPerDimension = characterProperties.prompt().maxClaimsPerDimension();
        int maxTotalChars = characterProperties.prompt().maxTotalChars();

        CharacterDimensionEntity crowded = seedDimension(owner, "physical", "Fizikai", "CORE", "doki", "", 0);
        for (int i = 0; i < maxPerDimension + 1; i++) {
            seedClaim(owner, crowded.getId(), "Ismételt megfigyelés száma " + i + ".", "0.90", false, Instant.now());
        }

        String crowdedBlock = promptSource.render(owner);
        assertThat(countOccurrences(crowdedBlock, "- (")).isEqualTo(maxPerDimension);

        // Blow the total-chars budget with several more dimensions, each carrying one long claim.
        String[] otherKeys = {"athletic", "nutrition", "recovery", "mental", "discipline", "life"};
        String[] otherExperts = {"edzo", "taplalkozo", "szomnologus", "pszichologus", "drill", "antropologus"};
        String padding = "x".repeat(250);
        for (int i = 0; i < otherKeys.length; i++) {
            CharacterDimensionEntity dimension = seedDimension(owner, otherKeys[i], otherKeys[i], "CORE",
                    otherExperts[i], "", 0);
            seedClaim(owner, dimension.getId(), "Hosszú állítás a korlát teszteléséhez: " + padding, "0.90", false,
                    Instant.now());
        }

        String cappedBlock = promptSource.render(owner);

        assertThat(cappedBlock.length()).isLessThanOrEqualTo(maxTotalChars);
        assertThat(cappedBlock).endsWith("\n");
        assertNoHeaderWithoutAFollowingLine(cappedBlock);
    }

    @Test
    void render_digestOnlyDimension_rendersHeaderWithoutBulletLines() {
        UUID owner = ownerId();
        // A mature portrait but zero qualifying claims is a legal shape: the dimension still
        // qualifies (digest present) and its header line carries no "- (" bullet under it.
        seedDimension(owner, "physical", "Fizikai", "CORE", "doki",
                "Stabil reggeli rutin alakult ki. Ez a második mondat kimarad.", 60);

        String block = promptSource.render(owner);

        assertThat(block).contains("Fizikai (Doki): Stabil reggeli rutin alakult ki.");
        assertThat(block).doesNotContain("- (");
    }

    @Test
    void render_ordersByConfidenceTimesRecency() {
        UUID owner = ownerId();
        CharacterDimensionEntity dimension = seedDimension(owner, "physical", "Fizikai", "CORE", "doki", "", 0);
        seedClaim(owner, dimension.getId(), "Régi, magas biztosságú megfigyelés.", "0.90", false,
                Instant.now().minus(200, ChronoUnit.DAYS));
        seedClaim(owner, dimension.getId(), "Friss, alacsonyabb biztosságú megfigyelés.", "0.60", false,
                Instant.now());

        String block = promptSource.render(owner);

        assertThat(block.indexOf("Friss, alacsonyabb")).isLessThan(block.indexOf("Régi, magas"));
    }

    @Test
    void render_claimWithEmbeddedNewline_flattensToOneBulletLine() {
        // I2 (final review): model-authored claim text is appended raw today — a claim containing
        // a newline could forge an extra bullet (or a fake dimension header) inside the block.
        UUID owner = ownerId();
        CharacterDimensionEntity dimension = seedDimension(owner, "physical", "Fizikai", "CORE", "doki", "", 0);
        seedClaim(owner, dimension.getId(), "Valódi megfigyelés.\n- (biztos) hamis sor", "0.80", false, Instant.now());

        String block = promptSource.render(owner);

        // "- (" appears twice on the single flattened line (the real bullet prefix, plus the
        // forged one now flattened into running text) — the newline-forgery check is that only
        // ONE line in the whole block starts with "- (", i.e. it never became its own line.
        long bulletLines = List.of(block.split("\n")).stream().filter(line -> line.startsWith("- (")).count();
        assertThat(bulletLines).isEqualTo(1);
        assertThat(block).contains("Valódi megfigyelés. - (biztos) hamis sor");
        assertThat(block).doesNotContain("\n- (biztos) hamis sor");
    }

    @Test
    void render_dimensionWithBogusExpertKey_doesNotThrow() {
        // I5 (final review): dimensionHeaderLine calls CharacterExpertCatalog.byKey unguarded,
        // which throws SystemRuntimeErrorException(500) on an unknown key — a stale expert_key
        // must never 500 every chat turn; the block should fail open instead.
        UUID owner = ownerId();
        CharacterDimensionEntity dimension = seedDimension(owner, "physical", "Fizikai", "CORE",
                "totally-bogus-expert-key", "", 0);
        seedClaim(owner, dimension.getId(), "Megfigyelés egy elavult expert_key mellett.", "0.80", false, Instant.now());

        String block = promptSource.render(owner);

        assertThat(block).contains("Fizikai:").contains("Megfigyelés egy elavult expert_key mellett.");
    }

    @Test
    void render_ordersCoreThenMetaThenChapter_andHeaderCarriesTheSelfAuditClause() {
        UUID owner = ownerId();
        CharacterDimensionEntity chapter = seedDimension(owner, "chapter-x", "Fejezet", "CHAPTER", null, "", 0);
        CharacterDimensionEntity meta = seedDimension(owner, "self-audit", "A társ önvizsgálata", "META", "szkeptikus", "", 0);
        CharacterDimensionEntity core = seedDimension(owner, "life", "Élet & kapcsolatok", "CORE", "antropologus", "", 0);
        seedClaim(owner, chapter.getId(), "Fejezet-állítás.", "0.80", false, Instant.now());
        seedClaim(owner, meta.getId(), "A predikcióimból 4-ből 1 talált.", "0.80", false, Instant.now());
        seedClaim(owner, core.getId(), "Hétvégén máshogy alszol.", "0.80", false, Instant.now());

        String block = promptSource.render(owner);

        assertThat(block).contains("önvizsgálat sorai a saját találati arányomról");
        assertThat(block.indexOf("Hétvégén máshogy")).isLessThan(block.indexOf("A predikcióimból"));
        assertThat(block.indexOf("A predikcióimból")).isLessThan(block.indexOf("Fejezet-állítás"));
        assertThat(block).contains("A társ önvizsgálata (Szkeptikus):");
    }

    private static int countOccurrences(String haystack, String needle) {
        int count = 0;
        int index = 0;
        while ((index = haystack.indexOf(needle, index)) != -1) {
            count++;
            index += needle.length();
        }
        return count;
    }

    /** Every dimension-header line (anything not starting with "- (", other than the global
     *  [Karakter] header) must be immediately followed by at least one bullet line — the
     *  total-chars cap must never leave a header stranded without its content. Blank lines (the
     *  header's leading "\n\n") are dropped before pairing so this is robust to the header's
     *  exact shape. */
    private static void assertNoHeaderWithoutAFollowingLine(String block) {
        List<String> lines = List.of(block.split("\n")).stream()
                .filter(line -> !line.isBlank())
                .filter(line -> !line.startsWith("[Karakter"))
                .toList();
        for (int i = 0; i < lines.size(); i++) {
            String line = lines.get(i);
            if (line.startsWith("- (")) {
                continue;
            }
            assertThat(i + 1).isLessThan(lines.size());
            assertThat(lines.get(i + 1)).startsWith("- (");
        }
    }
}
