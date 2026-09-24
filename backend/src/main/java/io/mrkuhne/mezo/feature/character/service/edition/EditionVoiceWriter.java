package io.mrkuhne.mezo.feature.character.service.edition;

import io.mrkuhne.mezo.feature.auth.service.PromptPersona;
import io.mrkuhne.mezo.feature.character.service.CharacterCouncilBudget;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.TreeSet;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

/**
 * Az esti kiadás hangja (Task 13, csapatfal II. spec 2026-09-24 §3.4): a kiválasztott posztok a
 * karakterek saját hangján szólalnak meg — <b>kiadásonként EGYETLEN</b> LLM-hívásból, mert a
 * válogatás már megtörtént, és öt külön hívás ötször annyiba kerülne ugyanazért a napért.
 *
 * <p>Három dolog teszi ezt biztonságossá:
 * <ul>
 *   <li><b>Tény-őr</b> ({@link EditionVoiceGuard}) posztonként: egy kitalált szám, egy idegen emoji
 *       vagy egy szaknyelvi szó miatt AZ A poszt visszaesik a nyers rekordszövegre — a többi
 *       hangos marad.</li>
 *   <li><b>Soha nem dob</b>: parse-hiba, LLM-hiba, kimerült keret → minden poszt
 *       {@code voiced=false}, és a kiadás ettől még megjelenik (ADR 0049).</li>
 *   <li><b>Saját keret-ciklus</b>: a hívás a {@link CharacterCouncilBudget}-en át megy, de a
 *       konzílium futása UTÁN, tehát a saját ciklusában — nem eszi el a konzílium hívásait.</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = {FeaturesConfiguration.CHARACTER_SWITCH, FeaturesConfiguration.COMPANION_SWITCH,
        FeaturesConfiguration.TEAM_EDITION_SWITCH}, havingValue = "true")
public class EditionVoiceWriter {

    /** A prompt ELSŐ sora — a {@code FakeCompanionLlm} erre kulcsolja a determinisztikus válaszát. */
    public static final String EDITION_MARKER = "CSAPATFAL-ESTI-KIADAS";

    /** Az {@code LlmCallContext} feature-slugja; a {@code throttled-features} listán is ez szerepel. */
    public static final String FEATURE = "character_edition";

    private static final String RULES = """
            Egy öttagú csapat esti posztjait írod át a karakterek saját hangján. Minden poszt EGY forrás-rekord
            átfogalmazása. A felhasználó neve: {{NÉV}}.
            Szabályok: 2–4 mondat; a megadott tényeken kívül SEMMILYEN számot nem írhatsz; tilos új állítás; a
            bizonytalanság bizonytalan marad („lehet”, „kezd úgy tűnni”, „még csak sejtem”); a **kiemelés** két
            csillaggal; emoji csak a karakter saját készletéből, mértékkel; a Szkeptikus nem használ emojit;
            szaknyelv tilos.
            Vendégek: ha egy posztnál „vendégek:” sor áll, az ott felsorolt karakterek (és csak ők) egy-egy
            1–2 mondatos sorral reagálhatnak a posztra, a saját hangjukon, ugyanezekkel a szabályokkal; a
            Szkeptikus sora mindig az alternatív magyarázatot kínálja, emoji nélkül.""";

    private static final String ANSWER_CONTRACT =
            "Válasz: KIZÁRÓLAG JSON tömb: [{\"rank\":1,\"title\":\"…vagy null\",\"body\":\"…\","
                    + "\"guests\":[{\"character\":\"falat\",\"body\":\"…\"}]}] — a guests elhagyható, "
                    + "legfeljebb 2 elem, a character a vendég kulcsa ("
                    + Arrays.stream(TeamCharacter.values()).map(TeamCharacter::key).collect(Collectors.joining(", "))
                    + ")";

    /** A műfaj egy mondatban — ez mondja meg a karakternek, MIT csinál ezzel a rekorddal. */
    private static final Map<EditionGenre, String> GENRE_HINT = Map.of(
            EditionGenre.MEGFIGYELES, "megerősített megfigyelés",
            EditionGenre.SEJTES, "még gyűlik az adat — semmit ne állíts, csak a gyűjtésről beszélj",
            EditionGenre.KERDES, "döntés vár rá — kérdezz",
            EditionGenre.KISERLET, "futó kísérlet mérföldköve",
            EditionGenre.ELOREJELZES, "lezárt előrejelzés",
            EditionGenre.KONZILIUM, "a csapat mai vitájának szála",
            EditionGenre.KERES, "adatkérés",
            EditionGenre.ERTEKELES, "napi értékelés");

    static final String SYSTEM_PROMPT = EDITION_MARKER + "\n" + RULES + PromptPersona.VOICE_HU
            + "\nKarakterek:\n" + characterBlock() + "\n" + ANSWER_CONTRACT + "\n";

    private final CompanionLlm companionLlm;
    private final LlmCallContextHolder llmCallContextHolder;
    private final PromptPersona promptPersona;
    private final CharacterCouncilBudget budget;
    private final ObjectMapper objectMapper;

    /** A modell egy poszt-átirata. A {@code rank} köti a jelölthöz; minden más mező opcionális. */
    private record Draft(Integer rank, String title, String body, List<GuestDraft> guests) {
    }

    /** A modell egy vendég-sora; a {@code character} a {@link TeamCharacter#key()}. */
    private record GuestDraft(String character, String body) {
    }

    /**
     * A rangsorolt jelöltek szövege, AZONOS hosszban és sorrendben. Soha nem dob: a hibás vagy
     * hiányzó elemek a jelölt saját rekordszövegére esnek vissza ({@code voiced=false}).
     */
    public List<VoicedText> write(UUID owner, List<EditionCandidate> ranked) {
        List<VoicedText> fallback = ranked.stream()
                .map(c -> new VoicedText(c.title(), c.recordText(), false, guests(c, null)))
                .toList();
        if (ranked.isEmpty()) {
            return fallback;
        }
        List<Draft> drafts;
        try {
            String system = promptPersona.render(owner, SYSTEM_PROMPT);
            String user = userMessage(ranked);
            String raw = budget.run(owner, false, () -> llmCallContextHolder.runWith(
                    new LlmCallContext(FEATURE, "voice", "team_edition", null),
                    () -> companionLlm.complete(system, user)));
            drafts = parse(raw, owner);
        } catch (RuntimeException e) {
            log.warn("Edition voice call failed for owner {} — every post keeps its record text", owner, e);
            return fallback;
        }
        if (drafts == null) {
            return fallback;
        }
        Map<Integer, Draft> byRank = new HashMap<>();
        for (Draft draft : drafts) {
            if (draft != null && draft.rank() != null) {
                byRank.putIfAbsent(draft.rank(), draft);
            }
        }
        List<VoicedText> out = new ArrayList<>(ranked.size());
        for (int i = 0; i < ranked.size(); i++) {
            EditionCandidate candidate = ranked.get(i);
            Draft draft = byRank.get(i + 1);
            List<VoicedGuest> guests = guests(candidate, draft);
            VoicedText post = voiced(candidate, draft).orElse(fallback.get(i));
            out.add(new VoicedText(post.title(), post.body(), post.voiced(), guests));
        }
        return List.copyOf(out);
    }

    /** Egy átirat a tény-őr után — üres, ha bármelyik szabály megbukott (a hívó visszaesik). */
    private Optional<VoicedText> voiced(EditionCandidate candidate, Draft draft) {
        if (draft == null || draft.body() == null || draft.body().isBlank()) {
            return Optional.empty();
        }
        String body = draft.body().strip();
        Optional<String> rejected = EditionVoiceGuard.check(candidate.character(), body,
                candidate.facts(), candidate.recordText());
        if (rejected.isPresent()) {
            log.info("Edition voice rejected for source {} ({}) — falling back to the record text",
                    candidate.sourceKey(), rejected.get());
            return Optional.empty();
        }
        return Optional.of(new VoicedText(title(candidate, draft), body, true));
    }

    /**
     * A jelölt vendég-sorai a magok sorrendjében (H4, mezo-a9bo7.15): a modell sora az adott
     * karakterre, ha átmegy a {@link EditionVoiceGuard#checkGuest} őrön ({@code voiced=true}); különben
     * a mag saját visszaesése ({@code voiced=false}); ha az sincs, a vendég kimarad. A magok közt nem
     * szereplő karakterek sorai figyelmen kívül maradnak. A poszt sorsát ez nem érinti.
     */
    private List<VoicedGuest> guests(EditionCandidate candidate, Draft draft) {
        if (candidate.guests().isEmpty()) {
            return List.of();
        }
        Map<String, String> modelLines = new HashMap<>();
        if (draft != null && draft.guests() != null) {
            for (GuestDraft guest : draft.guests()) {
                if (guest != null && guest.character() != null && guest.body() != null) {
                    modelLines.putIfAbsent(guest.character().strip().toLowerCase(Locale.ROOT),
                            guest.body().strip());
                }
            }
        }
        List<VoicedGuest> out = new ArrayList<>(candidate.guests().size());
        for (GuestSeed seed : candidate.guests()) {
            String line = modelLines.get(seed.character().key());
            if (line != null) {
                Optional<String> rejected = EditionVoiceGuard.checkGuest(seed.character(), line,
                        candidate.facts(), candidate.recordText());
                if (rejected.isEmpty()) {
                    out.add(new VoicedGuest(seed.character(), line, true));
                    continue;
                }
                log.info("Edition guest line rejected for source {} / {} ({})",
                        candidate.sourceKey(), seed.character().key(), rejected.get());
            }
            if (seed.fallbackText() != null && !seed.fallbackText().isBlank()) {
                out.add(new VoicedGuest(seed.character(), seed.fallbackText(), false));
            }
        }
        return List.copyOf(out);
    }

    /** A modell címe csak akkor nyer, ha a tény-őr azt is átengedi; különben a rekord saját címe. */
    private String title(EditionCandidate candidate, Draft draft) {
        String title = draft.title() == null ? null : draft.title().strip();
        if (title == null || title.isBlank()) {
            return candidate.title();
        }
        return EditionVoiceGuard.checkTitle(candidate.character(), title, candidate.facts(), candidate.recordText())
                .isPresent() ? candidate.title() : title;
    }

    private List<Draft> parse(String raw, UUID owner) {
        try {
            return objectMapper.readValue(stripFences(raw), new TypeReference<List<Draft>>() { });
        } catch (Exception e) {
            log.warn("Edition voice answer was not parseable JSON for owner {} — dropping: {}", owner, raw, e);
            return null;
        }
    }

    /** Strips optional ```json fences (and surrounding prose) — mirrors KonziliumProposalRound's idiom. */
    private static String stripFences(String raw) {
        String trimmed = raw.strip();
        if (trimmed.startsWith("```")) {
            int firstNewline = trimmed.indexOf('\n');
            trimmed = firstNewline >= 0 ? trimmed.substring(firstNewline + 1) : trimmed;
            int fenceEnd = trimmed.lastIndexOf("```");
            if (fenceEnd >= 0) {
                trimmed = trimmed.substring(0, fenceEnd);
            }
        }
        int start = trimmed.indexOf('[');
        int end = trimmed.lastIndexOf(']');
        return start >= 0 && end > start ? trimmed.substring(start, end + 1) : trimmed.strip();
    }

    /** A karakter-blokk determinisztikus (rendezett emoji-készlet) — a prompt bájtra azonos marad. */
    private static String characterBlock() {
        return Arrays.stream(TeamCharacter.values())
                .map(c -> "- " + c.displayName()
                        + (c.area().isBlank() ? "" : " · " + c.area())
                        + " · " + (c.emoji().isEmpty() ? "emoji nélkül"
                                : "emoji: " + String.join(" ", new TreeSet<>(c.emoji())))
                        + " · " + c.voice())
                .collect(Collectors.joining("\n"));
    }

    /**
     * Posztonként egy blokk. Minden mező egy sorba van hajtva (a rekordszövegben lévő sortörés
     * szóközzé válik), így a blokk-határ egyértelmű marad — a {@code FakeCompanionLlm} ugyanezt a
     * szerkezetet olvassa vissza.
     */
    private String userMessage(List<EditionCandidate> ranked) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < ranked.size(); i++) {
            EditionCandidate c = ranked.get(i);
            sb.append("[poszt ").append(i + 1).append("]\n");
            sb.append("karakter: ").append(c.character().displayName());
            if (!c.character().area().isBlank()) {
                sb.append(" · ").append(c.character().area());
            }
            sb.append('\n');
            sb.append("műfaj: ").append(c.genre().key())
                    .append(" — ").append(GENRE_HINT.getOrDefault(c.genre(), c.genre().key())).append('\n');
            if (c.title() != null && !c.title().isBlank()) {
                sb.append("cím: ").append(oneLine(c.title())).append('\n');
            }
            sb.append("rekord: ").append(oneLine(c.recordText())).append('\n');
            if (c.facts() != null && !c.facts().isEmpty()) {
                sb.append("tények: ").append(String.join("; ", c.facts())).append('\n');
            }
            if (!c.guests().isEmpty()) {
                sb.append("vendégek: ").append(c.guests().stream()
                        .map(g -> g.character().displayName())
                        .collect(Collectors.joining("; "))).append('\n');
            }
            sb.append('\n');
        }
        return sb.toString().strip();
    }

    private static String oneLine(String text) {
        return text == null ? "" : text.replaceAll("\\s+", " ").strip();
    }
}
