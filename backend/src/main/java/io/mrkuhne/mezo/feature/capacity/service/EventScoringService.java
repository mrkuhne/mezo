package io.mrkuhne.mezo.feature.capacity.service;

import io.mrkuhne.mezo.feature.capacity.config.CapacityProperties;
import io.mrkuhne.mezo.feature.capacity.entity.CalendarEventScoreEntity;
import io.mrkuhne.mezo.feature.capacity.entity.CapacityEventFeedbackEntity;
import io.mrkuhne.mezo.feature.capacity.entity.FeedbackEffect;
import io.mrkuhne.mezo.feature.capacity.entity.ScoreSource;
import io.mrkuhne.mezo.feature.capacity.port.CapacityCalendarPort;
import io.mrkuhne.mezo.feature.capacity.port.CapacityCalendarPort.CalendarEventView;
import io.mrkuhne.mezo.feature.capacity.repository.CalendarEventScoreRepository;
import io.mrkuhne.mezo.feature.capacity.repository.CapacityEventFeedbackRepository;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.techcore.security.LlmActorContext;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.task.AsyncTaskExecutor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Scores how demanding each calendar event is (Boop B7 K1, mezo-r36n9.17): one cheap-tier model call for every
 * event with no score for its exact input yet, {@link RuleEventScore} as the fallback (no model, a failed or
 * slower-than-8-s call, an unusable answer, an event the answer skipped). The model scores and never produces a day
 * number; the owner's own feedback labels override the components when read. Scores are cached by
 * (event, input hash); a rule score is retried by a later call after {@link #RULE_RETRY}.
 *
 * <p>Deliberately not {@code @Transactional}: the model call must not hold a connection.
 */
@Slf4j
@Service
public class EventScoringService {

    static final String LLM_FEATURE = "capacity_event_score";
    /** First token of the system prompt; FakeCompanionLlm mirrors it literally. */
    static final String MARKER = "CAPACITY_EVENT_SCORE_V1";
    static final Duration LLM_TIMEOUT = Duration.ofSeconds(8);
    static final Duration RULE_RETRY = Duration.ofMinutes(30);
    private static final Set<String> KINDS =
        Set.of("meeting", "focus", "social", "sport", "admin", "personal", "travel", "rest", "free", "other");

    static final String SYSTEM_PROMPT = MARKER + """
        : Egy naptár eseményeit pontozod aszerint, mennyire terhelik a naptár tulajdonosát. Minden eseményre adj
        egész számot 0..3 között: mental (szellemi igénybevétel), social (társas igénybevétel), physical (fizikai
        igénybevétel); restores: igaz, ha az esemény inkább energiát ad vissza; kind: meeting | focus | social |
        sport | admin | personal | travel | rest | free | other; confidence: 0..1. Csak a pontozást végezd el,
        semmilyen más számot ne találj ki. Válaszolj KIZÁRÓLAG egyetlen JSON objektummal, pontosan ebben a formában:
        {"events":[{"id":"...","mental":0,"social":0,"physical":0,"restores":false,"kind":"meeting","confidence":0.8}]}""";

    private final CapacityCalendarPort calendar;
    private final CalendarEventScoreRepository scores;
    private final CapacityEventFeedbackRepository feedback;
    private final ObjectProvider<CompanionLlm> companionLlm;
    private final LlmCallContextHolder llmCallContextHolder;
    private final ObjectMapper objectMapper;
    private final CapacityProperties props;
    private final AsyncTaskExecutor executor;

    public EventScoringService(CapacityCalendarPort calendar, CalendarEventScoreRepository scores,
                               CapacityEventFeedbackRepository feedback, ObjectProvider<CompanionLlm> companionLlm,
                               LlmCallContextHolder llmCallContextHolder, ObjectMapper objectMapper,
                               CapacityProperties props,
                               @Qualifier("applicationTaskExecutor") AsyncTaskExecutor executor) {
        this.calendar = calendar;
        this.scores = scores;
        this.feedback = feedback;
        this.companionLlm = companionLlm;
        this.llmCallContextHolder = llmCallContextHolder;
        this.objectMapper = objectMapper;
        this.props = props;
        this.executor = executor;
    }

    /** Every event of {@code from..to} (inclusive) with its score, feedback applied; keyed by event id. */
    public Map<UUID, EventScore> scoresFor(UUID owner, LocalDate from, LocalDate to) {
        List<CalendarEventView> events = calendar.events(owner, from, to);
        if (events.isEmpty()) {
            return Map.of();
        }
        Map<UUID, CalendarEventScoreEntity> stored = new LinkedHashMap<>();
        Map<UUID, Map<String, CalendarEventScoreEntity>> byEvent = new LinkedHashMap<>();
        for (CalendarEventScoreEntity row : scores.findByCreatedByAndEventIdIn(owner,
                events.stream().map(CalendarEventView::id).toList())) {
            byEvent.computeIfAbsent(row.getEventId(), k -> new LinkedHashMap<>()).put(row.getInputHash(), row);
        }
        Instant retryBefore = Instant.now().minus(RULE_RETRY);
        List<CalendarEventView> toAsk = new ArrayList<>();
        Map<UUID, String> hashes = new LinkedHashMap<>();
        for (CalendarEventView e : events) {
            String hash = inputHash(e);
            hashes.put(e.id(), hash);
            CalendarEventScoreEntity row = byEvent.getOrDefault(e.id(), Map.of()).get(hash);
            if (row != null) {
                stored.put(e.id(), row);
            }
            boolean trivial = e.allDay() && "free".equals(e.availability());
            boolean needsModel = row == null
                || (ScoreSource.RULE.value().equals(row.getSource()) && !trivial && row.getUpdatedAt().isBefore(retryBefore));
            if (needsModel && !trivial) {
                toAsk.add(e);
            }
        }

        Map<UUID, EventScore> asked = toAsk.isEmpty() ? Map.of() : askModel(toAsk);
        List<CalendarEventScoreEntity> toSave = new ArrayList<>();
        Map<UUID, EventScore> base = new LinkedHashMap<>();
        for (CalendarEventView e : events) {
            EventScore fromModel = asked.get(e.id());
            CalendarEventScoreEntity row = stored.get(e.id());
            boolean modelAsked = toAsk.stream().anyMatch(a -> a.id().equals(e.id()));
            if (fromModel != null) {
                base.put(e.id(), fromModel);
                toSave.add(upsert(owner, row, e.id(), hashes.get(e.id()), fromModel));
            } else if (row != null) {
                base.put(e.id(), fromRow(row));
                if (modelAsked) { // model failed again: keep the rule row, push the retry window out
                    row.setUpdatedAt(Instant.now());
                    toSave.add(row);
                }
            } else {
                EventScore rule = RuleEventScore.score(e);
                base.put(e.id(), rule);
                toSave.add(upsert(owner, null, e.id(), hashes.get(e.id()), rule));
            }
        }
        for (CalendarEventScoreEntity row : toSave) {
            try {
                scores.saveAndFlush(row);
            } catch (DataIntegrityViolationException e) {
                // a concurrent call stored the same (event, input hash) first: its row stands, ours is dropped
                log.debug("Capacity event score already stored by a concurrent call: {}", row.getEventId());
            }
        }

        Map<String, FeedbackEffect> labels = labels(owner);
        Map<UUID, EventScore> out = new LinkedHashMap<>();
        for (CalendarEventView e : events) {
            out.put(e.id(), applyFeedback(base.get(e.id()), labels.get(eventKey(e.externalId()))));
        }
        return out;
    }

    /**
     * Stored scores for every event of {@code from..to}, a rule score for the rest — never a model call and never a
     * write. For baseline history, where an unscored old event must not cost a call.
     */
    public Map<UUID, EventScore> storedOrRule(UUID owner, LocalDate from, LocalDate to) {
        List<CalendarEventView> events = calendar.events(owner, from, to);
        if (events.isEmpty()) {
            return Map.of();
        }
        Map<UUID, Map<String, CalendarEventScoreEntity>> byEvent = new LinkedHashMap<>();
        for (CalendarEventScoreEntity row : scores.findByCreatedByAndEventIdIn(owner,
                events.stream().map(CalendarEventView::id).toList())) {
            byEvent.computeIfAbsent(row.getEventId(), k -> new LinkedHashMap<>()).put(row.getInputHash(), row);
        }
        Map<String, FeedbackEffect> labels = labels(owner);
        Map<UUID, EventScore> out = new LinkedHashMap<>();
        for (CalendarEventView e : events) {
            CalendarEventScoreEntity row = byEvent.getOrDefault(e.id(), Map.of()).get(inputHash(e));
            EventScore base = row != null ? fromRow(row) : RuleEventScore.score(e);
            out.put(e.id(), applyFeedback(base, labels.get(eventKey(e.externalId()))));
        }
        return out;
    }

    /** SHA-256 over what the score depends on: title, start, end, attendee names, location, notes. */
    public static String inputHash(CalendarEventView e) {
        String joined = String.join("\u001f", nz(e.title()), String.valueOf(e.start()), String.valueOf(e.end()),
            String.join("\u001e", e.attendeeNames() == null ? List.of() : e.attendeeNames()), nz(e.location()),
            nz(e.notes()));
        try {
            return HexFormat.of().formatHex(
                MessageDigest.getInstance("SHA-256").digest(joined.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            // SHA-256 is mandatory on every JVM (java.security.MessageDigest spec).
            throw new AssertionError(ex);
        }
    }

    /** The feedback key of an event: its external id without the trailing {@code |occurrence} part. */
    public static String eventKey(String externalId) {
        int bar = externalId.lastIndexOf('|');
        return bar < 0 ? externalId : externalId.substring(0, bar);
    }

    /** The owner's labels override the three components: drains lifts the main one to 2, feeds/neutral cap at 1. */
    static EventScore applyFeedback(EventScore s, FeedbackEffect effect) {
        if (effect == null) {
            return s;
        }
        return switch (effect) {
            case DRAINS -> {
                int m = s.mental(), so = s.social(), p = s.physical();
                if (m >= so && m >= p) {
                    m = Math.max(m, 2);
                } else if (so >= p) {
                    so = Math.max(so, 2);
                } else {
                    p = Math.max(p, 2);
                }
                yield new EventScore(s.eventId(), m, so, p, false, s.kind(), s.confidence(), s.source());
            }
            case FEEDS -> new EventScore(s.eventId(), Math.min(s.mental(), 1), Math.min(s.social(), 1),
                Math.min(s.physical(), 1), true, s.kind(), s.confidence(), s.source());
            case NEUTRAL -> new EventScore(s.eventId(), Math.min(s.mental(), 1), Math.min(s.social(), 1),
                Math.min(s.physical(), 1), false, s.kind(), s.confidence(), s.source());
        };
    }

    private Map<String, FeedbackEffect> labels(UUID owner) {
        Map<String, FeedbackEffect> out = new LinkedHashMap<>();
        for (CapacityEventFeedbackEntity f : feedback.findByCreatedByAndDeletedFalse(owner)) {
            FeedbackEffect.of(f.getEffect()).ifPresent(effect -> out.put(f.getEventKey(), effect));
        }
        return out;
    }

    // ---- the model ----

    /** The model's scores by event id; empty when there is no model, the call failed, timed out or was junk. */
    private Map<UUID, EventScore> askModel(List<CalendarEventView> events) {
        CompanionLlm llm = companionLlm.getIfAvailable();
        if (llm == null) {
            return Map.of();
        }
        String userMessage = prompt(events);
        UUID actor = LlmActorContext.capture();
        CompletableFuture<String> call = null;
        try {
            call = CompletableFuture.supplyAsync(() -> LlmActorContext.runAsCaptured(actor,
                () -> llmCallContextHolder.runWith(new LlmCallContext(LLM_FEATURE, "score", null, null),
                    () -> llm.complete(SYSTEM_PROMPT, userMessage))), executor);
            String raw = call.get(LLM_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS);
            return parse(raw, events);
        } catch (TimeoutException e) {
            call.cancel(true);
            log.info("Capacity event scoring took longer than {}, using rule scores", LLM_TIMEOUT);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } catch (ExecutionException e) {
            log.warn("Capacity event scoring failed, using rule scores: {}", e.getCause().getMessage());
        } catch (RuntimeException e) { // the pool refused the task
            log.warn("Capacity event scoring failed, using rule scores: {}", e.getMessage());
        }
        return Map.of();
    }

    private String prompt(List<CalendarEventView> events) {
        int notesMax = props.notesMaxChars();
        StringBuilder sb = new StringBuilder("Események:\n");
        for (CalendarEventView e : events) {
            String notes = e.notes() == null ? "" : e.notes().length() > notesMax ? e.notes().substring(0, notesMax) : e.notes();
            sb.append("- id=").append(e.id())
                .append(" | cím: ").append(nz(e.title()))
                .append(" | kezdet: ").append(e.start()).append(" | vég: ").append(e.end())
                .append(" | egész napos: ").append(e.allDay())
                .append(" | naptár: ").append(nz(e.calendarName()))
                .append(" | résztvevők száma: ").append(e.attendeeCount() == null ? "nincs adat" : e.attendeeCount())
                .append(" | résztvevők: ").append(String.join(", ", e.attendeeNames() == null ? List.of() : e.attendeeNames()))
                .append(" | szervező én vagyok: ").append(e.organizerIsMe() == null ? "nincs adat" : e.organizerIsMe())
                .append(" | helyszín: ").append(nz(e.location()))
                .append(" | ismétlődő: ").append(e.recurring() == null ? "nincs adat" : e.recurring())
                .append(" | elérhetőség: ").append(nz(e.availability()))
                .append(" | jegyzet: ").append(notes.replace('\n', ' '))
                .append('\n');
        }
        return sb.toString();
    }

    private Map<UUID, EventScore> parse(String raw, List<CalendarEventView> asked) {
        if (raw == null) {
            return Map.of();
        }
        int start = raw.indexOf('{');
        int end = raw.lastIndexOf('}');
        if (start < 0 || end <= start) {
            log.warn("Capacity event scoring answer had no JSON object, using rule scores");
            return Map.of();
        }
        JsonNode events;
        try {
            JsonNode root = objectMapper.readTree(raw.substring(start, end + 1));
            events = root == null ? null : root.get("events");
        } catch (Exception e) {
            log.warn("Capacity event scoring answer unparseable, using rule scores: {}", e.getMessage());
            return Map.of();
        }
        if (events == null || !events.isArray()) {
            return Map.of();
        }
        Set<UUID> askedIds = asked.stream().map(CalendarEventView::id).collect(Collectors.toSet());
        Map<UUID, EventScore> out = new LinkedHashMap<>();
        for (JsonNode n : events) {
            try {
                UUID id = UUID.fromString(n.get("id").asString());
                if (!askedIds.contains(id) || !n.get("mental").isNumber() || !n.get("social").isNumber()
                        || !n.get("physical").isNumber()) {
                    continue;
                }
                JsonNode kind = n.get("kind");
                JsonNode conf = n.get("confidence");
                JsonNode restores = n.get("restores");
                String kindText = kind != null && kind.isString() && KINDS.contains(kind.asString())
                    ? kind.asString() : "other";
                double confidence = conf != null && conf.isNumber() ? clamp(conf.asDouble(), 0, 1) : 0.5;
                out.put(id, new EventScore(id, level(n.get("mental")), level(n.get("social")),
                    level(n.get("physical")), restores != null && restores.asBoolean(false), kindText, confidence,
                    ScoreSource.LLM.value()));
            } catch (RuntimeException ignored) { // a malformed entry falls back to the rule score
            }
        }
        return out;
    }

    private static int level(JsonNode n) {
        return (int) clamp(Math.round(n.asDouble()), 0, 3);
    }

    private static double clamp(double v, double lo, double hi) {
        return Math.max(lo, Math.min(hi, v));
    }

    // ---- persistence ----

    private CalendarEventScoreEntity upsert(UUID owner, CalendarEventScoreEntity row, UUID eventId, String hash,
                                            EventScore s) {
        CalendarEventScoreEntity e = row != null ? row : new CalendarEventScoreEntity();
        e.setCreatedBy(owner);
        e.setEventId(eventId);
        e.setInputHash(hash);
        e.setMental((short) s.mental());
        e.setSocial((short) s.social());
        e.setPhysical((short) s.physical());
        e.setRestores(s.restores());
        e.setKind(s.kind());
        e.setConfidence(BigDecimal.valueOf(s.confidence()).setScale(2, RoundingMode.HALF_UP));
        e.setSource(s.source());
        e.setUpdatedAt(Instant.now());
        return e;
    }

    private static EventScore fromRow(CalendarEventScoreEntity r) {
        return new EventScore(r.getEventId(), r.getMental(), r.getSocial(), r.getPhysical(), r.isRestores(),
            r.getKind(), r.getConfidence().doubleValue(), r.getSource());
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }
}
