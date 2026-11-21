package io.mrkuhne.mezo.feature.mail.service;

import io.mrkuhne.mezo.feature.mail.config.MailProperties;
import io.mrkuhne.mezo.feature.mail.entity.MailMessageEntity;
import io.mrkuhne.mezo.feature.mail.service.MailIntakeService.IntakeResult;
import io.mrkuhne.mezo.feature.mail.service.MailIntakeService.IntakedMail;
import io.mrkuhne.mezo.feature.mail.service.MailItemStore.NewItem;
import io.mrkuhne.mezo.feature.mail.service.MailItemStore.Saved;
import io.mrkuhne.mezo.feature.mail.service.classify.ClassifiedMail;
import io.mrkuhne.mezo.feature.mail.service.classify.ClassifyPrompt;
import io.mrkuhne.mezo.feature.mail.service.classify.MailOutputValidator;
import io.mrkuhne.mezo.feature.mail.service.classify.ScoredDeal;
import io.mrkuhne.mezo.feature.mail.service.classify.ScorePrompt;
import io.mrkuhne.mezo.feature.mail.service.classify.ScreenPrompt;
import io.mrkuhne.mezo.feature.mail.service.redact.RedactedMail;
import io.mrkuhne.mezo.feature.mail.service.rules.Group;
import io.mrkuhne.mezo.feature.mail.service.rules.MailHeaders;
import io.mrkuhne.mezo.feature.mail.service.rules.MailRules;
import io.mrkuhne.mezo.feature.mail.service.rules.ParcelState;
import io.mrkuhne.mezo.feature.mail.service.rules.RuleVerdict;
import io.mrkuhne.mezo.feature.mail.service.rules.SenderRule;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.LlmActorContext;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * Turns the mail an intake run stored into the cards of the morning post (spec §5.4, mezo-r36n9.39): rules decide
 * what they can; the cheap model classifies the rest (one call per mail) under the per-day cap; one batched call
 * scores the new deals (his taps shift the score through {@code SenderPrior}); deals worth a minute and model-read
 * deadlines are screened for phishing / injection, and an item the screen did not clear stays flagged. Sensitive mail
 * never reaches a model. The model is optional at every step: a cap hit or a failing model leaves the rest grouped by
 * rules and marks the run rules-only. {@link #process} never throws.
 *
 * <p>Each owner is processed under {@link LlmActorContext#runAs} so every {@code llm_log} row carries the owner (the
 * cap reads those rows). All model calls run outside transactions; the writes are the short ones of
 * {@link MailItemStore}.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.MAIL_SWITCH, havingValue = "true")
public class MailDigestService {

    static final String FALLBACK_REST = "egyéb";
    static final String CAT_PERSON = "személyes";
    static final String CAT_PARCEL = "csomag";
    static final String CAT_DEAL = "akció";
    static final String CAT_DEADLINE = "határidő";
    static final String SENSITIVE = "sensitive";

    private static final Logger LOG = LoggerFactory.getLogger(MailDigestService.class);
    private static final Pattern AMOUNT = Pattern.compile(
        "^\\s*([0-9]+(?:[.,][0-9]{1,2})?)\\s*(HUF|EUR|Ft|€)?\\s*$", Pattern.CASE_INSENSITIVE);

    private final MailItemStore store;
    private final MailIntakeStore intakeStore;
    private final MailLearning learning;
    private final MailCostCap cap;
    private final MailProperties properties;
    private final ObjectProvider<MailClassifierLlm> llm;
    private final ObjectProvider<Clock> clock;

    /** One message to turn into a card: from this run's intake, or an earlier one a crash left behind. */
    private record Work(UUID messageId, MailHeaders headers, RedactedMail redacted, RuleVerdict verdict,
                        Instant receivedAt, boolean fromStore) {
    }

    /** A deal or model-read deadline waiting for its score and/or screen. */
    private record Pending(UUID itemId, String grp, String fromAddr, String subject, String text, String title,
                           String summary) {
    }

    /** The mutable state of one owner's pass: whether the model may still be called, and what happened. */
    private final class Pass {
        final UUID owner;
        final UUID runId;
        final Instant now;
        final ZoneId zone;
        final MailClassifierLlm model;
        boolean modelDown;
        boolean rulesOnly;
        int classified;

