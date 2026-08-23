package io.mrkuhne.mezo.feature.companion;

import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.feature.companion.entity.RecalledMemoriesEnvelope;
import io.mrkuhne.mezo.feature.companion.repository.MemoryEmbeddingRepository;
import io.mrkuhne.mezo.feature.companion.service.PromptMemoryAssembler;
import io.mrkuhne.mezo.feature.companion.service.PromptMemoryAssembler.AmbientRecall;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * W3.2 recall shadowing (mezo-b3pp.13, spec §7.2): beyond the coverage cutoff the ladder's weekly
 * rung answers for the stretch instead of a stray old day — while the fine-grained row and its
 * vector stay exactly where they were (nothing is ever deleted).
 */
@Transactional
@ActiveProfiles("companion-fake")
class PromptMemoryAssemblerShadowIT extends AbstractIntegrationTest {

    private static final String AXIS0_QUERY = "[fake-embed:1] hogy ment a hosszú futás?";
    private static final LocalDate TODAY = LocalDate.now();

    @Autowired private PromptMemoryAssembler assembler;
    @Autowired private MemoryEmbeddingPopulator memoryEmbeddingPopulator;
    @Autowired private MemoryEmbeddingRepository memoryEmbeddingRepository;
    @Autowired private UserPopulator userPopulator;

    private void seed(UUID owner, String kind, String content, LocalDate day) {
        memoryEmbeddingPopulator.embedding(owner, kind, UUID.randomUUID(), content, day,
                MemoryEmbeddingPopulator.axisVector(0));
    }

    @Test
    void testRecall_shouldShadowOldDailyHitWithItsWeeklyRung_whenBeyondCoverageCutoff() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate oldDay = TODAY.minusDays(60);
        seed(owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, "Régi nap: hosszú futás.", oldDay);
        seed(owner, MemoryEmbeddingEntity.KIND_WEEKLY_SUMMARY, "Az a hét: sok futás, jó alvás.",
                oldDay.minusDays(2));

        AmbientRecall recalled = assembler.recall(owner, UUID.randomUUID(), AXIS0_QUERY, TODAY);

        assertThat(recalled.block()).contains("(heti összefoglaló): Az a hét: sok futás, jó alvás.");
        assertThat(recalled.block()).doesNotContain("Régi nap");
        assertThat(recalled.items()).extracting(RecalledMemoriesEnvelope.Item::kind)
                .containsExactly(MemoryEmbeddingEntity.KIND_WEEKLY_SUMMARY);
        // shadowed, NOT deleted (spec §12): the fine-grained vector is still in the store
        assertThat(memoryEmbeddingRepository.countByCreatedByAndKind(
                owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY)).isEqualTo(1);
    }

    @Test
    void testRecall_shouldStillCarryRecentDays_whenInsideCoverageCutoff() {
        UUID owner = userPopulator.createUser().getId();
        seed(owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, "Tegnapelőtti nap: hosszú futás.",
                TODAY.minusDays(2));

        AmbientRecall recalled = assembler.recall(owner, UUID.randomUUID(), AXIS0_QUERY, TODAY);

        assertThat(recalled.block()).contains("(napi összefoglaló): Tegnapelőtti nap: hosszú futás.");
    }

    @Test
    void testRecall_shouldRenderMonthlyRung_whenOnlyTheMonthlyLadderCoversTheStretch() {
        UUID owner = userPopulator.createUser().getId();
        seed(owner, MemoryEmbeddingEntity.KIND_MONTHLY_SUMMARY, "Az a hónap: alapozás.",
                TODAY.minusDays(200));

        AmbientRecall recalled = assembler.recall(owner, UUID.randomUUID(), AXIS0_QUERY, TODAY);

        assertThat(recalled.block()).contains("(havi összefoglaló): Az a hónap: alapozás.");
    }

    @Test
    void testRecall_shouldCapPeriodRungs_whenMoreRungsMatchThanTheCapAllows() {
        UUID owner = userPopulator.createUser().getId();
        for (int week = 1; week <= 4; week++) {
            seed(owner, MemoryEmbeddingEntity.KIND_WEEKLY_SUMMARY, "Hét #" + week,
                    TODAY.minusWeeks(week + 6L));
        }

        AmbientRecall recalled = assembler.recall(owner, UUID.randomUUID(), AXIS0_QUERY, TODAY);

        // period-summary.cap = 2: the two freshest rungs win (decayed score)
        assertThat(recalled.items()).extracting(RecalledMemoriesEnvelope.Item::gist)
                .containsExactly("Hét #1", "Hét #2");
    }
}
