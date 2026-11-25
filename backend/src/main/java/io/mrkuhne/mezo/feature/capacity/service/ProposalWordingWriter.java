package io.mrkuhne.mezo.feature.capacity.service;

import io.mrkuhne.mezo.feature.capacity.service.Effects.DayEffect;
import io.mrkuhne.mezo.feature.capacity.service.Effects.RestEffect;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.techcore.security.LlmActorContext;
import io.mrkuhne.mezo.techcore.text.DigitGuard;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.task.AsyncTaskExecutor;
import org.springframework.core.task.SimpleAsyncTaskExecutor;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * The Hungarian words of a proposal card (Boop B7 K3, mezo-r36n9.17, spec §5.5/§5.6): the title, the from → to line,
 * three or four effect lines and the "Miért javaslom" lines. {@link #template} builds them from the generator's facts
 * and the {@link Effects} alone, in the approved spike's phrasing; {@link #word} lets the cheap-tier model rephrase the
 * title, the effect lines and the why lines, and keeps its text only when every digit run in it is one the template
 * already carries ({@link DigitGuard}) — anything else (no model, a failure, a timeout, junk, a new number) gives the
 * template. The from → to line is always the template's.
 *
 * <p>{@link #word} blocks on the model (up to {@value #LLM_TIMEOUT_SECONDS} s), so it is for background paths only
 * (the Sunday job, regenerate); a request thread uses {@link #template} ({@code templateOnly}). No
 * {@code @Transactional}: it reads nothing from the database.
 */
@Slf4j
@Service
public class ProposalWordingWriter {

    static final String LLM_FEATURE = "capacity_proposal_words";
    /** First token of the system prompt. */
    static final String MARKER = "CAPACITY_PROPOSAL_WORDS_V1";
    static final long LLM_TIMEOUT_SECONDS = 45;

    static final String SYSTEM_PROMPT = MARKER + """
        : Boop vagy, egy személyes edző. Egy heti átrendezési javaslat szövegét fogalmazod át természetes, rövid,
        tegező magyar mondatokra. Ne adj hozzá új tényt, és SOHA ne írj olyan számot, ami nincs benne a kapott
        szövegben (időpontot, percet, kalóriát, napot sem). A sorok száma maradjon ugyanannyi, a sorrend ugyanaz.
        Válaszolj KIZÁRÓLAG egyetlen JSON objektummal, pontosan ebben a formában:
        {"title":"...","effectLines":["..."],"why":["..."]}""";

    /** The card's words: {@code effectLines} has three or four lines. */
    public record Wording(String title, String move, List<String> effectLines, List<String> why) {
    }

    private final ObjectProvider<CompanionLlm> companionLlm;
    private final LlmCallContextHolder llmCallContextHolder;
    private final ObjectMapper objectMapper;
    private final AsyncTaskExecutor executor;

    /** Small concurrency cap on the model calls of this writer. */
    static final int MAX_CONCURRENT_CALLS = 2;

    /**
     * The model call runs on the writer's OWN small executor (virtual threads, at most {@value #MAX_CONCURRENT_CALLS}
     * at once) — never on the shared {@code applicationTaskExecutor}: the proposal rephrase already runs there, and a
     * nested blocking task on the same pool could starve it. The executor exists only to keep the
     * {@value #LLM_TIMEOUT_SECONDS} s timeout.
     */
    @Autowired
    public ProposalWordingWriter(ObjectProvider<CompanionLlm> companionLlm, LlmCallContextHolder llmCallContextHolder,
                                 ObjectMapper objectMapper) {
        this(companionLlm, llmCallContextHolder, objectMapper, ownExecutor());
    }

    private static AsyncTaskExecutor ownExecutor() {
        SimpleAsyncTaskExecutor e = new SimpleAsyncTaskExecutor("capacity-words-");
        e.setVirtualThreads(true);
        e.setConcurrencyLimit(MAX_CONCURRENT_CALLS);
        return e;
    }

    ProposalWordingWriter(ObjectProvider<CompanionLlm> companionLlm, LlmCallContextHolder llmCallContextHolder,
                          ObjectMapper objectMapper, AsyncTaskExecutor executor) {
        this.companionLlm = companionLlm;
        this.llmCallContextHolder = llmCallContextHolder;
        this.objectMapper = objectMapper;
        this.executor = executor;
    }

    /** {@code templateOnly} = the synchronous path: no model call at all. */
    public Wording word(ProposalDraft d, Effects e, boolean templateOnly) {
        return templateOnly ? template(d, e) : word(d, e);
    }

    /** The model's rephrasing when it is usable and brings no number, else the template. Blocks: background only. */
    public Wording word(ProposalDraft d, Effects e) {
        Wording template = template(d, e);
        CompanionLlm llm = companionLlm.getIfAvailable();
        if (llm == null) {
            return template;
        }
        String userMessage = prompt(template);
        UUID actor = LlmActorContext.capture();
        CompletableFuture<String> call = null;
        try {
            call = CompletableFuture.supplyAsync(() -> LlmActorContext.runAsCaptured(actor,
                () -> llmCallContextHolder.runWith(new LlmCallContext(LLM_FEATURE, "words", null, null),
                    () -> llm.complete(SYSTEM_PROMPT, userMessage))), executor);
            return accept(call.get(LLM_TIMEOUT_SECONDS, TimeUnit.SECONDS), template, facts(template));
        } catch (TimeoutException ex) {
            call.cancel(true);
            log.info("Proposal wording took longer than {} s, using the template", LLM_TIMEOUT_SECONDS);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
        } catch (ExecutionException ex) {
            log.warn("Proposal wording failed, using the template: {}", ex.getCause().getMessage());
        } catch (RuntimeException ex) { // the pool refused the task
            log.warn("Proposal wording failed, using the template: {}", ex.getMessage());
        }
        return template;
    }

    // ── the model's answer ──────────────────────────────────────────────────

    private String prompt(Wording t) {
        StringBuilder sb = new StringBuilder("Javaslat:\ncím: ").append(t.title()).append('\n')
            .append("mi változik: ").append(t.move()).append('\n').append("hatások:\n");
        t.effectLines().forEach(l -> sb.append("- ").append(l).append('\n'));
        sb.append("miért:\n");
        t.why().forEach(l -> sb.append("- ").append(l).append('\n'));
        return sb.toString();
    }

    /**
     * Everything the model may draw numbers from: the template's own words ONLY — never the raw facts, whose ISO
     * dates and unshown values would let a "26 perc" through.
     */
    static String facts(Wording t) {
        StringBuilder sb = new StringBuilder(t.title()).append('\n').append(t.move());
        t.effectLines().forEach(l -> sb.append('\n').append(l));
        t.why().forEach(l -> sb.append('\n').append(l));
        return sb.toString();
    }

    /** The model's words when they parse, keep the line counts and bring no new digit run; else the template. */
    Wording accept(String raw, Wording template, String facts) {
        JsonNode node = parse(raw);
        if (node == null) {
            return template;
        }
        String title = str(node.get("title"));
        List<String> effects = lines(node.get("effectLines"));
        List<String> why = lines(node.get("why"));
        if (title == null || effects == null || effects.size() != template.effectLines().size()
            || why == null || why.size() != template.why().size()) {
            log.warn("Proposal wording answer was incomplete, using the template");
            return template;
        }
        String all = title + "\n" + String.join("\n", effects) + "\n" + String.join("\n", why);
        if (!DigitGuard.onlyKnownDigits(all, facts)) {
            log.warn("Proposal wording answer had a number the facts did not give, using the template");
            return template;
        }
        return new Wording(title, template.move(), effects, why);
    }

    private JsonNode parse(String raw) {
        if (raw == null) {
            return null;
        }
        int start = raw.indexOf('{');
        int end = raw.lastIndexOf('}');
        if (start < 0 || end <= start) {
            log.warn("Proposal wording answer had no JSON object, using the template");
            return null;
        }
        try {
            JsonNode node = objectMapper.readTree(raw.substring(start, end + 1));
            return node != null && node.isObject() ? node : null;
        } catch (Exception ex) {
            log.warn("Proposal wording answer unparseable, using the template: {}", ex.getMessage());
            return null;
        }
    }

    private static List<String> lines(JsonNode node) {
        if (node == null || !node.isArray()) {
            return null;
        }
        List<String> out = new ArrayList<>();
        for (JsonNode item : node) {
            String s = str(item);
            if (s == null) {
                return null;
            }
            out.add(s);
        }
        return out;
    }

    private static String str(JsonNode node) {
        if (node == null || !node.isString()) {
            return null;
        }
        String s = node.asString().trim();
        return s.isEmpty() ? null : s;
    }

    // ── the template (the spike's phrasing) ─────────────────────────────────

    /** The rule-built words: every number in them is a fact or an {@link Effects} figure. */
    public Wording template(ProposalDraft d, Effects e) {
        Map<String, Object> f = d.facts();
        return switch (d.kind()) {
            case "MOVE_SESSION_DAY" -> move(f, e);
            case "SHORTEN_SESSION" -> shorten(f, e);
            case "SKIP_SESSION" -> skip(f, e);
            case "SHIFT_BEDTIME" -> bedtime(f, e);
            case "MOVE_MEAL_ENERGY" -> meal(f, e);
            case "CALENDAR_TODO" -> todo(f);
            default -> new Wording("Átrendezési javaslat", "", List.of(evad(), "A napi keret nem változik",
                "Csak erre a hétre szól"), List.of());
        };
    }

    private static Wording move(Map<String, Object> f, Effects e) {
        LocalDate from = date(f, "fromDate");
        LocalDate to = date(f, "toDate");
        String time = s(f, "sessionTime");
        boolean empty = Boolean.TRUE.equals(f.get("toEmptyCalendar"));
        List<String> lines = new ArrayList<>();
        lines.add(load(e, from, to));
        Integer x = e.sessionKcal();
        lines.add(x != null && x > 0
            ? "Az edzésnapi " + x + "\u00A0kcal többlet " + HuDays.on(to) + " jár, amikor megcsinálod"
            : "Az edzésnapi többlet " + HuDays.on(to) + " jár, amikor megcsinálod");
        rest(e).ifPresent(lines::add);
        lines.add("A heti " + e.after().sessions() + " edzés megmarad, " + evadLower());
        List<String> why = new ArrayList<>();
        reasonLine(from, f.get("reason")).ifPresent(why::add);
        why.add(targetLine(to, empty, Boolean.TRUE.equals(f.get("toPrevLate")), e));
        patternLines(f, why);
        return new Wording(moveTitle(s(f, "sessionLabel"), from, to),
            HuDays.name(from) + " " + time + "  →  " + HuDays.name(to) + " " + time + (empty ? " (üres nap)" : ""),
            List.copyOf(lines), List.copyOf(why));
    }

    private static Wording shorten(Map<String, Object> f, Effects e) {
        LocalDate day = date(f, "fromDate");
        List<String> lines = new ArrayList<>();
        lines.add(load(e, day, null));
        Optional<DayEffect> de = e.day(day);
        Integer before = de.map(DayEffect::expectedExtraBefore).orElse(null);
        Integer after = de.map(DayEffect::expectedExtraAfter).orElse(null);
        lines.add(before != null && after != null
            ? "A " + HuDays.adj(day) + " edzésnapi többlet " + before + " helyett " + after
                + "\u00A0kcal, és akkor jár, amikor megcsinálod"
            : "A rövidebb edzéssel kisebb az edzésnapi többlet, és akkor jár, amikor megcsinálod");
        lines.add("A heti " + e.after().sessions() + " edzés megmarad, " + evadLower());
        List<String> why = new ArrayList<>();
        reasonLine(day, f.get("reason")).ifPresent(why::add);
        patternLines(f, why);
        return new Wording("A " + HuDays.adj(day) + " edzés legyen rövidebb",
            HuDays.name(day) + " " + s(f, "sessionTime") + "  ·  " + f.get("minutes") + " perc → "
                + f.get("minutesAfter") + " perc",
            List.copyOf(lines), List.copyOf(why));
    }

    private static Wording skip(Map<String, Object> f, Effects e) {
        LocalDate day = date(f, "fromDate");
        List<String> lines = new ArrayList<>();
        lines.add(load(e, day, null));
        Integer x = e.sessionKcal();
        lines.add(x != null && x > 0
            ? HuDays.the(x + "\u00A0kcal edzésnapi többlet", true) + " " + HuDays.on(day)
                + " nem jár, a napi keret nem változik"
            : "Az edzésnapi többlet " + HuDays.on(day) + " nem jár, a napi keret nem változik");
        lines.add("A heti edzés " + e.before().sessions() + " helyett " + e.after().sessions() + ", "
            + evadLower());
        List<String> why = new ArrayList<>();
        reasonLine(day, f.get("reason")).ifPresent(why::add);
        patternLines(f, why);
        return new Wording("A " + HuDays.adj(day) + " edzést most hagyd ki",
            HuDays.name(day) + " " + s(f, "sessionTime") + "  →  kihagyva", List.copyOf(lines), List.copyOf(why));
    }

    private static Wording bedtime(Map<String, Object> f, Effects e) {
        LocalDate night = date(f, "night");
        LocalDate next = date(f, "nextDate");
        int need = e.sleep() != null ? e.sleep().needMin() : 0;
        List<String> lines = new ArrayList<>();
        lines.add(HuDays.the(s(f, "eventEnd") + "-ig tartó esemény", true) + " után is meglesz "
            + HuDays.the(HuDays.duration(need) + " alvás", false));
        String first = s(f, "firstEventNext");
        lines.add(first != null
            ? HuDays.cap(HuDays.on(next)) + " " + first + "-kor kezdődik az első eseményed, így még belefér"
            : HuDays.cap(HuDays.on(next)) + " reggel nincs korábbi eseményed, így belefér");
        if (e.after().sleepHours() != null) {
            lines.add("A heti alvásterv (" + hours(e.after().sleepHours()) + " óra) nem változik");
        }
        lines.add(evad());
        List<String> why = new ArrayList<>();
        String title = s(f, "eventTitle");
        why.add(HuDays.cap(HuDays.on(night)) + " " + s(f, "eventEnd") + "-ig tart "
            + (title == null || title.isBlank() ? "egy eseményed" : HuDays.article(title) + " „" + title + "”"));
        why.add(HuDays.cap(HuDays.on(next)) + " " + s(f, "sessionBefore") + "-kor kezdődne az edzés, így rövid"
            + " lenne az éjszaka");
        patternLines(f, why);
        return new Wording(HuDays.cap(HuDays.on(night)) + " feküdj később, a " + HuDays.adj(next)
                + " edzés kezdődjön később",
            "lefekvés " + s(f, "bedtimeBefore") + " → " + s(f, "bedtimeAfter") + "  ·  " + HuDays.name(next)
                + " edzés " + s(f, "sessionBefore") + " → " + s(f, "sessionAfter"),
            List.copyOf(lines), List.copyOf(why));
    }

    private static Wording meal(Map<String, Object> f, Effects e) {
        LocalDate day = date(f, "date");
        List<String> lines = List.of(
            HuDays.the(s(f, "blockStart") + " és " + s(f, "blockEnd") + " közötti megbeszélések", true)
                + " előtt több energiád lesz",
            "A könnyebb vacsora után könnyebben pihensz",
            "A napi keret ugyanannyi marad");
        List<String> why = new ArrayList<>();
        reasonLine(day, f.get("reason")).ifPresent(why::add);
        patternLines(f, why);
        int lunch = ((Number) f.get("lunchKcal")).intValue();
        int dinner = ((Number) f.get("dinnerKcal")).intValue();
        return new Wording(HuDays.cap(HuDays.on(day)) + " egy nagyobb ebéd, kisebb vacsora",
            "ebéd " + signed(lunch) + "\u00A0kcal  ·  vacsora " + signed(dinner) + "\u00A0kcal", lines, List.copyOf(why));
    }

    private static Wording todo(Map<String, Object> f) {
        LocalDate day = date(f, "date");
        String title = s(f, "eventTitle");
        String named = title == null || title.isBlank() ? "eseményt" : "„" + title + "” eseményt";
        List<String> lines = List.of(
            "Az edzés előtt " + f.get("gapAfterMin") + " perc szünet marad " + f.get("gapBeforeMin")
                + " helyett, nem rohansz",
            "A naptáradhoz nem nyúlok: te teszed át, én észreveszem",
            "Az edzés és a napi keret nem változik");
        List<String> why = new ArrayList<>();
        reasonLine(day, f.get("reason")).ifPresent(why::add);
        patternLines(f, why);
        return new Wording("A " + HuDays.adj(day) + " " + named + " tedd egy órával korábbra",
            HuDays.name(day) + " " + s(f, "fromStart") + "–" + s(f, "fromEnd") + "  →  " + s(f, "toStart") + "–"
                + s(f, "toEnd"),
            lines, List.copyOf(why));
    }

    // ── shared phrasing ─────────────────────────────────────────────────────

    /** „A csütörtök túl sok helyett szoros lesz, a szombat laza helyett rendben” — the load model's verdicts. */
    private static String load(Effects e, LocalDate first, LocalDate second) {
        StringBuilder sb = new StringBuilder("A ").append(verdictChange(e, first, true));
        if (second != null) {
            sb.append(", a ").append(verdictChange(e, second, false));
        }
        return sb.toString();
    }

    private static String verdictChange(Effects e, LocalDate day, boolean first) {
        Optional<DayEffect> de = e.day(day);
        if (de.isEmpty()) {
            return HuDays.name(day) + " terhe nem változik";
        }
        String b = de.get().verdictBefore();
        String a = de.get().verdictAfter();
        if (b.equals(a)) {
            return HuDays.name(day) + " " + a + " marad";
        }
        return HuDays.name(day) + " " + b + " helyett " + a + (first ? " lesz" : "");
    }

    /**
     * The move's title. A vetted label takes its table form („A lábnapot tedd át szombatra”); any other label is never
     * suffixed and goes after a colon („Tedd át szombatra ezt az edzést: Pull 1”); no label → the day's adjective.
     */
    static String moveTitle(String label, LocalDate from, LocalDate to) {
        Optional<String> acc = HuDays.accusative(label);
        if (acc.isPresent()) {
            return HuDays.the(acc.get(), true) + " tedd át " + HuDays.onto(to);
        }
        if (label != null && !label.isBlank()) {
            return "Tedd át " + HuDays.onto(to) + " ezt az edzést: " + label.strip();
        }
        return "A " + HuDays.adj(from) + " edzést tedd át " + HuDays.onto(to);
    }

    /** Why the target day is good for the session — not its load drivers. */
    private static String targetLine(LocalDate to, boolean empty, boolean prevLate, Effects e) {
        String on = HuDays.cap(HuDays.on(to));
        if (empty) {
            return on + " üres a naptárad" + (prevLate ? "" : ", és előtte nincs késői program");
        }
        String after = e.day(to).map(DayEffect::verdictAfter).orElse(null);
        return after == null ? on + " kevesebb a dolgod"
            : on + " kevesebb a dolgod: az edzéssel együtt is " + after + " lesz a nap";
    }

    private static Optional<String> rest(Effects e) {
        return e.rest().stream().findFirst().map((RestEffect r) -> {
            String label = r.label() == null || r.label().isBlank() ? "sport" : r.label();
            return r.after() == 0
                ? "A " + HuDays.adj(r.sportDate()) + " " + label + " előtt nem marad pihenőnap"
                : "A " + HuDays.adj(r.sportDate()) + " " + label + " előtt " + r.after() + " pihenőnap marad";
        });
    }

    private static Optional<String> reasonLine(LocalDate day, Object reason) {
        return reason instanceof String r && !r.isBlank()
            ? Optional.of("Amit " + HuDays.on(day) + " látok: " + r) : Optional.empty();
    }

    private static void patternLines(Map<String, Object> f, List<String> why) {
        if (f.get("patternLines") instanceof List<?> lines) {
            for (Object l : lines) {
                why.add("Amit a múltból tudok: " + l);
            }
        }
    }

    private static String evad() {
        return "Az Évad terve nem változik";
    }

    private static String evadLower() {
        return "az Évad terve nem változik";
    }

    private static String hours(double h) {
        return h == Math.rint(h) ? String.valueOf((long) h) : String.valueOf(h).replace('.', ',');
    }

    private static String signed(int kcal) {
        return kcal > 0 ? "+" + kcal : "−" + Math.abs(kcal);
    }

    private static LocalDate date(Map<String, Object> f, String key) {
        return LocalDate.parse(String.valueOf(f.get(key)));
    }

    private static String s(Map<String, Object> f, String key) {
        Object v = f.get(key);
        return v == null ? null : String.valueOf(v);
    }
}
