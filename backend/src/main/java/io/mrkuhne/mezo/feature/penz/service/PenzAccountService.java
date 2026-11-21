package io.mrkuhne.mezo.feature.penz.service;

import io.mrkuhne.mezo.api.dto.PenzAccountRequest;
import io.mrkuhne.mezo.api.dto.PenzAccountResponse;
import io.mrkuhne.mezo.feature.penz.entity.PenzAccountEntity;
import io.mrkuhne.mezo.feature.penz.mapper.PenzMapper;
import io.mrkuhne.mezo.feature.penz.repository.PenzAccountRepository;
import io.mrkuhne.mezo.feature.penz.repository.PenzRecurringRuleRepository;
import io.mrkuhne.mezo.feature.penz.repository.PenzTransactionRepository;
import io.mrkuhne.mezo.feature.penz.service.engine.AccountRules;
import io.mrkuhne.mezo.feature.penz.service.engine.AccountRules.AccountPatch;
import io.mrkuhne.mezo.feature.penz.service.engine.AccountRules.AccountPlan;
import io.mrkuhne.mezo.feature.penz.service.engine.AccountRules.AccountState;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Money accounts (Boop Pénz L4, mezo-r36n9.102). Every create, update and archive goes through
 * {@link AccountRules#planSave} (the old app's {@code planAccountSave}): exactly one non-archived default account
 * (the first account becomes it; unticking the only default keeps it; archiving the default promotes the first
 * non-archived account), and exactly one savings target among the non-archived savings accounts (the first
 * savings account takes it; a non-savings or archived account never holds it; losing it promotes another active
 * savings account). Archiving the last non-archived account is refused: 409 {@code PENZ_LAST_ACTIVE_ACCOUNT}.
 * "First" = creation order. Flags are written clear-first, so the partial unique indexes never see two holders.
 * <p>
 * The currency is locked once the account carries a live transaction or recurring rule: every row must be in its
 * account's currency ({@code PENZ_CURRENCY_MISMATCH}), so a later change would recreate the mismatch and make the
 * balances skip those rows — 409 {@code PENZ_ACCOUNT_CURRENCY_LOCKED} (mezo-r36n9.108).
 */
@Service
@RequiredArgsConstructor
public class PenzAccountService {

    private final PenzAccountRepository repository;
    private final PenzMapper mapper;
    private final PenzTransactionRepository transactions;
    private final PenzRecurringRuleRepository rules;

    @Transactional(readOnly = true)
    public List<PenzAccountResponse> list(UUID owner, boolean includeArchived) {
        List<PenzAccountEntity> rows = includeArchived
            ? repository.findByCreatedByAndDeletedFalseOrderByNameAsc(owner)
            : repository.findByCreatedByAndArchivedFalseAndDeletedFalseOrderByNameAsc(owner);
        return rows.stream()
            .sorted(Comparator.comparing((PenzAccountEntity a) -> !a.isDefaultAccount()))
            .map(mapper::toResponse)
            .toList();
    }

    @Transactional
    public PenzAccountResponse create(UUID owner, PenzAccountRequest req) {
        PenzAccountEntity row = new PenzAccountEntity();
        row.setCreatedBy(owner);
        apply(row, req);
        return mapper.toResponse(save(owner, row, Boolean.TRUE.equals(req.getIsDefault()),
            Boolean.TRUE.equals(req.getIsSavingsTarget())));
    }

    @Transactional
    public PenzAccountResponse update(UUID owner, UUID id, PenzAccountRequest req) {
        PenzAccountEntity row = require(owner, id);
        if (!row.getCurrency().equals(req.getCurrency())
            && (transactions.existsByAccountIdAndDeletedFalse(id) || rules.existsByAccountIdAndDeletedFalse(id))) {
            throw PenzErrors.conflict("PENZ_ACCOUNT_CURRENCY_LOCKED");
        }
        apply(row, req);
        row.setUpdatedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        return mapper.toResponse(save(owner, row, Boolean.TRUE.equals(req.getIsDefault()),
            Boolean.TRUE.equals(req.getIsSavingsTarget())));
    }

    @Transactional
    public PenzAccountResponse archive(UUID owner, UUID id) {
        PenzAccountEntity row = require(owner, id);
        row.setArchived(true);
        row.setUpdatedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        return mapper.toResponse(save(owner, row, row.isDefaultAccount(), row.isSavingsTarget()));
    }

    /** The owner's live account, else 404 {@code PENZ_ACCOUNT_NOT_FOUND} (another owner's id is a 404 too). */
    @Transactional(readOnly = true)
    public PenzAccountEntity require(UUID owner, UUID id) {
        return repository.findByIdAndCreatedByAndDeletedFalse(id, owner)
            .orElseThrow(() -> PenzErrors.notFound("PENZ_ACCOUNT_NOT_FOUND"));
    }

    /**
     * Resolves the flags of {@code row} (wanting {@code wantDefault}/{@code wantTarget}) against the owner's other
     * accounts and writes everything: first every flag that turns off (others, then {@code row}), then every flag
     * that turns on.
     */
    private PenzAccountEntity save(UUID owner, PenzAccountEntity row, boolean wantDefault, boolean wantTarget) {
        List<PenzAccountEntity> others = repository.findByCreatedByAndDeletedFalseOrderByNameAsc(owner).stream()
            .filter(o -> row.getId() == null || !o.getId().equals(row.getId()))
            .sorted(Comparator.comparing(PenzAccountEntity::getCreatedAt).thenComparing(PenzAccountEntity::getId))
            .toList();
        AccountPlan plan = AccountRules.planSave(others.stream().map(PenzAccountService::state).toList(),
            new AccountState(row.getId(), row.getType(), row.isArchived(), wantDefault, wantTarget));
        if (plan.refused()) {
            throw PenzErrors.conflict("PENZ_LAST_ACTIVE_ACCOUNT");
        }
        Map<UUID, PenzAccountEntity> byId = others.stream()
            .collect(Collectors.toMap(PenzAccountEntity::getId, Function.identity()));
        Instant now = Instant.now().truncatedTo(ChronoUnit.MICROS);
        for (AccountPatch p : plan.patches()) { // phase 1: flags turning off on the others
            PenzAccountEntity o = byId.get(p.id());
            if (Boolean.FALSE.equals(p.isDefault())) {
                o.setDefaultAccount(false);
            }
            if (Boolean.FALSE.equals(p.isSavingsTarget())) {
                o.setSavingsTarget(false);
            }
            o.setUpdatedAt(now);
            repository.saveAndFlush(o);
        }
        row.setDefaultAccount(plan.isDefault());
        row.setSavingsTarget(plan.isSavingsTarget());
        PenzAccountEntity saved = repository.saveAndFlush(row); // phase 2: the saved account
        for (AccountPatch p : plan.patches()) { // phase 3: flags turning on on the others
            if (Boolean.TRUE.equals(p.isDefault()) || Boolean.TRUE.equals(p.isSavingsTarget())) {
                PenzAccountEntity o = byId.get(p.id());
                if (Boolean.TRUE.equals(p.isDefault())) {
                    o.setDefaultAccount(true);
                }
                if (Boolean.TRUE.equals(p.isSavingsTarget())) {
                    o.setSavingsTarget(true);
                }
                repository.saveAndFlush(o);
            }
        }
        return saved;
    }

    private static AccountState state(PenzAccountEntity a) {
        return new AccountState(a.getId(), a.getType(), a.isArchived(), a.isDefaultAccount(), a.isSavingsTarget());
    }

    private static void apply(PenzAccountEntity row, PenzAccountRequest req) {
        row.setName(req.getName().strip());
        row.setType(req.getType());
        row.setCurrency(req.getCurrency());
        row.setOpeningBalanceMinor(req.getOpeningBalanceMinor() == null ? 0L : req.getOpeningBalanceMinor());
        row.setSmsSender(req.getSmsSender() == null || req.getSmsSender().isBlank() ? null : req.getSmsSender().strip());
    }
}
