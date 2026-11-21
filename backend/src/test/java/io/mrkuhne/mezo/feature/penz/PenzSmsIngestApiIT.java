package io.mrkuhne.mezo.feature.penz;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.PenzAccountRequest;
import io.mrkuhne.mezo.api.dto.PenzAccountResponse;
import io.mrkuhne.mezo.api.dto.PenzCategoryResponse;
import io.mrkuhne.mezo.api.dto.PenzInvestTxnRequest;
import io.mrkuhne.mezo.api.dto.PenzInvestTxnResponse;
import io.mrkuhne.mezo.api.dto.PenzSmsIngestResponse;
import io.mrkuhne.mezo.api.dto.PenzSmsKeyCreateRequest;
import io.mrkuhne.mezo.api.dto.PenzSmsKeyCreatedResponse;
import io.mrkuhne.mezo.api.dto.PenzSmsKeyResponse;
import io.mrkuhne.mezo.api.dto.PenzTransactionResponse;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.penz.entity.PenzApiKeyEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzSmsMessageEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzTransactionEntity;
import io.mrkuhne.mezo.feature.penz.repository.PenzApiKeyRepository;
import io.mrkuhne.mezo.feature.penz.repository.PenzSmsMessageRepository;
import io.mrkuhne.mezo.feature.penz.repository.PenzTransactionRepository;
import io.mrkuhne.mezo.feature.penz.service.sms.SmsIngestLogic;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Boop Pénz L4 (mezo-r36n9.102): the iOS Shortcut's bank-SMS path over HTTP — API-key auth (its own chain: a JWT
 * is no key, a key opens nothing else), the per-key rate limit, dedupe, the pre-filter, the LLM parse with its
 * guards (fake model) and the immediate server-side conversion. SMS texts and amounts are invented.
 */
@ActiveProfiles("companion-fake")
class PenzSmsIngestApiIT extends ApiIntegrationTest {

    private static final String INGEST = "/api/penz/sms/ingest";
    private static final String KEYS = "/api/penz/sms/keys";
    private static final String SENDER = "MBH Bank";
    private static final String RECEIVED = "2026-11-11T08:17:00+01:00";
    private static final LocalDate DAY = LocalDate.parse("2026-11-11");

    @Autowired private PenzSmsMessageRepository messages;
    @Autowired private PenzTransactionRepository transactions;
    @Autowired private PlatformTransactionManager txManager;
    @Autowired private PenzApiKeyRepository apiKeys;
    @Autowired private FakeCompanionLlm fakeLlm;
    @Autowired private io.mrkuhne.mezo.support.populator.PenzPopulator penz;

    private static String sms(String tag) {
        return "MBH Bank: Kartyas vasarlas -15 500 HUF, ALDI 152 BUDAPEST " + tag + ". Egyenleg: 412 380 HUF";
    }

    private static String scripted(String visible, String json) {
        return visible + " [fake-penz-sms:" + Base64.getEncoder().encodeToString(json.getBytes(StandardCharsets.UTF_8))
            + "]";
    }

    private String createKey(HttpHeaders jwt) {
        return postForBody(KEYS, new PenzSmsKeyCreateRequest().name("iPhone"), jwt, HttpStatus.OK,
            PenzSmsKeyCreatedResponse.class).getPlaintext();
    }

    private PenzAccountResponse account(HttpHeaders jwt, String name, boolean isDefault, String smsSender) {
        return postForBody("/api/penz/accounts", new PenzAccountRequest().name(name).type("checking").currency("HUF")
            .openingBalanceMinor(10_000_000L).isDefault(isDefault).smsSender(smsSender), jwt, HttpStatus.OK,
            PenzAccountResponse.class);
    }

