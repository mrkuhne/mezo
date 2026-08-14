package io.mrkuhne.mezo.feature.ritual;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.catchThrowable;

import io.mrkuhne.mezo.feature.ritual.entity.RitualDayEntity;
import io.mrkuhne.mezo.feature.ritual.repository.RitualDayRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * REPRO ONLY (mezo-5jly) — pins the MECHANISM the shipped race-guard relies on.
 *
 * <p>Three services (RitualService.insertOrReread, HabitService.ensureRows,
 * QuestService.getDay) all use the same shape inside a single {@code @Transactional}
 * method: {@code saveAndFlush} → catch {@code DataIntegrityViolationException} →
 * re-read in the SAME transaction, intending an idempotent result for the race loser.
 *
 * <p>The bug report (found by code review, never reproduced) claims this cannot work on
 * Postgres: the constraint violation aborts the transaction (SQLSTATE 25P02), so the
 * re-read throws and the caller gets a 500 instead of the intended 200.
 *
 * <p>This test asserts what ACTUALLY happens, so the fix is aimed at a verified fact
 * rather than a plausible theory. It deliberately does not use the services — it isolates
 * the primitive they are built on.
 */
class TxRaceGuardReproIT extends AbstractIntegrationTest {

    @Autowired private UserPopulator userPopulator;
    @Autowired private RitualDayRepository ritualDayRepository;
    @Autowired private TransactionTemplate txTemplate;

    private RitualDayEntity row(UUID owner, LocalDate date) {
        RitualDayEntity e = new RitualDayEntity();
        e.setCreatedBy(owner);
        e.setRitualDate(date);
        e.setClosedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        return e;
    }

    /**
     * The retired guard's exact shape: duplicate insert, catch, re-read — all in ONE transaction.
     * It CANNOT recover, and this pins why, so nobody reintroduces the pattern.
     *
     * <p>Note what the error names: the statement that fails is the INSERT, not the SELECT. The
     * persistence context still holds the failed entity, so the re-read's auto-flush re-issues
     * the insert on the already-aborted connection before the select ever runs. That makes the
     * failure broader than "this one table cannot be read" — in the catch block, ANY repository
     * call fails. Hence the fix is a database-level {@code ON CONFLICT DO NOTHING}, not a smarter
     * catch.
     */
    @Test
    void testCatchAndReread_shouldFailWithAnAbortedTransaction_whenDoneInTheSameTransaction() {
        UUID owner = userPopulator.createUser("txrace-a@test.hu").getId();
        LocalDate date = LocalDate.now();

        // Committed row = the race winner's work, already visible.
        txTemplate.executeWithoutResult(s -> ritualDayRepository.saveAndFlush(row(owner, date)));

        // The race loser's transaction, reproducing the retired insertOrReread verbatim.
        Throwable thrown = catchThrowable(() -> txTemplate.executeWithoutResult(s -> {
            try {
                ritualDayRepository.saveAndFlush(row(owner, date));
            } catch (DataIntegrityViolationException expected) {
                // the retired guard's catch block — recovery attempt inside the aborted tx
                ritualDayRepository.findByCreatedByAndRitualDate(owner, date).orElseThrow();
            }
        }));

        assertThat(thrown)
            .as("recovery inside the aborted transaction is impossible — this is why the guard "
                + "was replaced by an ON CONFLICT insert (mezo-5jly)")
            .isNotNull()
            .hasMessageContaining("current transaction is aborted");
    }

    /**
     * The replacement primitive: {@code ON CONFLICT DO NOTHING} absorbs the duplicate, so no
     * violation is raised, the transaction stays usable, and the SAME-tx re-read that the retired
     * guard could not perform now works — which is exactly what makes the service idempotent.
     */
    @Test
    void testInsertIfAbsent_shouldReportZeroAndLeaveTheTxUsable_whenTheRowAlreadyExists() {
        UUID owner = userPopulator.createUser("txrace-c@test.hu").getId();
        LocalDate date = LocalDate.now();

        txTemplate.executeWithoutResult(s -> ritualDayRepository.saveAndFlush(row(owner, date)));

        Optional<RitualDayEntity> reread = txTemplate.execute(s -> {
            int inserted = ritualDayRepository.insertIfAbsent(
                owner, date, Instant.now().truncatedTo(ChronoUnit.MICROS), Instant.now());
            assertThat(inserted).as("a duplicate inserts no row").isZero();
            // the read the retired guard could never reach
            return ritualDayRepository.findByCreatedByAndRitualDate(owner, date);
        });

        assertThat(reread).as("same-transaction re-read after an absorbed conflict").isPresent();
    }

    /**
     * The control: the same recovery from a SEPARATE transaction always works. If this
     * passes while the one above fails, the transaction boundary is the whole story —
     * which is what tells us the fix belongs at the tx/statement level, not in the catch.
     */
    @Test
    void testReread_inANewTransaction_shouldSucceed_afterAConstraintViolation() {
        UUID owner = userPopulator.createUser("txrace-b@test.hu").getId();
        LocalDate date = LocalDate.now();

        txTemplate.executeWithoutResult(s -> ritualDayRepository.saveAndFlush(row(owner, date)));

        assertThatThrownBy(() ->
            txTemplate.executeWithoutResult(s -> ritualDayRepository.saveAndFlush(row(owner, date))))
            .isInstanceOf(DataIntegrityViolationException.class);

        Optional<RitualDayEntity> reread =
            txTemplate.execute(s -> ritualDayRepository.findByCreatedByAndRitualDate(owner, date));
        assertThat(reread).as("re-read from a fresh transaction").isPresent();
    }
}
