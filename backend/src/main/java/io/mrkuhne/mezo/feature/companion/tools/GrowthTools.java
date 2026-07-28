package io.mrkuhne.mezo.feature.companion.tools;

import io.mrkuhne.mezo.api.dto.AchievementsResponse;
import io.mrkuhne.mezo.api.dto.BadgeResponse;
import io.mrkuhne.mezo.api.dto.GamificationProfileResponse;
import io.mrkuhne.mezo.api.dto.GrowthWeekResponse;
import io.mrkuhne.mezo.api.dto.PerkUnlockResponse;
import io.mrkuhne.mezo.api.dto.ProgressionProfileResponse;
import io.mrkuhne.mezo.api.dto.SkillLevel;
import io.mrkuhne.mezo.feature.gamification.TitleCatalog;
import io.mrkuhne.mezo.feature.gamification.service.GamificationService;
import io.mrkuhne.mezo.feature.progression.service.AchievementService;
import io.mrkuhne.mezo.feature.progression.service.GrowthWeekService;
import io.mrkuhne.mezo.feature.progression.service.ProgressionService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * V0.5 read tool over the gamified-growth features (mezo-xixu): account XP/level, per-skill
 * levels/XP, the weekly growth rollup, achievements/perks, and titles. Read-only, ownership-scoped
 * via ToolContext (never model args), honest "nincs adat"/ghost renders per each backing
 * service's own philosophy — spec §5/§6.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class GrowthTools {

    /** get_growth's supported scope values; anything else (incl. null) falls back to "skills". */
    private static final List<String> GROWTH_SCOPES = List.of("skills", "week", "achievements", "titles");

    /** Pure read (ungated) — skill levels/XP + athlete-level/radar over the fixed taxonomy. */
    private final ProgressionService progressionService;
    /** Pure read (ungated) — the weekly rollup (closed quests, LIFE XP, activities, savings). */
    private final GrowthWeekService growthWeekService;
    /** Pure read (ungated) — the 9 derive-on-read badges + persisted perk unlocks. */
    private final AchievementService achievementService;
    /** Pure read (ungated) — static title catalog (key -> Hungarian display name), the
     *  {@link io.mrkuhne.mezo.feature.progression.PerkCatalog} loading idiom, used to resolve
     *  scope=titles' raw title keys to their user-facing names. */
    private final TitleCatalog titleCatalog;
    /** GAMIFICATION_SWITCH-gated independent of COMPANION_SWITCH: read defensively via ObjectProvider
     *  (the BiometricsTools#sleepGoalService precedent) so a disabled gamification feature degrades
     *  scope=skills' account level/XP/streak line to silence, and scope=titles entirely to "nincs
     *  adat", rather than failing Spring context startup. */
    private final ObjectProvider<GamificationService> gamificationService;

    @Tool(name = "get_growth", description = "Növekedés/gamifikáció: XP, szintek, skillek, streak, "
            + "eredmények, címek. scope=skills (alapértelmezés) — account szint + összes XP + élő "
            + "streak (ha van), és minden skill (athletic/izom/life) szintje + felhalmozott XP-je, "
            + "ahol van már előrehaladás. scope=week — e heti összefoglaló: lezárt küldetések, "
            + "megszerzett LIFE XP, naplózott tevékenységek, megtakarítás. scope=achievements — "
            + "mind a 9 jelvény állása (elért/cél) + a feloldott perkek. scope=titles — a "
            + "felszerelt cím és a birtokolt címek listája. Használd, amikor a user XP-ről, "
            + "szintekről, skillekről, streakről, címekről vagy eredményekről kérdez. scope: skills "
            + "(alapértelmezés), week, achievements, titles.")
    public String getGrowth(
            @ToolParam(required = false, description = "skills|week|achievements|titles (alapértelmezés: skills).")
            String scope,
            ToolContext toolContext) {
        UUID userId = ToolContexts.userId(toolContext);
        String s = normalizeScope(scope);
        return switch (s) {
            case "week" -> renderWeek(userId, toolContext);
            case "achievements" -> renderAchievements(userId, toolContext);
            case "titles" -> renderTitles(userId, toolContext);
            default -> renderSkills(userId, toolContext);
        };
    }

    private static String normalizeScope(String scope) {
        if (scope == null) {
            return "skills";
        }
        String s = scope.trim().toLowerCase();
        return GROWTH_SCOPES.contains(s) ? s : "skills";
    }

    /**
     * scope=skills (default): account level/XP (+ live streak) from the GAMIFICATION_SWITCH-gated
     * {@link GamificationService}, when available, plus every skill with real progress (athletic/
     * muscle/life) from the ungated {@link ProgressionService#getProfile}. "nincs adat" only when
     * {@code athleteLevel} is null — {@code ProgressionService}'s own ghost signal that the user has
     * NO skill_progress rows at all yet (a brand-new account), never for genuine honest zeros.
     */
    private String renderSkills(UUID userId, ToolContext toolContext) {
        ProgressionProfileResponse profile = progressionService.getProfile(userId);
        if (profile.getAthleteLevel() == null) {
            return "Fejlődés: " + ToolText.NO_DATA;
        }
        StringBuilder b = new StringBuilder("Fejlődés");
        GamificationService gamification = gamificationService.getIfAvailable();
        if (gamification != null) {
            GamificationProfileResponse acc = gamification.getProfile(userId);
            b.append(": ").append(acc.getLevel()).append(". szint, ").append(acc.getTotalXp()).append(" XP");
            if (Boolean.TRUE.equals(acc.getStreakAlive())) {
                b.append(", streak ").append(acc.getStreakDays()).append(" nap");
            }
        }
        appendSkillLines(b, "Athletic", profile.getAthletic());
        appendSkillLines(b, "Izom", profile.getMuscle());
        appendSkillLines(b, "Life", profile.getLife());
        ToolContexts.audit(toolContext).addRef("Growth", "skills");
        return b.toString();
    }

    /** Only skills with real progress (cumulativeXp > 0) render — the fixed-taxonomy ghost
     *  defaults (level 1, 0 XP) would otherwise flood the prompt with untouched skills. */
    private static void appendSkillLines(StringBuilder b, String label, List<SkillLevel> skills) {
        String lines = skills.stream()
                .filter(sk -> sk.getCumulativeXp() != null && sk.getCumulativeXp() > 0)
                .map(sk -> sk.getSkillKey() + ": Lv " + sk.getLevel() + " (" + sk.getCumulativeXp() + " XP)")
                .collect(Collectors.joining(", "));
        if (!lines.isEmpty()) {
            b.append('\n').append(label).append(": ").append(lines);
        }
    }

    /**
     * scope=week: the current ISO week's growth rollup. Never "nincs adat" — per
     * {@link GrowthWeekService}'s own doc, a week with no growth activity is an honest zero, not
     * an absence.
     */
    private String renderWeek(UUID userId, ToolContext toolContext) {
        GrowthWeekResponse week = growthWeekService.growthWeek(userId, LocalDate.now());
        StringBuilder b = new StringBuilder("Heti növekedés (").append(week.getWeekStart()).append("):");
        b.append("\nKüldetések: ").append(week.getQuestCompleted()).append('/')
                .append(week.getQuestClosed()).append(" lezárva");
        b.append("\nLIFE XP: ").append(week.getLifeXp());
        b.append("\nTevékenységek: ").append(week.getActivities());
        b.append("\nMegtakarítás: ").append(week.getSavingsHuf()).append(" Ft");
        ToolContexts.audit(toolContext).addRef("Growth", "week-" + week.getWeekStart());
        return b.toString();
    }

    /**
     * scope=achievements: all 9 derive-on-read badges (current/target, achieved flag) + any
     * persisted perk unlocks. Never "nincs adat" — per {@link AchievementService}'s own doc, a
     * badge honestly reporting current=0 is a real, meaningful answer, not an absence.
     */
    private String renderAchievements(UUID userId, ToolContext toolContext) {
        AchievementsResponse ach = achievementService.achievements(userId);
        StringBuilder b = new StringBuilder("Eredmények:");
        for (BadgeResponse badge : ach.getBadges()) {
            b.append('\n').append(badge.getName()).append(": ")
                    .append(badge.getCurrent()).append('/').append(badge.getTarget());
            if (Boolean.TRUE.equals(badge.getAchieved())) {
                b.append(" (elérve)");
            }
        }
        if (!ach.getPerks().isEmpty()) {
            b.append("\nFeloldott perkek: ").append(ach.getPerks().stream()
                    .map(PerkUnlockResponse::getName).collect(Collectors.joining(", ")));
        }
        ToolContexts.audit(toolContext).addRef("Growth", "achievements");
        return b.toString();
    }

    /**
     * scope=titles: the equipped title + owned titles, from the GAMIFICATION_SWITCH-gated
     * {@link GamificationService}. "nincs adat" only when the gamification feature itself is off
     * (no bean) — otherwise never, since every profile is born equipped with the default title
     * ({@code TitleCatalog.DEFAULT_TITLE_KEY}). Keys are resolved to their Hungarian display names
     * via {@link TitleCatalog} — mirrors {@link #renderAchievements} resolving badge/perk names,
     * never the raw catalog key.
     */
    private String renderTitles(UUID userId, ToolContext toolContext) {
        GamificationService gamification = gamificationService.getIfAvailable();
        if (gamification == null) {
            return "Címek: " + ToolText.NO_DATA;
        }
        GamificationProfileResponse acc = gamification.getProfile(userId);
        StringBuilder b = new StringBuilder("Címek: felszerelt — ").append(titleName(acc.getEquippedTitleKey()));
        if (!acc.getOwnedTitleKeys().isEmpty()) {
            b.append("; birtokolt: ").append(acc.getOwnedTitleKeys().stream()
                    .map(this::titleName).collect(Collectors.joining(", ")));
        }
        ToolContexts.audit(toolContext).addRef("Growth", "titles");
        return b.toString();
    }

    /** Resolves a title key to its catalog display name, falling back to the raw key only if the
     *  key is missing from the catalog — honest degrade, never crash/null. */
    private String titleName(String key) {
        return titleCatalog.find(key).map(TitleCatalog.TitleDef::name).orElse(key);
    }
}
