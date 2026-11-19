package io.mrkuhne.mezo.feature.penz.service.engine;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.penz.service.engine.AccountRules.AccountPatch;
import io.mrkuhne.mezo.feature.penz.service.engine.AccountRules.AccountPlan;
import io.mrkuhne.mezo.feature.penz.service.engine.AccountRules.AccountState;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * Ported 1:1 from the old app's {@code src/features/accounts/accountRules.test.ts} — {@code planAccountSave}, 14
 * cases (Boop Pénz L4, mezo-r36n9.102). The two {@code healAccounts} cases are not ported: the server's partial
 * unique indexes make several defaults / savings targets impossible, so there is nothing to heal.
 */
class PenzAccountRulesTest {

    private static UUID id(String name) {
        return UUID.nameUUIDFromBytes(name.getBytes(StandardCharsets.UTF_8));
    }

    /** Old {@code acc}: checking, no flags, not archived. */
    private static AccountState acc(String name) {
        return new AccountState(id(name), "checking", false, false, false);
    }

    private static AccountState savings(String name, boolean target) {
        return new AccountState(id(name), "savings", false, false, target);
    }

    private static AccountState with(AccountState a, boolean archived, boolean isDefault) {
        return new AccountState(a.id(), a.type(), archived, isDefault, a.isSavingsTarget());
    }

    /** Old {@code draft}: a new checking account (id null unless given). */
    private static AccountState draft(String type, boolean archived, boolean isDefault, boolean target) {
        return new AccountState(null, type, archived, isDefault, target);
    }

    private static AccountState draft(String name, String type, boolean archived, boolean isDefault, boolean target) {
        return new AccountState(id(name), type, archived, isDefault, target);
    }

    @Test
    void firstAccountBecomesDefault() {
        assertThat(AccountRules.planSave(List.of(), draft("checking", false, false, false)).isDefault()).isTrue();
    }

    @Test
    void newDefaultClearsTheOldDefault() {
        AccountPlan r = AccountRules.planSave(List.of(with(acc("a"), false, true)), draft("checking", false, true, false));
        assertThat(r.isDefault()).isTrue();
        assertThat(r.patches()).containsExactly(new AccountPatch(id("a"), false, null));
    }

    @Test
    void nonDefaultSaveKeepsTheExistingDefault() {
        AccountPlan r = AccountRules.planSave(List.of(with(acc("a"), false, true)), draft("checking", false, false, false));
        assertThat(r.isDefault()).isFalse();
        assertThat(r.patches()).isEmpty();
    }

    @Test
    void untickingTheOnlyDefaultKeepsItDefault() {
        assertThat(AccountRules.planSave(List.of(acc("a")), draft("checking", false, false, false)).isDefault()).isTrue();
    }

    @Test
    void firstSavingsAccountGetsTheSavingsTarget() {
        assertThat(AccountRules.planSave(List.of(with(acc("a"), false, true)), draft("savings", false, false, false))
            .isSavingsTarget()).isTrue();
    }

    @Test
    void secondSavingsAccountDoesNotTakeTheTarget() {
        AccountPlan r = AccountRules.planSave(List.of(savings("s", true)), draft("savings", false, false, false));
        assertThat(r.isSavingsTarget()).isFalse();
        assertThat(r.patches()).isEmpty();
    }

    @Test
    void movingTheTargetClearsTheOldOne() {
        AccountPlan r = AccountRules.planSave(List.of(savings("s", true)), draft("savings", false, false, true));
        assertThat(r.isSavingsTarget()).isTrue();
        assertThat(r.patches()).containsExactly(new AccountPatch(id("s"), null, false));
    }

    @Test
    void nonSavingsAccountNeverHoldsTheTarget() {
        assertThat(AccountRules.planSave(List.of(), draft("checking", false, false, true)).isSavingsTarget()).isFalse();
    }

    @Test
    void changingTheTargetAwayFromSavingsPromotesAnotherSavingsAccount() {
        AccountPlan r = AccountRules.planSave(List.of(savings("s2", false)), draft("s1", "checking", false, false, false));
        assertThat(r.patches()).containsExactly(new AccountPatch(id("s2"), null, true));
    }

    @Test
    void aLoneSavingsAccountStaysTargetWhenEdited() {
        assertThat(AccountRules.planSave(List.of(), draft("s", "savings", false, false, false)).isSavingsTarget())
            .isTrue();
    }

    @Test
    void archivingTheDefaultPromotesTheFirstNonArchivedAccount() {
        AccountPlan r = AccountRules.planSave(List.of(with(acc("x"), true, false), acc("b")),
            draft("a", "checking", true, true, false));
        assertThat(r.isDefault()).isFalse();
        assertThat(r.patches()).containsExactly(new AccountPatch(id("b"), true, null));
    }

    @Test
    void archivingTheSavingsTargetPromotesAnotherActiveSavingsAccount() {
        AccountPlan r = AccountRules.planSave(List.of(with(acc("c"), false, true), savings("s2", false)),
            draft("s1", "savings", true, false, true));
        assertThat(r.isSavingsTarget()).isFalse();
        assertThat(r.patches()).containsExactly(new AccountPatch(id("s2"), null, true));
    }

    @Test
    void archivingTheOnlyActiveAccountIsRefused() {
        AccountPlan r = AccountRules.planSave(List.of(with(acc("x"), true, false)),
            draft("a", "checking", true, false, false));
        assertThat(r.refused()).isTrue();
    }

    @Test
    void archivingANonDefaultAccountChangesNothingElse() {
        AccountPlan r = AccountRules.planSave(List.of(with(acc("a"), false, true)),
            draft("b", "checking", true, false, false));
        assertThat(r.patches()).isEmpty();
        assertThat(r.refused()).isFalse();
    }
}