        Pass(UUID owner, UUID runId, Instant now, ZoneId zone, MailClassifierLlm model) {
            this.owner = owner;
            this.runId = runId;
            this.now = now;
            this.zone = zone;
            this.model = model;
        }

        /** May the next model call go out? A refusal marks the run rules-only (a model step was wanted). */
        boolean canCall() {
            if (model == null || modelDown || !cap.allows(owner, ZonedDateTime.ofInstant(now, zone))) {
                rulesOnly = true;
                return false;
            }
            return true;
        }

        void failed() {
            modelDown = true;
            rulesOnly = true;
        }
    }

    /** Processes one intake result for one owner. Never throws: a failing item or step is logged and skipped. */
    public void process(UUID userId, IntakeResult result) {
        try {
            LlmActorContext.runAs(userId, () -> run(userId, result));
        } catch (RuntimeException e) {
            LOG.warn("mail digest processing failed: {}", e.getClass().getSimpleName());
        }
    }

    private void run(UUID owner, IntakeResult result) {
        Clock c = clock.getIfAvailable(Clock::systemUTC);
        Instant now = c.instant();
        ZoneId zone = ZoneId.of(properties.zone());
        Pass pass = new Pass(owner, result.runId(), now, zone, llm.getIfAvailable());
        List<Pending> pending = new ArrayList<>();
        try {
            for (Work w : collect(owner, result, now, zone)) {
                try {
                    if (!store.hasItem(w.messageId())) {
                        handle(pass, c, w, pending);
                    }
                } catch (RuntimeException e) {
                    LOG.warn("mail item skipped: {}", e.getClass().getSimpleName());
                }
            }
            scoreAndScreen(pass, pending);
        } catch (RuntimeException e) {
            pass.rulesOnly = true;
            LOG.warn("mail digest step failed: {}", e.getClass().getSimpleName());
        } finally {
            if (result.runId() != null) {
                try {
                    store.finishRun(result.runId(), pass.classified, pass.rulesOnly);
                } catch (RuntimeException e) {
                    LOG.warn("mail run not closed: {}", e.getClass().getSimpleName());
                }
            }
        }
    }

    // ---- work list ------------------------------------------------------------------------------------------

    private List<Work> collect(UUID owner, IntakeResult result, Instant now, ZoneId zone) {
        List<Work> work = new ArrayList<>();
        Set<UUID> seen = new HashSet<>();
        Map<UUID, MailMessageEntity> stored = store.messages(result.mails().stream().map(IntakedMail::messageId)
            .toList());
        for (IntakedMail m : result.mails()) {
            MailMessageEntity e = stored.get(m.messageId());
            work.add(new Work(m.messageId(), m.headers(), m.redacted(), m.verdict(),
                e == null ? now : e.getReceivedAt(), false));
            seen.add(m.messageId());
        }
        try {
            Instant dayStart = LocalDate.ofInstant(now, zone).atStartOfDay(zone).toInstant();
            List<SenderRule> rules = intakeStore.ownerRules(owner);
            for (MailMessageEntity e : store.withoutItem(owner, dayStart)) {
                if (!seen.contains(e.getId())) {
                    work.add(fromStored(e, rules));
                }
            }
        } catch (RuntimeException ex) {
            LOG.warn("unprocessed mail pickup failed: {}", ex.getClass().getSimpleName());
        }
        work.sort(Comparator.comparing(Work::receivedAt));
        return work;
    }

    /** A message a crash left without an item: rules only, from the redacted copy (the raw text is gone). */
    private static Work fromStored(MailMessageEntity e, List<SenderRule> rules) {
        String body = e.getBodyRedacted() == null ? "" : e.getBodyRedacted();
        MailHeaders headers = new MailHeaders(e.getFromAddr(), e.getFromName(), e.getSubject(), Map.of());
        RedactedMail redacted = new RedactedMail(body, List.of(), List.of());
        RuleVerdict verdict = e.isSensitive() ? new RuleVerdict.Sensitive("stored")
            : MailRules.decide(headers, body, redacted, rules);
        return new Work(e.getId(), headers, redacted, verdict, e.getReceivedAt(), true);
    }

    // ---- one mail -------------------------------------------------------------------------------------------

