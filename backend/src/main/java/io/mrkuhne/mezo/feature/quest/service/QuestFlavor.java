package io.mrkuhne.mezo.feature.quest.service;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import io.mrkuhne.mezo.feature.quest.repository.DailyQuestRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

/**
 * Companion flavor copy on daily quests (E3, bd mezo-6ng8, ADR 0010): the cheap-tier LLM may
 * rewrite title/why in the companion's voice — NEVER the metric, threshold, XP or skill. Runs on
 * the morning cron path only (QuestJob); the lazy read path and rerolls keep catalog copy. Any
 * failure — LLM error, unparseable answer, count mismatch, invalid entry — quietly keeps the
 * catalog copy: flavor is a garnish, the offer is already correct without it.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
    name = {FeaturesConfiguration.QUEST_SWITCH, FeaturesConfiguration.COMPANION_SWITCH,
        FeaturesConfiguration.QUEST_FLAVOR_SWITCH},
    havingValue = "true")
public class QuestFlavor {

    /** First word of the system prompt — FakeCompanionLlm mirrors it (literal, no import back). */
    public static final String FLAVOR_MARKER = "KULDETES-IZESITES-FELADAT";

    private static final int TITLE_MAX = 160;
    private static final int WHY_MAX = 600;

    private static final String FLAVOR_PROMPT = FLAVOR_MARKER + """
        : Az alábbi napi küldetések szövegét írd át a társ (companion) hangján: magyar, tegező,
        identitás-szavazat (nem pont-tranzakció), a valós életbeli haszon elöl. A CÉLOKAT, a
        számokat és a mértékegységeket NE változtasd meg — csak a megfogalmazást. Válaszolj
        KIZÁRÓLAG egy JSON tömbbel, pontosan annyi elemmel és abban a sorrendben, ahogy a
        bemenet: [{"title": "<max 160 karakter>", "why": "<1-2 mondat>"}, ...]""";

    private final CompanionLlm companionLlm;
    private final ObjectMapper objectMapper;
    private final DailyQuestRepository repository;

    private record Copy(String title, String why) {}

    /** Rewrites title/why of the given quests in place; persists only the valid rewrites. */
    @Transactional
    public void rewrite(List<DailyQuestEntity> quests) {
        if (quests.isEmpty()) {
            return;
        }
        StringBuilder input = new StringBuilder();
        for (int i = 0; i < quests.size(); i++) {
            DailyQuestEntity q = quests.get(i);
            input.append(i + 1).append(". [").append(q.getSlot()).append("] ")
                .append(q.getTitle()).append(" — ").append(q.getWhy())
                .append(" (cél: ").append(q.getTarget().metric())
                .append(", +").append(q.getXp()).append(" XP)\n");
        }
        String raw;
        try {
            raw = companionLlm.complete(FLAVOR_PROMPT, input.toString());
        } catch (Exception e) {
            log.warn("Quest flavor rewrite failed, keeping catalog copy: {}", e.getMessage());
            return;
        }
        List<Copy> copies = parse(raw);
        if (copies == null || copies.size() != quests.size()) {
            log.warn("Quest flavor answer invalid ({} entries for {} quests) — catalog copy kept",
                copies == null ? "unparseable" : copies.size(), quests.size());
            return;
        }
        for (int i = 0; i < quests.size(); i++) {
            Copy c = copies.get(i);
            if (valid(c)) {
                DailyQuestEntity q = quests.get(i);
                q.setTitle(c.title().strip());
                q.setWhy(c.why().strip());
                repository.save(q);
            }
        }
    }

    private List<Copy> parse(String raw) {
        int start = raw.indexOf('[');
        int end = raw.lastIndexOf(']');
        if (start < 0 || end <= start) {
            return null;
        }
        try {
            return objectMapper.readValue(raw.substring(start, end + 1), new TypeReference<List<Copy>>() {});
        } catch (Exception e) {
            return null;
        }
    }

    private static boolean valid(Copy c) {
        return c != null && c.title() != null && !c.title().isBlank() && c.title().strip().length() <= TITLE_MAX
            && c.why() != null && !c.why().isBlank() && c.why().strip().length() <= WHY_MAX;
    }
}
