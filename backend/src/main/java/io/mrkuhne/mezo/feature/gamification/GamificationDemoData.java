package io.mrkuhne.mezo.feature.gamification;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.gamification.config.GamificationProperties;
import io.mrkuhne.mezo.feature.gamification.entity.CoinEventEntity;
import io.mrkuhne.mezo.feature.gamification.entity.GamificationProfileEntity;
import io.mrkuhne.mezo.feature.gamification.repository.CoinEventRepository;
import io.mrkuhne.mezo.feature.gamification.repository.GamificationProfileRepository;
import io.mrkuhne.mezo.feature.progression.repository.SkillProgressRepository;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Seeds the owner's gamification ledger head (bd mezo-huzd) on startup — ports the FE mock seed's
 * story ({@code frontend/src/data/gamification/gamificationMock.ts}) so demo mode and mock mode
 * tell the same story: 240 coins, a living 6-day streak (1 banked saver, {@code lastStreakDate}
 * yesterday so the streak still reads alive on a fresh boot), equipped title "fegyelmezett".
 * Mirrors the retired medication seeder's owner resolution (mezo-lwmq: the medication seed was
 * removed — the owner tracks no medication) — defensive {@code findByEmail(...).orElse(null)}
 * no-op on a non-demodata boot — and its idempotency
 * (skip once the owner already has a profile row) and "static row + one dated transactional row"
 * shape.
 *
 * <p>{@code accountLevel} is deliberately NOT hardcoded to the mock's 12 — it is derived from the
 * owner's ACTUAL seeded skill XP at seed time ({@link SkillProgressRepository#sumCumulativeXp}),
 * which on a plain {@code demodata} boot (no skill-XP seeder exists yet) is 0 → level 1. Because
 * "fegyelmezett" is a LADDER title gated at level 12 ({@code content/gamification-titles.json}),
 * equipping it un-earned would be self-inconsistent, so below level 12 the highest LADDER title the
 * computed level actually unlocks is equipped instead (walking {@link TitleCatalog} — "ujonc" at
 * level 1, the catalog default). Also drops one dated {@code coin_event} ("quest" +10, today) so a
 * demo Harvest (day) read isn't empty.
 *
 * <p>Idempotent: no-op if the owner already has a profile row (restart-safe; a user who has since
 * accrued their own ledger is left untouched). Runs after {@link
 * io.mrkuhne.mezo.feature.auth.OwnerSeedData} (Order 0) and after {@link
 * io.mrkuhne.mezo.feature.people.PeopleSeedData} (130) — last among the {@code demofixtures}
 * seeders (S2, mezo-qw37.2: opt-in — a registered user gets their profile lazily from
 * {@link io.mrkuhne.mezo.feature.gamification.service.GamificationService#ensureProfile} on the
 * first purchase/award, and reads are null-safe ghost zeros before that), so it reads whatever
 * skill XP any future fixture seeder may contribute by then.
 */
@Component
@Profile("demofixtures")
@Order(135) // after PeopleSeedData (130) — needs the seeded owner; last, for the freshest skill-XP read
@RequiredArgsConstructor
public class GamificationDemoData implements CommandLineRunner {

    private static final String MOCK_TITLE_KEY = "fegyelmezett";
    private static final String KIND_LADDER = "LADDER";
    private static final String REASON_QUEST = "quest";
    private static final String DEMO_QUEST_REF = "demo-seed-quest-1";

    private final AppUserRepository appUserRepository;
    private final OwnerProperties ownerProperties;
    private final GamificationProfileRepository profileRepository;
    private final CoinEventRepository coinEventRepository;
    private final SkillProgressRepository skillProgressRepository;
    private final TitleCatalog titleCatalog;
    private final GamificationProperties gamificationProperties;

    @Override
    @Transactional
    public void run(String... args) {
        AppUserEntity owner = appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElse(null);
        if (owner == null) {
            return; // no owner yet (non-demodata path) — nothing to seed
        }
        UUID ownerId = owner.getId();
        if (profileRepository.findByCreatedBy(ownerId).isPresent()) {
            return; // already seeded (or the owner has since accrued their own ledger) — idempotent restart
        }

        int accountLevel = AccountLevelCurve.levelFor(skillProgressRepository.sumCumulativeXp(ownerId)).level();

        GamificationProfileEntity profile = new GamificationProfileEntity();
        profile.setCreatedBy(ownerId);
        profile.setCoins(240);
        // Deliberately "one log away from the 7-day streak milestone" — mirrors the FE mock seed
        // (gamificationMock.ts): the demo user's FIRST real award rolls the streak to 7 and fires
        // the +50 milestone. An intended demo beat, not an accident.
        profile.setStreakDays(6);
        profile.setStreakSavers(1);
        profile.setEquippedTitleKey(equippableTitleKey(accountLevel));
        profile.setLastStreakDate(LocalDate.now().minusDays(1));
        profile.setAccountLevel(accountLevel);
        profileRepository.save(profile);

        // The seeded balance (240) intentionally does NOT reconcile with the seeded ledger rows —
        // coins=240 is the FE-mock story value; the single demo coin_event only makes the Harvest
        // day-read non-empty. Any future lifetime-earned/audit feature must exclude demodata accounts.
        seedDemoQuestCoin(ownerId);
    }

    /**
     * The mock's "fegyelmezett" if the computed level actually unlocks it (level >= 12); otherwise
     * the highest LADDER title the computed level DOES unlock, so the seeded state is never
     * self-inconsistent ("ujonc" — level 1 — if nothing else qualifies).
     */
    private String equippableTitleKey(int accountLevel) {
        return titleCatalog.find(MOCK_TITLE_KEY)
            .filter(t -> accountLevel >= t.unlockLevel())
            .map(TitleCatalog.TitleDef::key)
            .orElseGet(() -> titleCatalog.all().stream()
                .filter(t -> KIND_LADDER.equals(t.kind()) && t.unlockLevel() <= accountLevel)
                .max(Comparator.comparingInt(TitleCatalog.TitleDef::unlockLevel))
                .map(TitleCatalog.TitleDef::key)
                .orElse(TitleCatalog.DEFAULT_TITLE_KEY));
    }

    /** One "quest" coin_event dated today, so a demo Harvest (day) read isn't empty. */
    private void seedDemoQuestCoin(UUID ownerId) {
        if (coinEventRepository.existsByCreatedByAndReasonAndSourceRefId(ownerId, REASON_QUEST, DEMO_QUEST_REF)) {
            return;
        }
        CoinEventEntity e = new CoinEventEntity();
        e.setCreatedBy(ownerId);
        e.setReason(REASON_QUEST);
        e.setAmount(gamificationProperties.questCoins());
        e.setSourceRefId(DEMO_QUEST_REF);
        e.setOccurredOn(LocalDate.now());
        coinEventRepository.save(e);
    }
}