    private void handle(Pass pass, Clock c, Work w, List<Pending> pending) {
        switch (w.verdict()) {
            case RuleVerdict.Sensitive s -> save(sensitive(pass, w));
            case RuleVerdict.Parcel p -> {
                if (!(w.fromStore() && store.parcelExists(pass.owner, p.carrier(), p.key()))) {
                    save(parcel(pass, w, p.carrier(), p.key(), p.state(), "rule"));
                }
            }
            case RuleVerdict.Structured s -> saveStructured(pass, w, s, pending);
            case RuleVerdict.Rest r -> save(rest(pass, w, "rest", clip(r.category(), 24), null, null));
            case RuleVerdict.Person p -> save(person(pass, w, null));
            case RuleVerdict.NeedsModel nm -> saveModelled(pass, c, w, nm, pending);
        }
    }

    private Saved save(NewItem item) {
        return store.save(item);
    }

    private NewItem sensitive(Pass pass, Work w) {
        String sender = w.headers().fromName().isBlank() ? w.headers().from() : w.headers().fromName();
        return new NewItem(pass.owner, w.messageId(), pass.runId, SENSITIVE, SENSITIVE, clip(sender, 200), "", null,
            null, null, null, null, null, null, "rule", false, pass.now);
    }

    private NewItem parcel(Pass pass, Work w, String carrier, String key, ParcelState state, String source) {
        String name = clip(carrier, 16);
        return new NewItem(pass.owner, w.messageId(), pass.runId, "parcel", CAT_PARCEL, clip(name + " csomag", 200),
            parcelWords(state), null, null, null, null, name, clip(key, 64), state, source, false, pass.now);
    }

    private static String parcelWords(ParcelState state) {
        return switch (state == null ? ParcelState.IN_TRANSIT : state) {
            case IN_TRANSIT -> "Úton van.";
            case TODAY -> "Ma érkezik.";
            case PICKUP -> "Átvehető.";
            case DELIVERED -> "Átvetted.";
        };
    }

    private NewItem rest(Pass pass, Work w, String grp, String category, String title, String summary) {
        String subject = w.headers().subject().isBlank() ? "(nincs tárgy)" : w.headers().subject();
        return new NewItem(pass.owner, w.messageId(), pass.runId, grp, category, clip(title == null ? subject : title, 200),
            clip(summary, 400), null, null, null, null, null, null, null, title == null ? "rule" : "model", false,
            pass.now);
    }

    private NewItem person(Pass pass, Work w, ClassifiedMail model) {
        return rest(pass, w, "person", CAT_PERSON, model == null ? null : model.title(),
            model == null ? null : model.summary());
    }

    // ---- JSON-LD --------------------------------------------------------------------------------------------

    private void saveStructured(Pass pass, Work w, RuleVerdict.Structured s, List<Pending> pending) {
        Map<String, String> f = s.fields();
        String subject = w.headers().subject();
        switch (s.group()) {
            case PARCEL -> {
                String carrier = f.get("carrier");
                String key = f.get("trackingNumber");
                if (carrier == null || key == null) {
                    save(rest(pass, w, "rest", FALLBACK_REST, null, null));
                } else {
                    save(parcel(pass, w, carrier, key, ParcelState.IN_TRANSIT, "jsonld"));
                }
            }
            case DEADLINE -> {
                Instant due = instant(first(f, "paymentDueDate", "startDate", "startTime", "checkinTime"), pass.zone);
                if (due == null) {
                    save(rest(pass, w, "rest", FALLBACK_REST, null, null));
                    return;
                }
                Amount amount = amount(f.get("totalPaymentDue"), null);
                String category = f.containsKey("paymentDueDate") ? "számla" : CAT_DEADLINE;
                save(new NewItem(pass.owner, w.messageId(), pass.runId, "deadline", category,
                    clip(firstOr(f, subject, "name", "provider", "reservationFor"), 200), clip(subject, 400), due,
                    null, amount == null ? null : amount.minor(), amount == null ? null : amount.currency(), null,
                    null, null, "jsonld", false, pass.now));
            }
            case DEAL -> {
                Amount amount = amount(f.get("price"), f.get("priceCurrency"));
                String title = clip(firstOr(f, subject, "name", "itemOffered"), 200);
                Saved saved = save(new NewItem(pass.owner, w.messageId(), pass.runId, "deal", CAT_DEAL, title,
                    clip(subject, 400), null, instant(f.get("validThrough"), pass.zone),
                    amount == null ? null : amount.minor(), amount == null ? null : amount.currency(), null, null,
                    null, "jsonld", false, pass.now));
                pending.add(pending(saved, w, "deal", title, clip(subject, 400)));
            }
            default -> save(rest(pass, w, "rest", FALLBACK_REST, null, null));
        }
    }

