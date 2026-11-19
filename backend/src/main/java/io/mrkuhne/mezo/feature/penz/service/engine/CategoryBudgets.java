package io.mrkuhne.mezo.feature.penz.service.engine;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Category budgets against the month's spending, a port of the old app's {@code src/features/plan/budgets.ts}
 * ({@code effectiveCategoryBudget}, {@code categoryBudgetRows}); HUF minor units. Not on the wire in L4 — the
 * allowance contract has no room for it; the Terv screen of L5 exposes it.
 */
public final class CategoryBudgets {

    private CategoryBudgets() {
    }

    /** A category as the budget rows read it; {@code monthlyBudgetMinor} null = no budget. */
    public record CategoryInput(UUID id, String name, boolean expense, Long monthlyBudgetMinor, int position) {
    }

    /** One transaction as the budget rows read it. */
    public record BudgetTxn(UUID categoryId, TxnKind kind, long amountHufMinor, LocalDate date) {
    }

    /** {@code leftMinor} is null when the category has no budget; {@code monthOnly} = the month's own budget. */
    public record BudgetRow(CategoryInput category, Long budgetMinor, boolean monthOnly, long spentMinor,
                            Long leftMinor) {
    }

    /**
     * The month's own budget for the category when set ({@code month_overrides[month].categoryBudgets[id]}), else
     * its monthly default (may be null).
     */
    public static Long effectiveBudget(CategoryInput category, Map<YearMonth, Map<UUID, Long>> overrides,
                                       YearMonth month) {
        Long own = overrides.getOrDefault(month, Map.of()).get(category.id());
        return own != null ? own : category.monthlyBudgetMinor();
    }

    /**
     * Expense categories only, by position then name (the old default order — the server seeds categories with
     * positions in that order); spent counts EVERY expense of the month with that category, recurring included.
     */
    public static List<BudgetRow> rows(List<CategoryInput> categories, List<BudgetTxn> txns,
                                       Map<YearMonth, Map<UUID, Long>> overrides, YearMonth month) {
        Map<UUID, Long> spent = new HashMap<>();
        for (BudgetTxn t : txns) {
            if (t.kind() != TxnKind.EXPENSE || t.categoryId() == null || !YearMonth.from(t.date()).equals(month)) {
                continue;
            }
            spent.merge(t.categoryId(), t.amountHufMinor(), Long::sum);
        }
        Map<UUID, Long> own = overrides.getOrDefault(month, Map.of());
        return categories.stream()
            .filter(CategoryInput::expense)
            .sorted(Comparator.comparingInt(CategoryInput::position).thenComparing(CategoryInput::name))
            .map(c -> {
                Long budget = effectiveBudget(c, overrides, month);
                long spentMinor = spent.getOrDefault(c.id(), 0L);
                return new BudgetRow(c, budget, own.containsKey(c.id()), spentMinor,
                    budget == null ? null : budget - spentMinor);
            })
            .toList();
    }
}
