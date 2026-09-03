package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.groups.Tuple.tuple;

import io.mrkuhne.mezo.feature.companion.entity.DayReviewEntity;
import io.mrkuhne.mezo.feature.companion.entity.DayReviewJson;
import io.mrkuhne.mezo.feature.companion.repository.DayReviewRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.DayReviewPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

/**
 * Storage proof for {@code day_review} (mezo-jcpt.4 task 6) — the LLM prose cache envelope
 * round-trips through {@code @JdbcTypeCode(SqlTypes.JSON)} intact (nullable {@code adjustment}
 * included), {@code findByCreatedByAndDate} hits/misses correctly, and the partial
 * {@code unique(created_by, date)} index (soft-delete aware, the {@code weekly_score} precedent)
 * actually rejects a live duplicate.
 */
@Transactional
class DayReviewRepositoryIT extends AbstractIntegrationTest {

    private static final LocalDate DAY = LocalDate.of(2026, 9, 1);

    @Autowired private DayReviewRepository dayReviewRepository;
    @Autowired private DayReviewPopulator dayReviewPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testSave_shouldRoundTripEnvelope_whenPersistedViaJpa() {
        UUID owner = userPopulator.createUser().getId();
        DayReviewJson envelope = new DayReviewJson(
            List.of("Első bekezdés.", "Második bekezdés."),
            Map.of("nutrition", "Jó fehérjebevitel.", "sleep", "Kicsit kevés alvás."),
            List.of(
                new DayReviewJson.Highlight("key", "Fehérje cél teljesítve"),
                new DayReviewJson.Highlight("win", "Edzés bepipálva")),
            null, // nullable adjustment — must round-trip as null, not vanish or NPE
            List.of(new DayReviewJson.ContextSignal("streak", "5 nap")));
        DayReviewEntity entity = new DayReviewEntity();
        entity.setCreatedBy(owner);
        entity.setDate(DAY);
        entity.setEnvelope(envelope);
        entity.setInputsHash("a".repeat(64));
        entity.setComputedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));

        DayReviewEntity saved = dayReviewRepository.saveAndFlush(entity);

        DayReviewEntity reloaded = dayReviewRepository.findById(saved.getId()).orElseThrow();
        assertThat(reloaded.getDate()).isEqualTo(DAY);
        assertThat(reloaded.getInputsHash()).isEqualTo("a".repeat(64));
        assertThat(reloaded.getEnvelope().narrative()).containsExactly("Első bekezdés.", "Második bekezdés.");
        assertThat(reloaded.getEnvelope().dimensionNotes())
            .containsEntry("nutrition", "Jó fehérjebevitel.")
            .containsEntry("sleep", "Kicsit kevés alvás.");
        assertThat(reloaded.getEnvelope().highlights()).extracting(DayReviewJson.Highlight::kind, DayReviewJson.Highlight::label)
            .containsExactly(
                tuple("key", "Fehérje cél teljesítve"),
                tuple("win", "Edzés bepipálva"));
        assertThat(reloaded.getEnvelope().adjustment()).isNull();
        assertThat(reloaded.getEnvelope().context()).extracting(DayReviewJson.ContextSignal::label, DayReviewJson.ContextSignal::value)
            .containsExactly(tuple("streak", "5 nap"));
    }

    @Test
    void testSave_shouldRoundTripAdjustment_whenPresent() {
        UUID owner = userPopulator.createUser().getId();
        DayReviewJson envelope = new DayReviewJson(
            List.of("Bekezdés."), Map.of(), List.of(),
            new DayReviewJson.Adjustment(3, "Kiemelkedő edzés"),
            List.of());
        DayReviewEntity entity = new DayReviewEntity();
        entity.setCreatedBy(owner);
        entity.setDate(DAY);
        entity.setEnvelope(envelope);
        entity.setInputsHash("b".repeat(64));
        entity.setComputedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        DayReviewEntity saved = dayReviewRepository.saveAndFlush(entity);

        DayReviewEntity reloaded = dayReviewRepository.findById(saved.getId()).orElseThrow();

        assertThat(reloaded.getEnvelope().adjustment()).isEqualTo(new DayReviewJson.Adjustment(3, "Kiemelkedő edzés"));
    }

    @Test
    void testFindByCreatedByAndDate_shouldReturnRow_whenPresent() {
        UUID owner = userPopulator.createUser().getId();
        Instant computedAt = Instant.now().truncatedTo(ChronoUnit.MICROS);
        DayReviewEntity created = dayReviewPopulator.dayReview(owner, DAY, "c".repeat(64), computedAt);

        Optional<DayReviewEntity> found = dayReviewRepository.findByCreatedByAndDate(owner, DAY);

        assertThat(found).isPresent();
        assertThat(found.get().getId()).isEqualTo(created.getId());
        assertThat(found.get().getComputedAt()).isEqualTo(computedAt);
    }

    @Test
    void testFindByCreatedByAndDate_shouldReturnEmpty_whenNoRowForThatDay() {
        UUID owner = userPopulator.createUser().getId();
        dayReviewPopulator.dayReview(owner, DAY, "d".repeat(64), Instant.now().truncatedTo(ChronoUnit.MICROS));

        Optional<DayReviewEntity> found = dayReviewRepository.findByCreatedByAndDate(owner, DAY.plusDays(1));

        assertThat(found).isEmpty();
    }

    @Test
    void testFindByCreatedByAndDate_shouldReturnEmpty_whenOtherUsersRow() {
        UUID owner = userPopulator.createUser().getId();
        UUID other = userPopulator.createUser().getId();
        dayReviewPopulator.dayReview(other, DAY, "e".repeat(64), Instant.now().truncatedTo(ChronoUnit.MICROS));

        Optional<DayReviewEntity> found = dayReviewRepository.findByCreatedByAndDate(owner, DAY);

        assertThat(found).isEmpty();
    }

    @Test
    void testSave_shouldRejectDuplicate_whenSameCreatedByAndDate() {
        UUID owner = userPopulator.createUser().getId();
        dayReviewPopulator.dayReview(owner, DAY, "f".repeat(64), Instant.now().truncatedTo(ChronoUnit.MICROS));

        assertThatThrownBy(() ->
            dayReviewPopulator.dayReview(owner, DAY, "g".repeat(64), Instant.now().truncatedTo(ChronoUnit.MICROS)))
            .isInstanceOf(DataIntegrityViolationException.class);
    }
}