    private static String first(Map<String, String> f, String... keys) {
        for (String k : keys) {
            if (f.get(k) != null) {
                return f.get(k);
            }
        }
        return null;
    }

    private static String firstOr(Map<String, String> f, String fallback, String... keys) {
        String v = first(f, keys);
        return v == null || v.isBlank() ? (fallback == null || fallback.isBlank() ? "(nincs tárgy)" : fallback) : v;
    }

    private static Instant instant(String s, ZoneId zone) {
        if (s == null || s.isBlank()) {
            return null;
        }
        String t = s.strip();
        try {
            return OffsetDateTime.parse(t).toInstant();
        } catch (DateTimeParseException ignored) {
            // not an offset date-time
        }
        try {
            return LocalDateTime.parse(t).atZone(zone).toInstant();
        } catch (DateTimeParseException ignored) {
            // not a local date-time
        }
        try {
            return LocalDate.parse(t).atTime(23, 59).atZone(zone).toInstant();
        } catch (DateTimeParseException ignored) {
            return null;
        }
    }

    private record Amount(long minor, String currency) {
    }

    private static Amount amount(String value, String currencyHint) {
        if (value == null) {
            return null;
        }
        Matcher m = AMOUNT.matcher(value.strip() + suffix(currencyHint));
        if (!m.matches()) {
            return null;
        }
        String cur = currency(m.group(2));
        if (cur == null) {
            return null;
        }
        return new Amount(new BigDecimal(m.group(1).replace(',', '.')).movePointRight(2).longValue(), cur);
    }

    private static String suffix(String hint) {
        return hint == null || hint.isBlank() ? "" : " " + hint.strip();
    }

    private static String currency(String s) {
        if (s == null) {
            return null;
        }
        return switch (s.toUpperCase(Locale.ROOT)) {
            case "HUF", "FT" -> "HUF";
            case "EUR", "€" -> "EUR";
            default -> null;
        };
    }

    // ---- the model funnel -----------------------------------------------------------------------------------

    private void saveModelled(Pass pass, Clock c, Work w, RuleVerdict.NeedsModel nm, List<Pending> pending) {
        Optional<ClassifiedMail> classified = classify(pass, c, w);
        if (classified.isEmpty()) {
            save(nm.bulk() ? rest(pass, w, "rest", FALLBACK_REST, null, null) : person(pass, w, null));
            return;
        }
        ClassifiedMail m = classified.get();
        String category = clip(m.category() == null || m.category().isBlank() ? FALLBACK_REST : m.category(), 24);
        String title = m.title() == null || m.title().isBlank() ? null : m.title();
        String summary = m.summary() == null ? "" : m.summary();
        Group group = m.group() == null ? Group.REST : m.group();
        switch (group) {
            case DEAL -> {
                Saved saved = save(new NewItem(pass.owner, w.messageId(), pass.runId, "deal", category,
                    clip(title == null ? w.headers().subject() : title, 200), clip(summary, 400), null, m.validUntil(),
                    m.amountMinor(), m.currency(), null, null, null, "model", false, pass.now));
                pending.add(pending(saved, w, "deal", title == null ? w.headers().subject() : title, summary));
            }
            case DEADLINE -> {
                if (m.dueAt() == null) {
                    save(rest(pass, w, "rest", category, title, summary));
                    return;
                }
                Saved saved = save(new NewItem(pass.owner, w.messageId(), pass.runId, "deadline", category,
                    clip(title == null ? w.headers().subject() : title, 200), clip(summary, 400), m.dueAt(), null,
                    m.amountMinor(), m.currency(), null, null, null, "model", true, pass.now));
                pending.add(pending(saved, w, "deadline", title, summary));
            }
            case PARCEL -> {
                if (m.carrier() == null || m.carrier().isBlank()) {
                    save(rest(pass, w, "rest", category, title, summary));
                } else {
                    save(parcel(pass, w, m.carrier(), "m" + w.messageId().toString().replace("-", ""),
                        m.parcelState() == null ? ParcelState.IN_TRANSIT : m.parcelState(), "model"));
                }
            }
            case PERSON -> save(person(pass, w, m));
            default -> save(rest(pass, w, "rest", category, title, summary));
        }
    }

