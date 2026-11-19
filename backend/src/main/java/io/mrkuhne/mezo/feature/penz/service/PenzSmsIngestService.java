package io.mrkuhne.mezo.feature.penz.service;

import io.mrkuhne.mezo.api.dto.PenzSmsIngestRequest;
import io.mrkuhne.mezo.api.dto.PenzSmsIngestResponse;
import io.mrkuhne.mezo.api.dto.PenzSmsIngestResponse.StatusEnum;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.penz.entity.PenzAccountEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzCategoryEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzSmsMessageEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzTransactionEntity;
import io.mrkuhne.mezo.feature.penz.repository.PenzAccountRepository;
import io.mrkuhne.mezo.feature.penz.repository.PenzCategoryRepository;
import io.mrkuhne.mezo.feature.penz.repository.PenzSmsMessageRepository;
import io.mrkuhne.mezo.feature.penz.service.sms.SmsAmountCheck;
import io.mrkuhne.mezo.feature.penz.service.sms.SmsConversion;
import io.mrkuhne.mezo.feature.penz.service.sms.SmsConversion.AccountRef;
import io.mrkuhne.mezo.feature.penz.service.sms.SmsConversion.CategoryRef;
import io.mrkuhne.mezo.feature.penz.service.sms.SmsConversion.ParsedSms;
import io.mrkuhne.mezo.feature.penz.service.sms.SmsConversion.SmsTxnPlan;
import io.mrkuhne.mezo.feature.penz.service.sms.SmsIngestLogic;
import io.mrkuhne.mezo.feature.penz.service.sms.SmsIngestLogic.BodyCheck;
import io.mrkuhne.mezo.feature.penz.service.sms.SmsIngestLogic.Normalized;
import io.mrkuhne.mezo.feature.penz.service.sms.SmsIngestLogic.ValidBody;
import io.mrkuhne.mezo.feature.penz.service.sms.SmsPrompt;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * The bank-SMS ingest of the iOS Shortcut (Boop Pénz L4, mezo-r36n9.102, spec §10.1.7) — the old app's
 * {@code ingest-sms/entry.ts} + {@code runConvertSms.ts}, server-side in one call. The caller is already
 * authenticated by its API key (the key's owner is the principal).
 *
 * <ol>
 *   <li>Body: text required (trimmed, ≤ 1000), sender ≤ 100 (default {@code unknown}), an unusable
 *       {@code received_at} is "now".</li>
 *   <li>Dedupe: the owner already has this {@code sha256(sender|text)} → {@code duplicate}, nothing written.</li>
 *   <li>Pre-filter: no money figure → stored {@code ignored/no_amount} with the text dropped, no LLM call.</li>
 *   <li>LLM parse ({@link PenzSmsLlm}, cheap tier, tagged {@code penz_sms/parse}) and the ported
 *       {@code normalizeParsed} guards; any LLM failure is a stored {@code failed/llm_error}, never an error to
 *       the Shortcut. Then the amount cross-check: the parsed amount must literally be in the SMS, else
 *       {@code failed/amount_mismatch}.</li>
 *   <li>Conversion at once: account by sender (else default, else first live), the amount into the account's
 *       currency at the booking rate, category by name and kind; no account → stored {@code parsed/no_account};
 *       no rate → stored {@code parsed/fx_unavailable}; otherwise the review transaction (source sms, needs
 *       review) and the SMS flips to {@code converted}. The response says {@code parsed} with its id.</li>
 * </ol>
 * The SMS text and the key are never logged. Adopting a recorded invest buy instead of booking an expense (the
 * old {@code linkSmsToInvestBuy}) is L6.
 */
@Slf4j
@Service
public class PenzSmsIngestService {

    static final String LLM_FEATURE = "penz_sms";
    static final String LLM_OPERATION = "parse";

    private final PenzSmsMessageRepository messages;
    private final PenzAccountRepository accounts;
    private final PenzCategoryRepository categoryRows;
    private final PenzCategoryService categories;
    private final PenzSettingsService settings;
    private final PenzFxService fx;
    private final PenzSmsStore store;
    private final ObjectProvider<PenzSmsLlm> llm;
    private final LlmCallContextHolder llmCallContextHolder;
    private final ObjectMapper objectMapper;

    public PenzSmsIngestService(PenzSmsMessageRepository messages, PenzAccountRepository accounts,
                                PenzCategoryRepository categoryRows, PenzCategoryService categories,
                                PenzSettingsService settings, PenzFxService fx, PenzSmsStore store,
                                ObjectProvider<PenzSmsLlm> llm, LlmCallContextHolder llmCallContextHolder,
                                ObjectMapper objectMapper) {
        this.messages = messages;
        this.accounts = accounts;
        this.categoryRows = categoryRows;
        this.categories = categories;
        this.settings = settings;
        this.fx = fx;
        this.store = store;
        this.llm = llm;
        this.llmCallContextHolder = llmCallContextHolder;
        this.objectMapper = objectMapper;
    }

    public PenzSmsIngestResponse ingest(UUID owner, PenzSmsIngestRequest req) {
        BodyCheck check = SmsIngestLogic.validateBody(req.getText(), req.getSender(), req.getReceivedAt(),
            Instant.now().truncatedTo(ChronoUnit.MICROS));
        if (!check.ok()) {
            throw PenzErrors.field(check.field());
        }
        ValidBody body = check.value();
        PenzSmsStore.Received sms = new PenzSmsStore.Received(owner, body.sender(), body.text(),
            SmsIngestLogic.dedupeHash(body.sender(), body.text()), body.receivedAt());

        Optional<PenzSmsMessageEntity> existing = messages.findByCreatedByAndTextHashAndDeletedFalse(owner,
            sms.textHash());
        if (existing.isPresent()) {
            return duplicate(owner, sms);
        }

        if (!SmsIngestLogic.looksLikeMoney(body.text())) {
            return stored(owner, sms, Normalized.ignored("no_amount"), "no_amount", false);
        }

        categories.seedDefaultsOnce(owner);
        List<PenzCategoryEntity> cats = categoryRows.findByCreatedByAndDeletedFalseOrderByKindAscPositionAscNameAsc(owner);
        List<String> names = cats.stream().map(PenzCategoryEntity::getName).toList();
        LocalDate fallbackDate = SmsIngestLogic.localDate(body.receivedAt(), settings.zone(owner));

        Normalized result = parse(body, names, fallbackDate);
        if (result.isParsed() && !SmsAmountCheck.containsAmount(body.text(), result.currency(), result.amountMinor())) {
            result = Normalized.failed("amount_mismatch");
        }
        if (!result.isParsed()) {
            boolean ignored = Normalized.IGNORED.equals(result.status());
            return stored(owner, sms, result, result.reason(), !ignored);
        }

        List<AccountRef> accountRefs = accounts.findByCreatedByAndArchivedFalseAndDeletedFalseOrderByNameAsc(owner)
            .stream().map(PenzSmsIngestService::ref).toList();
        AccountRef account = SmsConversion.pickAccount(body.sender(), accountRefs);
        if (account == null) {
            return stored(owner, sms, result, "no_account", true);
        }

        ParsedSms parsed = new ParsedSms(null, result.kind(), result.amountMinor(), result.currency(),
            result.merchant(), result.date(), result.categoryName());
        List<CategoryRef> categoryRefs = cats.stream()
            .map(c -> new CategoryRef(c.getId(), c.getName(), c.getKind())).toList();
        SmsTxnPlan plan;
        PenzFxService.Booking booking;
        try {
            LocalDate today = settings.today(owner);
            BigDecimal msgRate = hufPerUnit(result.currency(), result.date(), today);
            BigDecimal accountRate = hufPerUnit(account.currency(), result.date(), today);
            plan = SmsConversion.plan(parsed, account, categoryRefs, msgRate, accountRate);
            booking = fx.book(plan.currency(), plan.amountMinor(), plan.date(), today);
        } catch (SystemRuntimeErrorException fxDown) {
            log.warn("Penz SMS: no FX rate for {} on {}; stored without a transaction", result.currency(),
                result.date());
            return stored(owner, sms, result, "fx_unavailable", true);
        }
        Optional<PenzTransactionEntity> txn = store.storeConverted(sms, result, plan, booking);
        if (txn.isEmpty()) {
            return duplicate(owner, sms);
        }
        return new PenzSmsIngestResponse().status(StatusEnum.PARSED).transactionId(txn.get().getId());
    }

    /** The LLM read of the SMS through the ported guards; every failure is {@code failed/llm_error}. */
    private Normalized parse(ValidBody body, List<String> names, LocalDate fallbackDate) {
        PenzSmsLlm model = llm.getIfAvailable();
        if (model == null) {
            return Normalized.failed("llm_error");
        }
        try {
            String raw = llmCallContextHolder.runWith(new LlmCallContext(LLM_FEATURE, LLM_OPERATION, null, null),
                () -> model.complete(SmsPrompt.SYSTEM_PROMPT, SmsPrompt.userMessage(body.text(), body.sender(), names)));
            return SmsIngestLogic.normalizeParsed(json(raw), fallbackDate, names);
        } catch (RuntimeException e) {
            // never the SMS text: provider errors can carry the request
            log.warn("Penz SMS parse failed: {}", e.getClass().getSimpleName());
            return Normalized.failed("llm_error");
        }
    }

    /** The model's answer as JSON — tolerating a ```json fence or prose around ONE object; garbage → null. */
    private JsonNode json(String raw) {
        if (raw == null) {
            return null;
        }
        String s = raw.strip();
        int start = s.indexOf('{');
        int end = s.lastIndexOf('}');
        if (start >= 0 && end > start) {
            s = s.substring(start, end + 1);
        }
        try {
            return objectMapper.readTree(s);
        } catch (JacksonException e) {
            return null;
        }
    }

    private BigDecimal hufPerUnit(String currency, LocalDate date, LocalDate today) {
        if (PenzFxService.HUF.equals(currency)) {
            return BigDecimal.ONE;
        }
        return fx.book(currency, 1, date, today).rate();
    }

    private PenzSmsIngestResponse stored(UUID owner, PenzSmsStore.Received sms, Normalized result, String reason,
                                         boolean keepText) {
        if (store.store(sms, result, reason, keepText).isEmpty()) {
            return duplicate(owner, sms);
        }
        return new PenzSmsIngestResponse().status(StatusEnum.fromValue(result.status())).reason(reason);
    }

    private PenzSmsIngestResponse duplicate(UUID owner, PenzSmsStore.Received sms) {
        UUID txnId = messages.findByCreatedByAndTextHashAndDeletedFalse(owner, sms.textHash())
            .map(PenzSmsMessageEntity::getTransactionId).orElse(null);
        return new PenzSmsIngestResponse().status(StatusEnum.DUPLICATE).transactionId(txnId);
    }

    private static AccountRef ref(PenzAccountEntity a) {
        return new AccountRef(a.getId(), a.getCurrency(), a.isDefaultAccount(), a.isArchived(), a.getSmsSender());
    }
}