    private static HttpHeaders keyHeaders(String key) {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.APPLICATION_JSON);
        h.set("X-Api-Key", key);
        return h;
    }

    private static Map<String, Object> body(String text) {
        Map<String, Object> b = new HashMap<>();
        b.put("text", text);
        b.put("sender", SENDER);
        b.put("received_at", RECEIVED);
        return b;
    }

    private PenzSmsIngestResponse ingest(HttpHeaders headers, String text) {
        return postForBody(INGEST, body(text), headers, HttpStatus.OK, PenzSmsIngestResponse.class);
    }

    private PenzSmsMessageEntity stored(UUID owner, String text) {
        return messages.findByCreatedByAndTextHashAndDeletedFalse(owner, SmsIngestLogic.dedupeHash(SENDER, text))
            .orElseThrow();
    }

    private List<PenzTransactionResponse> monthOf(HttpHeaders jwt) {
        return getForList("/api/penz/transactions?month=2026-11", jwt, HttpStatus.OK, PenzTransactionResponse.class);
    }

    // ---- the Shortcut path ----

    @Test
    void shortcutPathBooksAReviewTransactionForTheKeysOwner() {
        RegisteredUser u = registerUser("penz sms path");
        account(u.headers(), "Revolut", true, null);
        PenzAccountResponse mbh = account(u.headers(), "MBH", false, "mbh bank");
        String key = createKey(u.headers());
        String text = sms("path");

        int calls = fakeLlm.penzSmsCallCount();
        PenzSmsIngestResponse r = ingest(keyHeaders(key), text);
        assertThat(r.getStatus()).isEqualTo(PenzSmsIngestResponse.StatusEnum.PARSED);
        assertThat(r.getTransactionId()).isNotNull();
        assertThat(fakeLlm.penzSmsCallCount()).isEqualTo(calls + 1);

        PenzTransactionEntity row = transactions.findById(r.getTransactionId()).orElseThrow();
        assertThat(row.getCreatedBy()).isEqualTo(u.id());
        PenzCategoryResponse groceries = getForList("/api/penz/categories", u.headers(), HttpStatus.OK,
                PenzCategoryResponse.class).stream()
            .filter(c -> c.getName().equals(FakeCompanionLlm.PENZ_SMS_CATEGORY)).findFirst().orElseThrow();
        PenzTransactionResponse t = monthOf(u.headers()).stream()
            .filter(x -> x.getId().equals(r.getTransactionId())).findFirst().orElseThrow();
        assertThat(t.getAccountId()).isEqualTo(mbh.getId()); // the sender match beats the default account
        assertThat(t.getKind()).isEqualTo(PenzTransactionResponse.KindEnum.EXPENSE);
        assertThat(t.getAmount().getMinor()).isEqualTo(1_550_000L);
        assertThat(t.getAmount().getCurrency()).isEqualTo("HUF");
        assertThat(t.getAmount().getHufMinor()).isEqualTo(1_550_000L);
        assertThat(t.getDate()).isEqualTo(DAY);
        assertThat(t.getNote()).isEqualTo(FakeCompanionLlm.PENZ_SMS_MERCHANT);
        assertThat(t.getCategoryId()).isEqualTo(groceries.getId());
        assertThat(t.getSource()).isEqualTo(PenzTransactionResponse.SourceEnum.SMS);
        assertThat(t.getNeedsReview()).isTrue();

        PenzSmsMessageEntity msg = stored(u.id(), text);
        assertThat(t.getSmsMessageId()).isEqualTo(msg.getId());
        assertThat(msg.getStatus()).isEqualTo("converted");
        assertThat(msg.getTransactionId()).isEqualTo(r.getTransactionId());
        assertThat(msg.getText()).isEqualTo(text);
        assertThat(msg.getAmountMinor()).isEqualTo(1_550_000L);

        List<PenzSmsKeyResponse> keys = getForList(KEYS, u.headers(), HttpStatus.OK, PenzSmsKeyResponse.class);
        assertThat(keys).singleElement().satisfies(k -> {
            assertThat(k.getLastUsedAt()).isNotNull();
            assertThat(k.getLast4()).isEqualTo(key.substring(key.length() - 4));
        });
    }

    @Test
    void bearerMzpKeyIsAcceptedLikeTheHeader() {
        RegisteredUser u = registerUser("penz sms bearer");
        account(u.headers(), "MBH", true, null);
        String key = createKey(u.headers());
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.APPLICATION_JSON);
        h.setBearerAuth(key);
        assertThat(ingest(h, sms("bearer")).getStatus()).isEqualTo(PenzSmsIngestResponse.StatusEnum.PARSED);
    }

    @Test
    void replayIsADuplicateAndNeverASecondTransaction() {
        RegisteredUser u = registerUser("penz sms replay");
        account(u.headers(), "MBH", true, null);
        String key = createKey(u.headers());
        String text = sms("replay");

        PenzSmsIngestResponse first = ingest(keyHeaders(key), text);
        int calls = fakeLlm.penzSmsCallCount();
        PenzSmsIngestResponse again = ingest(keyHeaders(key), "  " + text + "\n"); // trimmed → the same SMS
        assertThat(again.getStatus()).isEqualTo(PenzSmsIngestResponse.StatusEnum.DUPLICATE);
        assertThat(again.getTransactionId()).isEqualTo(first.getTransactionId());
        assertThat(fakeLlm.penzSmsCallCount()).isEqualTo(calls); // no second LLM call
        assertThat(monthOf(u.headers())).hasSize(1);
    }

    @Test
    void twoOwnersKeysStaySeparate() {
        RegisteredUser a = registerUser("penz sms owner a");
        RegisteredUser b = registerUser("penz sms owner b");
        account(a.headers(), "A számla", true, null);
        account(b.headers(), "B számla", true, null);
        String keyA = createKey(a.headers());
        String keyB = createKey(b.headers());
        String text = sms("shared");

        PenzSmsIngestResponse ra = ingest(keyHeaders(keyA), text);
        PenzSmsIngestResponse rb = ingest(keyHeaders(keyB), text); // the same text is NOT a duplicate across owners
        assertThat(ra.getStatus()).isEqualTo(PenzSmsIngestResponse.StatusEnum.PARSED);
        assertThat(rb.getStatus()).isEqualTo(PenzSmsIngestResponse.StatusEnum.PARSED);
        assertThat(transactions.findById(ra.getTransactionId()).orElseThrow().getCreatedBy()).isEqualTo(a.id());
        assertThat(transactions.findById(rb.getTransactionId()).orElseThrow().getCreatedBy()).isEqualTo(b.id());
        assertThat(monthOf(a.headers())).extracting(PenzTransactionResponse::getId)
            .containsExactly(ra.getTransactionId());
        assertThat(monthOf(b.headers())).extracting(PenzTransactionResponse::getId)
            .containsExactly(rb.getTransactionId());
        assertThat(getForList(KEYS, a.headers(), HttpStatus.OK, PenzSmsKeyResponse.class)).hasSize(1);
        deleteAndExpect(KEYS + "/" + getForList(KEYS, b.headers(), HttpStatus.OK, PenzSmsKeyResponse.class)
            .getFirst().getId(), a.headers(), HttpStatus.NOT_FOUND); // A cannot revoke B's key
    }

    // ---- auth ----

    @Test
    void missingUnknownAndRevokedKeysAre401BeforeAnythingIsStored() {
        RegisteredUser u = registerUser("penz sms revoked");
        account(u.headers(), "MBH", true, null);
        String key = createKey(u.headers());

        HttpHeaders none = new HttpHeaders();
        none.setContentType(MediaType.APPLICATION_JSON);
        assertHasRequestError(postForBody(INGEST, body(sms("none")), none, HttpStatus.UNAUTHORIZED, String.class),
            "PENZ_SMS_KEY_INVALID");
        assertHasRequestError(postForBody(INGEST, body(sms("unknown")), keyHeaders("mzp_" + "x".repeat(43)),
            HttpStatus.UNAUTHORIZED, String.class), "PENZ_SMS_KEY_INVALID");
        // the body is not even read: garbage JSON with a bad key is still a 401, not a 400
        HttpHeaders bad = keyHeaders("mzp_nope");
        assertThat(exchangeForResponse(HttpMethod.POST, INGEST, "{not json", bad).getStatusCode())
            .isEqualTo(HttpStatus.UNAUTHORIZED);

        UUID keyId = getForList(KEYS, u.headers(), HttpStatus.OK, PenzSmsKeyResponse.class).getFirst().getId();
        deleteAndExpect(KEYS + "/" + keyId, u.headers(), HttpStatus.NO_CONTENT);
        assertHasRequestError(postForBody(INGEST, body(sms("revoked")), keyHeaders(key), HttpStatus.UNAUTHORIZED,
            String.class), "PENZ_SMS_KEY_INVALID");
        assertThat(getForList(KEYS, u.headers(), HttpStatus.OK, PenzSmsKeyResponse.class)).singleElement()
            .satisfies(k -> assertThat(k.getRevoked()).isTrue());
        assertThat(messages.findByCreatedByAndTextHashAndDeletedFalse(u.id(),
            SmsIngestLogic.dedupeHash(SENDER, sms("revoked")))).isEmpty();
        deleteAndExpect(KEYS + "/" + UUID.randomUUID(), u.headers(), HttpStatus.NOT_FOUND);
    }

    @Test
    void aJwtIsNoKeyOnTheIngest() {
        RegisteredUser u = registerUser("penz sms jwt");
        account(u.headers(), "MBH", true, null);
        HttpHeaders jwt = new HttpHeaders();
        jwt.putAll(u.headers());
        jwt.setContentType(MediaType.APPLICATION_JSON);
        assertHasRequestError(postForBody(INGEST, body(sms("jwt")), jwt, HttpStatus.UNAUTHORIZED, String.class),
            "PENZ_SMS_KEY_INVALID");
    }

    @Test
    void aKeyOpensNoOtherEndpoint() {
        RegisteredUser u = registerUser("penz sms elsewhere");
        String key = createKey(u.headers());
        getForBody("/api/penz/accounts", keyHeaders(key), HttpStatus.UNAUTHORIZED, String.class);
        HttpHeaders bearer = new HttpHeaders();
        bearer.setBearerAuth(key);
        getForBody("/api/penz/accounts", bearer, HttpStatus.UNAUTHORIZED, String.class);
        getForBody(KEYS, bearer, HttpStatus.UNAUTHORIZED, String.class);
        postForBody(KEYS, new PenzSmsKeyCreateRequest().name("x"), keyHeaders(key), HttpStatus.UNAUTHORIZED,
            String.class);
    }

    @Test
    void keysAreCreatedOnceListedWithoutTheKeyAndANewKeyRevokesTheOld() {
        RegisteredUser u = registerUser("penz sms keys");
        account(u.headers(), "MBH", true, null);
        String first = createKey(u.headers());
        PenzSmsKeyCreatedResponse second = postForBody(KEYS, new PenzSmsKeyCreateRequest().name("Új telefon"),
            u.headers(), HttpStatus.OK, PenzSmsKeyCreatedResponse.class);
        assertThat(second.getPlaintext()).matches("^mzp_[A-Za-z0-9_-]{43}$").isNotEqualTo(first);
        assertThat(second.getKey().getRevoked()).isFalse();

        String listed = getForBody(KEYS, u.headers(), HttpStatus.OK, String.class);
        assertThat(listed).doesNotContain(first).doesNotContain(second.getPlaintext());
        List<PenzSmsKeyResponse> keys = getForList(KEYS, u.headers(), HttpStatus.OK, PenzSmsKeyResponse.class);
        assertThat(keys).extracting(PenzSmsKeyResponse::getName).containsExactly("Új telefon", "iPhone");
        assertThat(keys).extracting(PenzSmsKeyResponse::getRevoked).containsExactly(false, true);

        PenzApiKeyEntity row = apiKeys.findById(second.getKey().getId()).orElseThrow();
        assertThat(row.getKeyHash()).isEqualTo(SmsIngestLogic.sha256Hex(second.getPlaintext()));
        postForBody(INGEST, body(sms("old key")), keyHeaders(first), HttpStatus.UNAUTHORIZED, String.class);
        ingest(keyHeaders(second.getPlaintext()), sms("new key"));

        String err = postForBody(KEYS, Map.of("name", ""), u.headers(), HttpStatus.BAD_REQUEST, String.class);
        assertThat(err).contains("name");
    }

    @Test
    void theTwentyFirstCallInAMinuteIs429WithRetryAfter() {
        RegisteredUser u = registerUser("penz sms rate");
        String key = createKey(u.headers());
        for (int i = 0; i < 20; i++) {
            assertThat(ingest(keyHeaders(key), "Belepesi kod: " + (100_000 + i)).getStatus())
                .isEqualTo(PenzSmsIngestResponse.StatusEnum.IGNORED);
        }
        ResponseEntity<String> limited = exchangeForResponse(HttpMethod.POST, INGEST, body("Belepesi kod: 999999"),
            keyHeaders(key));
        assertThat(limited.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
        assertHasRequestError(limited.getBody(), "PENZ_SMS_RATE_LIMITED");
        assertThat(Long.parseLong(limited.getHeaders().getFirst(HttpHeaders.RETRY_AFTER))).isBetween(1L, 60L);
        // a fresh key of the same owner is limited separately
        assertThat(ingest(keyHeaders(createKey(u.headers())), "Belepesi kod: 999999").getStatus())
            .isEqualTo(PenzSmsIngestResponse.StatusEnum.IGNORED);
    }

    // ---- the parse ----

    @Test
    void anOtpIsIgnoredWithItsTextDroppedAndNoModelCall() {
        RegisteredUser u = registerUser("penz sms otp");
        String key = createKey(u.headers());
        String otp = "MBH Bank: Az On egyszer hasznalatos kodja: 482913";
        int calls = fakeLlm.penzSmsCallCount();
        PenzSmsIngestResponse r = ingest(keyHeaders(key), otp);
        assertThat(r.getStatus()).isEqualTo(PenzSmsIngestResponse.StatusEnum.IGNORED);
        assertThat(r.getReason()).isEqualTo("no_amount");
        assertThat(r.getTransactionId()).isNull();
        assertThat(fakeLlm.penzSmsCallCount()).isEqualTo(calls);
        PenzSmsMessageEntity msg = stored(u.id(), otp);
        assertThat(msg.getStatus()).isEqualTo("ignored");
        assertThat(msg.getText()).isNull();
        assertThat(ingest(keyHeaders(key), otp).getStatus()).isEqualTo(PenzSmsIngestResponse.StatusEnum.DUPLICATE);
    }

    @Test
    void aModelThatSaysNotATransactionIsIgnoredWithTheTextDropped() {
        RegisteredUser u = registerUser("penz sms not txn");
        account(u.headers(), "MBH", true, null);
        String key = createKey(u.headers());
        String text = scripted("MBH Bank: Egyenleg: 412 380 HUF", "{\"is_transaction\":false}");
        PenzSmsIngestResponse r = ingest(keyHeaders(key), text);
        assertThat(r.getStatus()).isEqualTo(PenzSmsIngestResponse.StatusEnum.IGNORED);
        assertThat(r.getReason()).isEqualTo("not_a_transaction");
        assertThat(stored(u.id(), text).getText()).isNull();
        assertThat(monthOf(u.headers())).isEmpty();
    }

    @Test
    void anAmountNotInTheSmsFailsAsAMismatch() {
        RegisteredUser u = registerUser("penz sms mismatch");
        account(u.headers(), "MBH", true, null);
        String key = createKey(u.headers());
        String text = scripted("MBH Bank: Kartyas vasarlas -15 500 HUF, ALDI", """
            {"is_transaction":true,"direction":"debit","amount":1550,"currency":"HUF","merchant":"Aldi"}""");
        PenzSmsIngestResponse r = ingest(keyHeaders(key), text);
        assertThat(r.getStatus()).isEqualTo(PenzSmsIngestResponse.StatusEnum.FAILED);
        assertThat(r.getReason()).isEqualTo("amount_mismatch");
        PenzSmsMessageEntity msg = stored(u.id(), text);
        assertThat(msg.getStatus()).isEqualTo("failed");
        assertThat(msg.getText()).isEqualTo(text); // a failed SMS keeps its text for a later look
        assertThat(monthOf(u.headers())).isEmpty();
    }

    @Test
    void aModelFailureIsAStoredFailureNotAnError() {
        RegisteredUser u = registerUser("penz sms llm error");
        account(u.headers(), "MBH", true, null);
        String key = createKey(u.headers());
        String text = sms(FakeCompanionLlm.FAIL_COMPLETE);
        PenzSmsIngestResponse r = ingest(keyHeaders(key), text);
        assertThat(r.getStatus()).isEqualTo(PenzSmsIngestResponse.StatusEnum.FAILED);
        assertThat(r.getReason()).isEqualTo("llm_error");
        assertThat(stored(u.id(), text).getStatus()).isEqualTo("failed");
    }

    @Test
    void withoutAnAccountTheSmsStaysParsedWithNoTransaction() {
        RegisteredUser u = registerUser("penz sms no account");
        String key = createKey(u.headers());
        String text = sms("no account");
        PenzSmsIngestResponse r = ingest(keyHeaders(key), text);
        assertThat(r.getStatus()).isEqualTo(PenzSmsIngestResponse.StatusEnum.PARSED);
        assertThat(r.getReason()).isEqualTo("no_account");
        assertThat(r.getTransactionId()).isNull();
        PenzSmsMessageEntity msg = stored(u.id(), text);
        assertThat(msg.getStatus()).isEqualTo("parsed");
        assertThat(msg.getReason()).isEqualTo("no_account");
        assertThat(msg.getAmountMinor()).isEqualTo(1_550_000L);
        assertThat(msg.getTransactionId()).isNull();
        assertThat(monthOf(u.headers())).isEmpty();
    }

    @Test
    void anAmountThatConvertsToNothingStaysParsedWithNoTransaction() {
        RegisteredUser u = registerUser("penz sms too small");
        postForBody("/api/penz/accounts", new PenzAccountRequest().name("Font").type("checking").currency("GBP")
            .isDefault(true), u.headers(), HttpStatus.OK, PenzAccountResponse.class);
        penz.fxRate("EUR", DAY, "1"); // invented rates: 1 GBP = 400 EUR here
        penz.fxRate("GBP", DAY, "400");
        String key = createKey(u.headers());
        // 0,01 EUR on a GBP account: 1 minor × 1 / 400 rounds to 0 — a zero transaction is not booked
        String text = scripted("MBH Bank: Kartyas vasarlas -0,01 EUR, ALDI", """
            {"is_transaction":true,"direction":"debit","amount":0.01,"currency":"EUR","merchant":"Aldi"}""");
        PenzSmsIngestResponse r = ingest(keyHeaders(key), text);
        assertThat(r.getStatus()).isEqualTo(PenzSmsIngestResponse.StatusEnum.PARSED);
        assertThat(r.getReason()).isEqualTo("amount_too_small");
        assertThat(r.getTransactionId()).isNull();
        PenzSmsMessageEntity msg = stored(u.id(), text);
        assertThat(msg.getStatus()).isEqualTo("parsed");
        assertThat(msg.getReason()).isEqualTo("amount_too_small");
        assertThat(transactions.findAllOwned(u.id())).isEmpty();
        assertThat(ingest(keyHeaders(key), text).getStatus()).isEqualTo(PenzSmsIngestResponse.StatusEnum.DUPLICATE);
    }

    @Test
    void aBlankTextIs400AndAnUnusableReceivedAtIsNow() {
        RegisteredUser u = registerUser("penz sms body");
        account(u.headers(), "MBH", true, null);
        String key = createKey(u.headers());
        String err = postForBody(INGEST, body("   "), keyHeaders(key), HttpStatus.BAD_REQUEST, String.class);
        assertHasFieldError(err, "text", "VALIDATION_INVALID_VALUE");

        Map<String, Object> b = body(sms("odd date"));
        b.put("received_at", "Nov 11, 2026 at 8:17");
        b.remove("sender");
        PenzSmsIngestResponse r = postForBody(INGEST, b, keyHeaders(key), HttpStatus.OK, PenzSmsIngestResponse.class);
        assertThat(r.getStatus()).isEqualTo(PenzSmsIngestResponse.StatusEnum.PARSED);
        PenzSmsMessageEntity msg = messages.findByCreatedByAndTextHashAndDeletedFalse(u.id(),
            SmsIngestLogic.dedupeHash("unknown", sms("odd date"))).orElseThrow();
        assertThat(msg.getSender()).isEqualTo("unknown");
        assertThat(msg.getReceivedAt()).isAfter(java.time.Instant.now().minusSeconds(120));
    }

    // ---- invest-buy adoption (mezo-r36n9.119, the old runConvertSms.test.ts linkSmsToInvestBuy, 3 cases) ----

    private PenzInvestTxnResponse recordBuy(HttpHeaders jwt, UUID holdingId, long amountMinor, LocalDate date,
                                            UUID accountId, UUID linkTransactionId) {
        return postForBody("/api/penz/invest-transactions", new PenzInvestTxnRequest().holdingId(holdingId)
            .side("buy").amountMinor(amountMinor).date(date).accountId(accountId)
            .linkTransactionId(linkTransactionId), jwt, HttpStatus.CREATED, PenzInvestTxnResponse.class);
    }

    @Test
    void aLateSmsLinksToTheRecordedBuyMakingItSmsSourcedWithoutANewTransaction() {
        RegisteredUser u = registerUser("penz sms invest link");
        PenzAccountResponse mbh = account(u.headers(), "MBH", true, SENDER);
        UUID bond = penz.holding(u.id(), "MÁP Plusz", "bond", null, "short", "HUF", null).getId();
        String key = createKey(u.headers());
        PenzInvestTxnResponse buy = recordBuy(u.headers(), bond, 1_550_000L, DAY.minusDays(2), mbh.getId(), null);

        String text = sms("invest link");
        PenzSmsIngestResponse r = ingest(keyHeaders(key), text);
        assertThat(r.getStatus()).isEqualTo(PenzSmsIngestResponse.StatusEnum.PARSED);
        assertThat(r.getReason()).isEqualTo("invest_buy_linked");
        assertThat(r.getTransactionId()).isEqualTo(buy.getTransactionId());

        PenzSmsMessageEntity msg = stored(u.id(), text);
        assertThat(msg.getStatus()).isEqualTo("converted");
        assertThat(msg.getTransactionId()).isEqualTo(buy.getTransactionId());
        assertThat(monthOf(u.headers())).singleElement().satisfies(t -> {
            assertThat(t.getId()).isEqualTo(buy.getTransactionId());
            assertThat(t.getKind()).isEqualTo(PenzTransactionResponse.KindEnum.INVEST_BUY);
            assertThat(t.getSource()).isEqualTo(PenzTransactionResponse.SourceEnum.SMS);
            assertThat(t.getSmsMessageId()).isEqualTo(msg.getId());
            assertThat(t.getNeedsReview()).isFalse();
            assertThat(t.getDate()).isEqualTo(DAY.minusDays(2));
        });
    }

    @Test
    void anSmsWithoutAMatchingBuyIsANormalExpense() {
        RegisteredUser u = registerUser("penz sms invest nomatch");
        PenzAccountResponse mbh = account(u.headers(), "MBH", true, SENDER);
        UUID bond = penz.holding(u.id(), "MÁP Plusz", "bond", null, "short", "HUF", null).getId();
        String key = createKey(u.headers());
        PenzInvestTxnResponse buy = recordBuy(u.headers(), bond, 900_000L, DAY, mbh.getId(), null);

        PenzSmsIngestResponse r = ingest(keyHeaders(key), sms("invest nomatch"));
        assertThat(r.getStatus()).isEqualTo(PenzSmsIngestResponse.StatusEnum.PARSED);
        assertThat(r.getReason()).isNull();
        assertThat(r.getTransactionId()).isNotEqualTo(buy.getTransactionId());
        assertThat(monthOf(u.headers())).hasSize(2)
            .filteredOn(t -> t.getId().equals(r.getTransactionId())).singleElement()
            .satisfies(t -> assertThat(t.getKind()).isEqualTo(PenzTransactionResponse.KindEnum.EXPENSE));
        assertThat(transactions.findById(buy.getTransactionId()).orElseThrow().getSmsMessageId()).isNull();
    }

    /** Review fix (mezo-r36n9.119): a deleted invest buy's money row is never adopted (nor resurrected) by an SMS. */
    @Test
    void aDeletedInvestBuyIsNotAdoptedByALaterSms() {
        RegisteredUser u = registerUser("penz sms invest deleted");
        PenzAccountResponse mbh = account(u.headers(), "MBH", true, SENDER);
        UUID bond = penz.holding(u.id(), "MÁP Plusz", "bond", null, "short", "HUF", null).getId();
        String key = createKey(u.headers());
        PenzInvestTxnResponse buy = recordBuy(u.headers(), bond, 1_550_000L, DAY.minusDays(1), mbh.getId(), null);
        deleteAndExpect("/api/penz/invest-transactions/" + buy.getId(), u.headers(), HttpStatus.NO_CONTENT);
        Optional<PenzTransactionEntity> locked = new TransactionTemplate(txManager)
            .execute(tx -> transactions.lockLive(buy.getTransactionId(), u.id()));
        assertThat(locked).isEmpty(); // the locking read skips a deleted row

        PenzSmsIngestResponse r = ingest(keyHeaders(key), sms("invest deleted"));
        assertThat(r.getStatus()).isEqualTo(PenzSmsIngestResponse.StatusEnum.PARSED);
        assertThat(r.getReason()).isNull();
        assertThat(r.getTransactionId()).isNotEqualTo(buy.getTransactionId());
        assertThat(transactions.findById(buy.getTransactionId())).isEmpty(); // still deleted
        assertThat(monthOf(u.headers())).singleElement()
            .satisfies(t -> assertThat(t.getKind()).isEqualTo(PenzTransactionResponse.KindEnum.EXPENSE));
    }

    @Test
    void afterTheBuyIsDeletedTheRevertedExpenseIsOfferedWhenTheBuyIsRecordedAgain() {
        RegisteredUser u = registerUser("penz sms invest revert");
        PenzAccountResponse mbh = account(u.headers(), "MBH", true, SENDER);
        UUID bond = penz.holding(u.id(), "MÁP Plusz", "bond", null, "short", "HUF", null).getId();
        String key = createKey(u.headers());
        PenzInvestTxnResponse buy = recordBuy(u.headers(), bond, 1_550_000L, DAY.minusDays(1), mbh.getId(), null);
        PenzSmsIngestResponse r = ingest(keyHeaders(key), sms("invest revert"));
        assertThat(r.getTransactionId()).isEqualTo(buy.getTransactionId());

        deleteAndExpect("/api/penz/invest-transactions/" + buy.getId(), u.headers(), HttpStatus.NO_CONTENT);
        PenzTransactionEntity reverted = transactions.findById(buy.getTransactionId()).orElseThrow();
        assertThat(reverted.getKind()).isEqualTo("expense"); // the debit really happened: kept, not deleted
        assertThat(reverted.isNeedsReview()).isTrue();
        assertThat(reverted.getSmsMessageId()).isNotNull();

        List<PenzTransactionResponse> offered = getForList("/api/penz/invest-transactions/sms-candidates?accountId="
            + mbh.getId() + "&amountMinor=1550000&date=" + DAY.minusDays(3), u.headers(), HttpStatus.OK,
            PenzTransactionResponse.class);
        assertThat(offered).extracting(PenzTransactionResponse::getId).containsExactly(reverted.getId());

        PenzInvestTxnResponse again = recordBuy(u.headers(), bond, 1_550_000L, DAY.minusDays(3), mbh.getId(),
            reverted.getId());
        assertThat(again.getTransactionId()).isEqualTo(reverted.getId());
        // the bank row's date wins — which is the first buy's date, kept when the SMS was adopted
        assertThat(again.getDate()).isEqualTo(DAY.minusDays(1));
        assertThat(transactions.findById(reverted.getId()).orElseThrow().getKind()).isEqualTo("invest_buy");
        assertThat(monthOf(u.headers())).hasSize(1);
    }
}
