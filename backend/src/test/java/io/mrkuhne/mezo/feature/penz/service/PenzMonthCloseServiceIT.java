package io.mrkuhne.mezo.feature.penz.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.PenzMonthCloseResponse;
import io.mrkuhne.mezo.feature.penz.entity.PenzAccountEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzTransactionEntity;
import io.mrkuhne.mezo.feature.penz.repository.PenzTransactionRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.PenzPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;

/**
 * Boop Pénz L4 (mezo-r36n9.102): the month-close mechanics with an already-computed remaining figure — the
 * figure itself comes from the allowance engine of a later phase. Amounts are invented.
 */
@Transactional
class PenzMonthCloseServiceIT extends AbstractIntegrationTest {

    @Autowired private PenzMonthCloseService service;
    @Autowired private PenzPopulator penz;
    @Autowired private DatabasePopulator db;
    @Autowired private PenzTransactionRepository transactions;

    private UUID owner;
    private YearMonth lastMonth;

    @BeforeEach
    void setUp() {
        owner = db.populateUser("penz-close-" + UUID.randomUUID() + "@test.local");
        lastMonth = YearMonth.from(LocalDate.now(ZoneId.of("Europe/Budapest"))).minusMonths(1);
    }

    @Test
    void aLeftoverTransferredWritesAPairIntoTheSavingsTarget() {
        PenzAccountEntity main = penz.account(owner, "Fő", true);
        PenzAccountEntity savings = penz.savingsAccount(owner, "Megtakarítás");

        PenzMonthCloseResponse close = service.closeWith(owner, lastMonth, "transferred", 3_450_000L);

        assertThat(close.getLeftoverAction()).isEqualTo(PenzMonthCloseResponse.LeftoverActionEnum.TRANSFERRED);
        assertThat(close.getFinalRemaining().getHufMinor()).isEqualTo(3_450_000L);
        assertThat(close.getDeficit().getHufMinor()).isZero();
        List<PenzTransactionEntity> legs = transactions.findByCreatedByAndTransferPairIdAndDeletedFalse(owner,
            close.getTransferPairId());
        assertThat(legs).hasSize(2).allSatisfy(t -> {
            assertThat(t.getAmountMinor()).isEqualTo(3_450_000L);
            assertThat(t.getAmountHufMinor()).isEqualTo(3_450_000L);
            assertThat(t.getDate()).isEqualTo(lastMonth.atEndOfMonth());
        });
        assertThat(legs).filteredOn(t -> t.getKind().equals("transfer_out")).singleElement()
            .satisfies(t -> assertThat(t.getAccountId()).isEqualTo(main.getId()));
        assertThat(legs).filteredOn(t -> t.getKind().equals("transfer_in")).singleElement()
            .satisfies(t -> assertThat(t.getAccountId()).isEqualTo(savings.getId()));

        assertThatThrownBy(() -> service.closeWith(owner, lastMonth, "kept", 1L))
            .isInstanceOfSatisfying(SystemRuntimeErrorException.class,
                e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    void aDeficitOrNothingLeftClosesAsNone() {
        PenzMonthCloseResponse deficit = service.closeWith(owner, lastMonth, "transferred", -1_200_000L);
        assertThat(deficit.getLeftoverAction()).isEqualTo(PenzMonthCloseResponse.LeftoverActionEnum.NONE);
        assertThat(deficit.getDeficit().getHufMinor()).isEqualTo(1_200_000L);
        assertThat(deficit.getTransferPairId()).isNull();

        PenzMonthCloseResponse zero = service.closeWith(owner, lastMonth.minusMonths(1), "kept", 0L);
        assertThat(zero.getLeftoverAction()).isEqualTo(PenzMonthCloseResponse.LeftoverActionEnum.NONE);
    }

    @Test
    void aKeptLeftoverWritesNoTransfer() {
        PenzMonthCloseResponse kept = service.closeWith(owner, lastMonth, "kept", 500_000L);
        assertThat(kept.getLeftoverAction()).isEqualTo(PenzMonthCloseResponse.LeftoverActionEnum.KEPT);
        assertThat(kept.getTransferPairId()).isNull();
        assertThat(transactions.findAllOwned(owner)).isEmpty();
    }

    @Test
    void aTransferWithoutASavingsTargetIs409() {
        penz.account(owner, "Fő", true);
        assertThatThrownBy(() -> service.closeWith(owner, lastMonth, "transferred", 500_000L))
            .isInstanceOfSatisfying(SystemRuntimeErrorException.class,
                e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.CONFLICT));
    }
}
