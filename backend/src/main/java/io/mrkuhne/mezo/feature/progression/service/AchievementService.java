package io.mrkuhne.mezo.feature.progression.service;

import io.mrkuhne.mezo.api.dto.AchievementsResponse;
import io.mrkuhne.mezo.api.dto.BadgeResponse;
import io.mrkuhne.mezo.api.dto.PerkUnlockResponse;
import io.mrkuhne.mezo.feature.progression.ActivityLedgerSource;
import io.mrkuhne.mezo.feature.progression.PerkCatalog;
import io.mrkuhne.mezo.feature.progression.ProgressionTaxonomy;
import io.mrkuhne.mezo.feature.progression.QuestLedgerSource;
import io.mrkuhne.mezo.feature.progression.entity.SkillProgressEntity;
import io.mrkuhne.mezo.feature.progression.repository.PerkUnlockRepository;
import io.mrkuhne.mezo.feature.progression.repository.SkillProgressRepository;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

/**
 * Growth achievements (Me Growth page, bd mezo-rmhr): 9 badges DERIVED ON READ from the
 * existing ledgers — deterministic, retroactive, zero migration cost, no unlock dates (a
 * persistent achievement table with dates + celebration overlay is the recorded future
 * upgrade). Perks are the persisted milestone unlocks joined with the catalog copy. Port
 * switches off ⇒ those badges honestly report current=0.
 */
@Service
@RequiredArgsConstructor
public class AchievementService {

    /** All-time window for the ledger ports (they take date ranges). */
    static final LocalDate ALL_TIME_FROM = LocalDate.of(2000, 1, 1);

    private final SkillProgressRepository skillProgressRepository;
    private final PerkUnlockRepository perkUnlockRepository;
    private final PerkCatalog perkCatalog;
    private final TraitCalculator traitCalculator;
    private final ObjectProvider<QuestLedgerSource> questLedgerSource;
    private final ObjectProvider<ActivityLedgerSource> activityLedgerSource;

    public AchievementsResponse achievements(UUID createdBy) {
        LocalDate today = LocalDate.now();

        long questsCompleted = 0;
        QuestLedgerSource quests = questLedgerSource.getIfAvailable();
        if (quests != null) {
            questsCompleted = quests.closedQuestStats(createdBy, ALL_TIME_FROM, today).completed();
        }
        long activityEntries = 0;
        long savingsAllTime = 0;
        ActivityLedgerSource activities = activityLedgerSource.getIfAvailable();
        if (activities != null) {
            ActivityLedgerSource.Stats s = activities.stats(createdBy, ALL_TIME_FROM, today);
            activityEntries = s.entries();
            savingsAllTime = s.savingsHuf();
        }
        int consistencyWeeks = traitCalculator.traits(createdBy, today).getConsistencyWeeks();

        List<SkillProgressEntity> lifeRows = skillProgressRepository
            .findByCreatedByOrderBySkillKeyAsc(createdBy).stream()
            .filter(r -> ProgressionTaxonomy.LIFE.contains(r.getSkillKey()))
            .toList();
        long lifeActive = lifeRows.stream().filter(r -> r.getCumulativeXp() > 0).count();
        long lifeBestLevel = Math.max(1, lifeRows.stream()
            .mapToInt(SkillProgressEntity::getCurrentLevel).max().orElse(1));
        long lifeXpSum = lifeRows.stream().mapToLong(SkillProgressEntity::getCumulativeXp).sum();

        List<BadgeResponse> badges = new ArrayList<>();
        badges.add(badge("first_quest", "🏁", "Első küldetés", questsCompleted, 1));
        badges.add(badge("quests_10", "📜", "10 küldetés", questsCompleted, 10));
        badges.add(badge("quests_50", "🎖️", "50 küldetés", questsCompleted, 50));
        badges.add(badge("first_activity", "✍️", "Első tevékenység", activityEntries, 1));
        badges.add(badge("rhythm_4w", "🔥", "4 hetes ritmus", consistencyWeeks, 4));
        badges.add(badge("all_life_active", "🌈", "Mind a 8 LIFE aktív", lifeActive, 8));
        badges.add(badge("life_lv5", "🧠", "LIFE Lv 5", lifeBestLevel, 5));
        badges.add(badge("life_xp_10k", "🏛️", "10 000 LIFE XP", lifeXpSum, 10000));
        badges.add(badge("savings_100k", "💰", "100k megtakarítás", savingsAllTime, 100000));

        List<PerkUnlockResponse> perks = perkUnlockRepository
            .findByCreatedByOrderByUnlockedAtDesc(createdBy).stream()
            .map(u -> {
                var def = perkCatalog.find(u.getSkillKey(), u.getMilestoneLevel()).orElse(null);
                return PerkUnlockResponse.builder()
                    .perkKey(u.getPerkKey())
                    .name(def != null ? def.name() : u.getPerkKey())
                    .effectCopy(def != null ? def.effectCopy() : "")
                    .skillKey(u.getSkillKey())
                    .milestoneLevel(u.getMilestoneLevel())
                    .unlockedAt(u.getUnlockedAt().atOffset(ZoneOffset.UTC))
                    .build();
            })
            .toList();

        return AchievementsResponse.builder().badges(badges).perks(perks).build();
    }

    private static BadgeResponse badge(String key, String icon, String name, long current, long target) {
        return BadgeResponse.builder()
            .key(key).icon(icon).name(name)
            .achieved(current >= target)
            .current(current).target(target)
            .build();
    }
}
