package io.mrkuhne.mezo.feature.penz.service.engine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

import io.mrkuhne.mezo.feature.penz.service.engine.CategoryBudgets.BudgetRow;
import io.mrkuhne.mezo.feature.penz.service.engine.CategoryBudgets.BudgetTxn;
import io.mrkuhne.mezo.feature.penz.service.engine.CategoryBudgets.CategoryInput;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * Ported 1:1 from the old app's {@code src/features/plan/budgets.test.ts} — the two "category budgets" cases (Boop
 * Pénz L4, mezo-r36n9.102). The two {@code upcomingOverrides} cases are not ported: that is a display list of the
 * Terv screen built from the settings the API already returns (iOS, L5). Order: the old default order is the
 * server's seeded {@code position}, so Élelmiszer (Groceries, position 0) comes before Étterem (Dining out, 1).
 */
class PenzCategoryBudgetsTest {

    private static final UUID C1 = UUID.fromString("00000000-0000-0000-0000-0000000000c1");
    private static final UUID C2 = UUID.fromString("00000000-0000-0000-0000-0000000000c2");
    private static final UUID C3 = UUID.fromString("00000000-0000-0000-0000-0000000000c3");
    private static final CategoryInput DINING = new CategoryInput(C1, "Étterem", true, 6_000_000L, 1);
    private static final CategoryInput GROCERIES = new CategoryInput(C2, "Élelmiszer", true, null, 0);
    private static final CategoryInput SALARY = new CategoryInput(C3, "Fizetés", false, null, 12);
    private static final YearMonth DEC = YearMonth.of(2026, 12);
    private static final Map<YearMonth, Map<UUID, Long>> OVERRIDES = Map.of(DEC, Map.of(C1, 2_000_000L));

    @Test
    void overrideWinsOnlyInItsMonth() {
        assertThat(CategoryBudgets.effectiveBudget(DINING, OVERRIDES, DEC)).isEqualTo(2_000_000L);
        assertThat(CategoryBudgets.effectiveBudget(DINING, OVERRIDES, YearMonth.of(2026, 11))).isEqualTo(6_000_000L);
    }

    @Test
    void rows() {
        List<BudgetRow> rows = CategoryBudgets.rows(List.of(DINING, GROCERIES, SALARY), List.of(
            new BudgetTxn(C1, TxnKind.EXPENSE, 1_500_000L, LocalDate.of(2026, 12, 3)),
            new BudgetTxn(C1, TxnKind.EXPENSE, 9L, LocalDate.of(2026, 11, 30)),
            new BudgetTxn(C1, TxnKind.EXPENSE, 700L, LocalDate.of(2026, 12, 4))), // recurring-linked counts too
            OVERRIDES, DEC);
        assertThat(rows).extracting(r -> r.category().name(), BudgetRow::budgetMinor, BudgetRow::monthOnly,
                BudgetRow::spentMinor, BudgetRow::leftMinor)
            .containsExactly(tuple("Élelmiszer", null, false, 0L, null),
                tuple("Étterem", 2_000_000L, true, 1_500_700L, 499_300L));
    }
}