    private Pending pending(Saved saved, Work w, String grp, String title, String summary) {
        return new Pending(saved.id(), grp, w.headers().from(), w.headers().subject(), w.redacted().text(),
            title == null ? "" : title, summary);
    }

    private Optional<ClassifiedMail> classify(Pass pass, Clock c, Work w) {
        if (!pass.canCall()) {
            return Optional.empty();
        }
        Optional<String> raw = pass.model.classify(ClassifyPrompt.SYSTEM_PROMPT,
            ClassifyPrompt.userMessage(w.headers().subject(), w.headers().fromDomain(), w.redacted().text()));
        if (raw.isEmpty()) {
            pass.failed();
            return Optional.empty();
        }
        // the text checked is exactly the redacted text that was put into the prompt
        Optional<ClassifiedMail> out = MailOutputValidator.classified(raw.get(), w.redacted(), pass.zone, c);
        out.ifPresent(x -> pass.classified++);
        return out;
    }

    /** One batched score call over the new deals, then a screen for those worth a minute and for model deadlines. */
    private void scoreAndScreen(Pass pass, List<Pending> pending) {
        List<Pending> deals = pending.stream().filter(p -> "deal".equals(p.grp())).toList();
        List<Pending> toScreen = new ArrayList<>(pending.stream().filter(p -> "deadline".equals(p.grp())).toList());
        if (!deals.isEmpty() && pass.canCall()) {
            toScreen.addAll(score(pass, deals));
        }
        for (Pending p : toScreen) {
            try {
                if (!pass.canCall()) {
                    return; // the item stays flagged: not cleared, never notifies
                }
                Optional<String> raw = pass.model.screen(ScreenPrompt.SYSTEM_PROMPT,
                    ScreenPrompt.userMessage(p.subject(), p.text()));
                if (raw.isEmpty()) {
                    pass.failed();
                    return;
                }
                store.applyScreen(p.itemId(), MailOutputValidator.screen(raw.get()));
            } catch (RuntimeException e) {
                LOG.warn("mail screen skipped: {}", e.getClass().getSimpleName());
            }
        }
    }

    /** Scores the deals; returns those whose final score is worth a minute (they need the screen). */
    private List<Pending> score(Pass pass, List<Pending> deals) {
        Map<String, Double> shifts = new HashMap<>();
        List<ScorePrompt.Example> examples = List.of();
        try {
            shifts = learning.senderShifts(pass.owner, pass.now);
            examples = learning.examples(pass.owner, properties.fewShotExamples());
        } catch (RuntimeException e) {
            LOG.warn("mail learning read failed: {}", e.getClass().getSimpleName());
        }
        List<ScorePrompt.Candidate> candidates = deals.stream()
            .map(d -> new ScorePrompt.Candidate(d.itemId(), d.title(), d.summary())).toList();
        // v1 has no goal context (the season feature belongs to another session): few-shot examples only
        Optional<String> raw = pass.model.score(ScorePrompt.SYSTEM_PROMPT,
            ScorePrompt.userMessage(candidates, Optional.empty(), examples));
        if (raw.isEmpty()) {
            pass.failed();
            return List.of();
        }
        Map<UUID, Pending> byId = deals.stream().collect(Collectors.toMap(Pending::itemId, d -> d));
        List<Pending> worth = new ArrayList<>();
        for (ScoredDeal s : MailOutputValidator.scores(raw.get(), byId.keySet())) {
            try {
                Pending p = byId.get(s.itemId());
                double shift = shifts.getOrDefault(p.fromAddr().toLowerCase(Locale.ROOT), 0.0);
                int score = (int) Math.max(1, Math.min(10, Math.round(s.score() + shift)));
                boolean needsScreen = score >= properties.dealWorthThreshold();
                store.applyScore(p.itemId(), score, clip(s.why(), 300), needsScreen);
                if (needsScreen) {
                    worth.add(p);
                }
            } catch (RuntimeException e) {
                LOG.warn("mail score skipped: {}", e.getClass().getSimpleName());
            }
        }
        return worth;
    }

    private static String clip(String s, int max) {
        String t = s == null ? "" : s.strip();
        return t.length() <= max ? t : t.substring(0, max).strip();
    }
}
