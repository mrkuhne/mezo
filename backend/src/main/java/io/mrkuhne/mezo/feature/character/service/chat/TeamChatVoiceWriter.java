package io.mrkuhne.mezo.feature.character.service.chat;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.mrkuhne.mezo.feature.auth.service.PromptPersona;
import io.mrkuhne.mezo.feature.character.entity.TeamChatThreadEntity;
import io.mrkuhne.mezo.feature.character.service.edition.EditionVoiceGuard;
import io.mrkuhne.mezo.feature.character.service.edition.TeamCharacter;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.TreeSet;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

/**
 * The team chat voice (Csapatfal Act III Task 9, mezo-a9bo7.22, spec 2026-09-26 §5.3–5.4): ONE
 * guarded LLM call per event writes the owner's line, the cross-talk guest's line and — only when
 * the frozen payload shows a real coverage gap — one dry Szkeptikus line.
 *
 * <p>Mirrors {@code EditionVoiceWriter}'s call and guard, with three differences:
 * <ul>
 *   <li><b>Own budget:</b> the {@link TeamChatBudget} monthly USD cap, checked BEFORE the call; the
 *       call does NOT run under {@code CharacterCouncilBudget} (that quota is the konzílium's).</li>
 *   <li><b>Owner first:</b> the owner's line failing the guard sends the WHOLE event back to the
 *       template — a guest or a Szkeptikus never talks next to a template line. A guest / skeptic
 *       line failing on its own is simply dropped.</li>
 *   <li><b>Never throws:</b> no room, an LLM failure or an unparseable answer → the template line
 *       with {@code voiced=false} (ADR 0049).</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.CHARACTER_SWITCH, FeaturesConfiguration.COMPANION_SWITCH,
                FeaturesConfiguration.PROACTIVE_SWITCH, FeaturesConfiguration.INTERVENTION_SWITCH,
                FeaturesConfiguration.TEAM_CHAT_SWITCH},
        havingValue = "true")
public class TeamChatVoiceWriter {

    /** The prompt's FIRST line — {@code FakeCompanionLlm} mirrors it literally to dispatch on. */
    public static final String MARKER = "CSAPATFAL-ELO-BESZELGETES";

    /** The rapid-weight-loss trend's own fixed window ({@code RapidWeightLossRule}: today − 6 .. today). */
    static final int WEIGHT_TREND_WINDOW_DAYS = 7;

    static final String KIND_OPEN = "OPEN";

    private static final String RULES = """
            Egy öttagú csapat élő beszélgetésébe írsz sorokat, a karakterek saját hangján. A felhasználó
            neve: {{NÉV}}.
            Szabályok: a gazda sora 2–4 mondat, a vendégé és a Szkeptikusé 1–2 mondat; a „tények:” és a
            „teendő:” sorokon kívül SEMMILYEN számot nem írhatsz (a háttérből sem); tilos új állítás; a
            bizonytalanság bizonytalan marad; emoji csak a karakter saját készletéből, mértékkel; a
            Szkeptikus nem használ emojit; szaknyelv tilos.""";

    private static final String ANSWER_CONTRACT = "\nVálasz: KIZÁRÓLAG JSON objektum: "
            + "{\"owner\":\"…\",\"guest\":\"…vagy null\",\"skeptic\":\"…vagy null\"} — a guest csak akkor, "
            + "ha a „vendég:” sor kéri, a skeptic csak akkor, ha a „szkeptikus:” sor kéri; különben null.\n";

    static final String SYSTEM_PROMPT = MARKER + "\n" + RULES + PromptPersona.VOICE_HU + ANSWER_CONTRACT;

    private final CompanionLlm companionLlm;
    private final LlmCallContextHolder llmCallContextHolder;
    private final PromptPersona promptPersona;
    private final TeamChatBudget budget;
    private final TeamChatContext context;
    private final ObjectMapper objectMapper;

    /** The model's answer; every field optional. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    private record Draft(String owner, String guest, String skeptic) {
    }

    /**
     * The lines for one event on {@code thread}. {@code kind} is {@code OPEN} or {@code RESOLVE};
     * {@code facts} are the ONLY numbers a voiced line may carry; {@code templateText} is both the
     * teendő the model rephrases and the fallback. Never throws.
     */
    public TeamChatLines write(UUID owner, TeamChatThreadEntity thread, String kind, List<String> facts,
            String templateText, boolean skepticEligible) {
        TeamChatLines fallback = TeamChatLines.template(templateText);
        TeamCharacter ownerCharacter = character(thread.getOwnerCharacter());
        if (ownerCharacter == null) {
            return fallback;
        }
        Optional<TeamCharacter> guest = Optional.ofNullable(character(thread.getGuestCharacter()));
        boolean open = KIND_OPEN.equals(kind);
        boolean askSkeptic = skepticEligible && open;
        Draft draft;
        try {
            if (!budget.hasRoom(owner)) {
                log.info("Team chat budget spent for user {} — ügy {} keeps the template line", owner, thread.getId());
                return fallback;
            }
            Instant at = thread.getClosedAt() != null ? thread.getClosedAt() : thread.getOpenedAt();
            TeamChatContextBlock background = context.build(owner, thread, at);
            String system = promptPersona.render(owner, SYSTEM_PROMPT);
            String user = userMessage(ownerCharacter, guest, open, facts, templateText, background, askSkeptic);
            String raw = llmCallContextHolder.runWith(
                    new LlmCallContext(TeamChatBudget.FEATURE, kind.toLowerCase(Locale.ROOT), "team_chat_thread",
                            thread.getId()),
                    () -> companionLlm.complete(system, user));
            draft = objectMapper.readValue(stripFences(raw), Draft.class);
        } catch (RuntimeException e) {
            log.warn("Team chat voice call failed for user {} ügy {} — template line", owner, thread.getId(), e);
            return fallback;
        }
        if (draft == null || draft.owner() == null || draft.owner().isBlank()) {
            return fallback;
        }
        String ownerBody = draft.owner().strip();
        Optional<String> rejected = EditionVoiceGuard.check(ownerCharacter, ownerBody, facts, templateText);
        if (rejected.isPresent()) {
            log.info("Team chat owner line rejected on ügy {} ({}) — template line, no guest", thread.getId(),
                    rejected.get());
            return fallback;
        }
        Optional<String> guestBody = guest.flatMap(g -> side(g, draft.guest(), facts, templateText, thread));
        Optional<String> skepticBody = askSkeptic
                ? side(TeamCharacter.SZKEPTIKUS, draft.skeptic(), facts, templateText, thread)
                : Optional.empty();
        return new TeamChatLines(ownerBody, true, guestBody, skepticBody);
    }

    /** A guest / skeptic line after {@link EditionVoiceGuard#checkGuest} — empty when missing or rejected. */
    private static Optional<String> side(TeamCharacter who, String body, List<String> facts, String templateText,
            TeamChatThreadEntity thread) {
        if (body == null || body.isBlank() || "null".equalsIgnoreCase(body.strip())) {
            return Optional.empty();
        }
        String line = body.strip();
        Optional<String> rejected = EditionVoiceGuard.checkGuest(who, line, facts, templateText);
        if (rejected.isPresent()) {
            log.info("Team chat {} line rejected on ügy {} ({}) — dropped", who.key(), thread.getId(), rejected.get());
            return Optional.empty();
        }
        return Optional.of(line);
    }

    /**
     * Whether the Szkeptikus may speak on this raise: only when the rule's frozen payload shows an
     * input it could NOT observe (spec §5.4, ADR 0049 — never fabricated doubt).
     */
    public static boolean skepticEligible(String flagKey, FlagPayloadEnvelope payload) {
        return skepticGap(flagKey, payload).isPresent();
    }

    /**
     * The honest coverage-gap fact behind a Szkeptikus line, read from the raise's own frozen payload —
     * appended to the event's facts so the guard allows its numbers. Covered rules:
     * <ul>
     *   <li>{@code sleep_debt}: logged nights below the window's nights;</li>
     *   <li>{@code load_fuel_mismatch}: kcal and/or sleep logged on fewer days than the window;</li>
     *   <li>{@code rapid_weight_loss}: fewer weigh-in days than the trend's fixed 7-day window.</li>
     * </ul>
     * {@code recovery_needed} never has one — the rule raises only when sleep, RPE AND stress are all
     * observed. Every other rule: empty (no payload signal mapped).
     */
    public static Optional<String> skepticGap(String flagKey, FlagPayloadEnvelope payload) {
        if (flagKey == null || payload == null) {
            return Optional.empty();
        }
        return switch (flagKey) {
            case FlagKey.SLEEP_DEBT -> sleepDebtGap(payload.sleepDebt());
            case FlagKey.LOAD_FUEL_MISMATCH -> loadFuelGap(payload.loadFuelMismatch());
            case FlagKey.RAPID_WEIGHT_LOSS -> weightGap(payload.rapidWeightLoss());
            default -> Optional.empty();
        };
    }

    private static Optional<String> sleepDebtGap(FlagPayloadEnvelope.SleepDebt p) {
        if (p == null || p.loggedNights() >= p.nights()) {
            return Optional.empty();
        }
        return Optional.of("Hiányzó adat: a %d éjszakából %d nincs rögzítve"
                .formatted(p.nights(), p.nights() - p.loggedNights()));
    }

    private static Optional<String> loadFuelGap(FlagPayloadEnvelope.LoadFuelMismatch p) {
        if (p == null) {
            return Optional.empty();
        }
        List<String> gaps = new ArrayList<>();
        if (p.kcalLoggedDays() < p.windowDays()) {
            gaps.add("%d napon nincs rögzített kalória".formatted(p.windowDays() - p.kcalLoggedDays()));
        }
        if (p.sleepLoggedDays() < p.windowDays()) {
            gaps.add("%d éjszakán nincs rögzített alvás".formatted(p.windowDays() - p.sleepLoggedDays()));
        }
        return gaps.isEmpty() ? Optional.empty()
                : Optional.of("Hiányzó adat: az utolsó %d napból %s".formatted(p.windowDays(), String.join(", ", gaps)));
    }

    private static Optional<String> weightGap(FlagPayloadEnvelope.RapidWeightLoss p) {
        if (p == null || p.weighInCount() >= WEIGHT_TREND_WINDOW_DAYS) {
            return Optional.empty();
        }
        return Optional.of("Hiányzó adat: a %d napos súlytrend %d napján nincs mérés"
                .formatted(WEIGHT_TREND_WINDOW_DAYS, WEIGHT_TREND_WINDOW_DAYS - p.weighInCount()));
    }

    private static TeamCharacter character(String key) {
        if (key == null || key.isBlank()) {
            return null;
        }
        try {
            return TeamCharacter.valueOf(key.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    /**
     * The event block. Fixed line prefixes ({@code tények:} with one {@code - } line per fact,
     * {@code vendég:}, {@code szkeptikus:}) — the {@code FakeCompanionLlm} reads the same shape back.
     */
    private static String userMessage(TeamCharacter owner, Optional<TeamCharacter> guest, boolean open,
            List<String> facts, String templateText, TeamChatContextBlock background, boolean askSkeptic) {
        StringBuilder sb = new StringBuilder();
        sb.append("karakter: ").append(describe(owner)).append(" · ").append(owner.voice()).append('\n');
        sb.append("helyzet: ").append(open
                ? "most kapcsolt be: mondd el, mi a teendő"
                : "rendeződött: zárd le röviden").append('\n');
        sb.append("tények:\n");
        for (String fact : facts == null ? List.<String>of() : facts) {
            sb.append("- ").append(oneLine(fact)).append('\n');
        }
        sb.append("teendő: ").append(oneLine(templateText)).append('\n');
        sb.append("háttér — számot innen NE írj:\n");
        section(sb, "ma eddig", background.todayLines());
        section(sb, "korábbi esetek", background.pastEpisodes());
        section(sb, "reakciók", background.reactions());
        section(sb, "tudás", background.knowledge());
        guest.ifPresent(g -> sb.append("vendég: ").append(g.displayName()).append(" (").append(describe(g))
                .append(") egy mondattal hozzáteszi a saját területéről\n"));
        if (askSkeptic) {
            sb.append("szkeptikus: a Szkeptikus egy száraz mondatban megjegyzi, mi becsült/hiányzik (emoji nélkül)\n");
        }
        return sb.toString().strip();
    }

    private static String describe(TeamCharacter c) {
        return c.displayName()
                + (c.area().isBlank() ? "" : " · " + c.area())
                + " · " + (c.emoji().isEmpty() ? "emoji nélkül" : "emoji: " + String.join(" ", new TreeSet<>(c.emoji())));
    }

    private static void section(StringBuilder sb, String label, List<String> items) {
        if (items == null || items.isEmpty()) {
            return;
        }
        sb.append("  ").append(label).append(":\n");
        for (String item : items) {
            sb.append("  • ").append(oneLine(item)).append('\n');
        }
    }

    /** Strips optional ```json fences and surrounding prose down to the outermost JSON object. */
    private static String stripFences(String raw) {
        String trimmed = raw.strip();
        int start = trimmed.indexOf('{');
        int end = trimmed.lastIndexOf('}');
        return start >= 0 && end > start ? trimmed.substring(start, end + 1) : trimmed;
    }

    private static String oneLine(String text) {
        return text == null ? "" : text.replaceAll("\\s+", " ").strip();
    }
}
