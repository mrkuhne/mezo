package io.mrkuhne.mezo.feature.penz.service.engine;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * The one-default / one-savings-target rules of accounts, a port of the old app's
 * {@code src/features/accounts/accountRules.ts planAccountSave}: exactly one non-archived default account, and
 * exactly one savings target among the non-archived {@code savings} accounts. Pure — the caller persists.
 */
public final class AccountRules {

    public static final String TYPE_SAVINGS = "savings";

    private AccountRules() {
    }

    /** An account's flag-relevant state; {@code id} null for a new one. */
    public record AccountState(UUID id, String type, boolean archived, boolean isDefault, boolean isSavingsTarget) {
    }

    /** A flag change on another account; a null field leaves that flag alone. */
    public record AccountPatch(UUID id, Boolean isDefault, Boolean isSavingsTarget) {
    }

    /**
     * The saved account's resolved flags, the other accounts' flag changes, and {@code refused} when the save must
     * be refused (archiving the last non-archived account).
     */
    public record AccountPlan(boolean isDefault, boolean isSavingsTarget, List<AccountPatch> patches,
                              boolean refused) {
    }

    /**
     * Plans saving {@code draft} among {@code others} (every OTHER account of the owner, archived ones included, in
     * the order "first" means — the caller passes creation order).
     */
    public static AccountPlan planSave(List<AccountState> others, AccountState draft) {
        Map<UUID, Boolean[]> flags = new LinkedHashMap<>();
        List<AccountState> active = others.stream().filter(o -> !o.archived()).toList();
        if (draft.archived() && active.isEmpty()) {
            return new AccountPlan(draft.isDefault(), draft.isSavingsTarget(), List.of(), true);
        }
        boolean savedDefault = !draft.archived() && draft.isDefault();
        boolean savedTarget = !draft.archived() && draft.isSavingsTarget();

        // default
        if (savedDefault) {
            others.stream().filter(AccountState::isDefault).forEach(o -> set(flags, o.id(), 0, false));
        } else if (active.stream().noneMatch(AccountState::isDefault)) {
            if (draft.archived()) {
                others.stream().filter(AccountState::isDefault).forEach(o -> set(flags, o.id(), 0, false));
                set(flags, active.getFirst().id(), 0, true);
            } else {
                savedDefault = true;
            }
        }

        // savings target: only non-archived savings accounts can hold it
        List<AccountState> activeSavings = active.stream().filter(o -> TYPE_SAVINGS.equals(o.type())).toList();
        if (!TYPE_SAVINGS.equals(draft.type()) || draft.archived()) {
            savedTarget = false;
            if (!activeSavings.isEmpty() && activeSavings.stream().noneMatch(AccountState::isSavingsTarget)) {
                others.stream().filter(AccountState::isSavingsTarget).forEach(o -> set(flags, o.id(), 1, false));
                set(flags, activeSavings.getFirst().id(), 1, true);
            }
        } else if (savedTarget) {
            others.stream().filter(AccountState::isSavingsTarget).forEach(o -> set(flags, o.id(), 1, false));
        } else if (activeSavings.stream().noneMatch(AccountState::isSavingsTarget)) {
            savedTarget = true;
        }
        return new AccountPlan(savedDefault, savedTarget, toPatches(others, flags), false);
    }

    private static void set(Map<UUID, Boolean[]> flags, UUID id, int which, boolean value) {
        flags.computeIfAbsent(id, k -> new Boolean[2])[which] = value;
    }

    /** Only the flags that actually change, in {@code others} order (old {@code toPatches}). */
    private static List<AccountPatch> toPatches(List<AccountState> others, Map<UUID, Boolean[]> flags) {
        List<AccountPatch> out = new ArrayList<>();
        for (AccountState o : others) {
            Boolean[] f = flags.get(o.id());
            if (f == null) {
                continue;
            }
            Boolean d = f[0] != null && f[0] != o.isDefault() ? f[0] : null;
            Boolean t = f[1] != null && f[1] != o.isSavingsTarget() ? f[1] : null;
            if (d != null || t != null) {
                out.add(new AccountPatch(o.id(), d, t));
            }
        }
        return out;
    }
}
