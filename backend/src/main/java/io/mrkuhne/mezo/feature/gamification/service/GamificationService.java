package io.mrkuhne.mezo.feature.gamification.service;

import io.mrkuhne.mezo.api.dto.CoinEventResponse;
import io.mrkuhne.mezo.api.dto.GamificationDayResponse;
import io.mrkuhne.mezo.api.dto.GamificationProfileResponse;
import io.mrkuhne.mezo.api.dto.XpBySource;
import io.mrkuhne.mezo.feature.gamification.AccountLevelCurve;
import io.mrkuhne.mezo.feature.gamification.TitleCatalog;
import io.mrkuhne.mezo.feature.gamification.config.GamificationProperties;
import io.mrkuhne.mezo.feature.gamification.entity.CoinEventEntity;
import io.mrkuhne.mezo.feature.gamification.entity.GamificationProfileEntity;
import io.mrkuhne.mezo.feature.gamification.entity.OwnedTitleEntity;
import io.mrkuhne.mezo.feature.gamification.repository.CoinEventRepository;
import io.mrkuhne.mezo.feature.gamification.repository.GamificationProfileRepository;
import io.mrkuhne.mezo.feature.gamification.repository.OwnedTitleRepository;
import io.mrkuhne.mezo.feature.progression.entity.LevelUpEventEntity;
import io.mrkuhne.mezo.feature.progression.repository.LevelUpEventRepository;
import io.mrkuhne.mezo.feature.progression.repository.SkillProgressRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Account gamification ledger reads + title-shop/streak-saver purchases (bd mezo-huzd, spec
 * clauses 1/2/4/5/6). Coin awards fired FROM XP events are {@link GamificationAccountAdapter}'s
 * job (it runs inside the award transaction); this service is the direct user-facing surface —
 * ghost-honest reads plus the three purchase mutations. Gated {@code GAMIFICATION_SWITCH}.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.GAMIFICATION_SWITCH, havingValue = "true")
public class GamificationService {

    private static final List<String> SOURCE_ORDER =
        List.of("GYM", "RUN", "SPORT", "QUEST", "ACTIVITY", "HABIT");
    private static final String REASON_PURCHASE = "purchase";
    private static final String KIND_LADDER = "LADDER";

    private final GamificationProfileRepository profileRepository;
    private final CoinEventRepository coinEventRepository;
    private final OwnedTitleRepository ownedTitleRepository;
    private final SkillProgressRepository skillProgressRepository;
    private final LevelUpEventRepository levelUpEventRepository;
    private final TitleCatalog titleCatalog;
    private final GamificationProperties properties;

    @Transactional(readOnly = true)
    public GamificationProfileResponse getProfile(UUID createdBy) {
        return toProfileResponse(createdBy);
    }

    @Transactional(readOnly = true)
    public GamificationDayResponse getDay(UUID createdBy, LocalDate date) {
        List<LevelUpEventEntity> events = levelUpEventRepository.findByCreatedByAndOccurredOn(createdBy, date);
        Map<String, Long> xpBySourceMap = new LinkedHashMap<>();
        for (LevelUpEventEntity e : events) {
            xpBySourceMap.merge(e.getSourceType(), e.getTotalXp(), Long::sum);
        }
        List<XpBySource> xpBySource = new ArrayList<>();
        long xpTotal = 0;
        for (String source : SOURCE_ORDER) {
            Long xp = xpBySourceMap.get(source);
            if (xp != null) {
                xpBySource.add(XpBySource.builder().source(source).xp(xp).build());
                xpTotal += xp;
            }
        }

        List<CoinEventEntity> coinRows =
            coinEventRepository.findByCreatedByAndOccurredOnOrderByCreatedAtAsc(createdBy, date);
        List<CoinEventResponse> coinEvents = coinRows.stream()
            .map(c -> CoinEventResponse.builder().reason(c.getReason()).amount(c.getAmount()).build())
            .toList();
        int coinTotal = coinRows.stream().mapToInt(CoinEventEntity::getAmount).sum();

        GamificationProfileEntity profile = profileRepository.findByCreatedBy(createdBy).orElse(null);
        return GamificationDayResponse.builder()
            .date(date)
            .xpBySource(xpBySource)
            .xpTotal(xpTotal)
            .coinEvents(coinEvents)
            .coinTotal(coinTotal)
            .streakDays(profile == null ? 0 : profile.getStreakDays())
            .streakAlive(streakAlive(profile))
            .build();
    }

    @Transactional
    public GamificationProfileResponse buyTitle(UUID createdBy, String key) {
        TitleCatalog.TitleDef title = findTitleOrThrow(key);
        if (KIND_LADDER.equals(title.kind())) {
            throw conflict("GAMIFICATION_TITLE_NOT_SHOP");
        }
        if (ownedTitleRepository.existsByCreatedByAndTitleKey(createdBy, key)) {
            throw conflict("GAMIFICATION_TITLE_OWNED");
        }
        GamificationProfileEntity profile = ensureProfile(createdBy);
        if (profile.getCoins() < title.priceCoins()) {
            throw conflict("GAMIFICATION_COINS_INSUFFICIENT");
        }
        spend(profile, createdBy, -title.priceCoins(), "buy-" + key);

        OwnedTitleEntity owned = new OwnedTitleEntity();
        owned.setCreatedBy(createdBy);
        owned.setTitleKey(key);
        ownedTitleRepository.save(owned);

        profile.setEquippedTitleKey(key);
        profileRepository.save(profile);
        return toProfileResponse(createdBy);
    }

    @Transactional
    public GamificationProfileResponse equipTitle(UUID createdBy, String key) {
        TitleCatalog.TitleDef title = findTitleOrThrow(key);
        int accountLevel = AccountLevelCurve.levelFor(skillProgressRepository.sumCumulativeXp(createdBy)).level();
        boolean locked = KIND_LADDER.equals(title.kind())
            ? accountLevel < title.unlockLevel()
            : !ownedTitleRepository.existsByCreatedByAndTitleKey(createdBy, key);
        if (locked) {
            throw conflict("GAMIFICATION_TITLE_LOCKED");
        }
        GamificationProfileEntity profile = ensureProfile(createdBy);
        profile.setEquippedTitleKey(key);
        profileRepository.save(profile);
        return toProfileResponse(createdBy);
    }

    @Transactional
    public GamificationProfileResponse buySaver(UUID createdBy) {
        GamificationProfileEntity profile = ensureProfile(createdBy);
        if (profile.getCoins() < properties.saverPrice()) {
            throw conflict("GAMIFICATION_COINS_INSUFFICIENT");
        }
        if (profile.getStreakSavers() >= properties.maxSavers()) {
            throw conflict("GAMIFICATION_SAVER_LIMIT");
        }
        spend(profile, createdBy, -properties.saverPrice(), "saver-buy-" + System.currentTimeMillis());
        profile.setStreakSavers(profile.getStreakSavers() + 1);
        profileRepository.save(profile);
        return toProfileResponse(createdBy);
    }

    // ==== internals ====

    private GamificationProfileResponse toProfileResponse(UUID createdBy) {
        long totalXp = skillProgressRepository.sumCumulativeXp(createdBy);
        AccountLevelCurve.LevelInfo info = AccountLevelCurve.levelFor(totalXp);
        GamificationProfileEntity profile = profileRepository.findByCreatedBy(createdBy).orElse(null);
        List<String> ownedKeys = ownedTitleRepository.findByCreatedBy(createdBy).stream()
            .map(OwnedTitleEntity::getTitleKey).toList();
        return GamificationProfileResponse.builder()
            .totalXp(totalXp)
            .level(info.level())
            .xpInLevel(info.xpInLevel())
            .xpForNext(info.xpForNext())
            .coins(profile == null ? 0 : profile.getCoins())
            .streakDays(profile == null ? 0 : profile.getStreakDays())
            .streakAlive(streakAlive(profile))
            .streakSavers(profile == null ? 0 : profile.getStreakSavers())
            .equippedTitleKey(profile == null ? TitleCatalog.DEFAULT_TITLE_KEY : profile.getEquippedTitleKey())
            .ownedTitleKeys(ownedKeys)
            .build();
    }

    /** Honest projection (spec clause 1): a fresh day still shows yesterday's living streak. */
    private boolean streakAlive(GamificationProfileEntity profile) {
        return profile != null && profile.getLastStreakDate() != null
            && !profile.getLastStreakDate().isBefore(LocalDate.now().minusDays(1));
    }

    private GamificationProfileEntity ensureProfile(UUID createdBy) {
        return profileRepository.findByCreatedBy(createdBy).orElseGet(() -> {
            GamificationProfileEntity e = new GamificationProfileEntity();
            e.setCreatedBy(createdBy);
            return profileRepository.saveAndFlush(e);
        });
    }

    /** Writes a purchase coin_event guarded by the idempotency key, and debits coins on insert only. */
    private void spend(GamificationProfileEntity profile, UUID createdBy, int amount, String sourceRefId) {
        if (coinEventRepository.existsByCreatedByAndReasonAndSourceRefId(createdBy, REASON_PURCHASE, sourceRefId)) {
            return;
        }
        CoinEventEntity e = new CoinEventEntity();
        e.setCreatedBy(createdBy);
        e.setReason(REASON_PURCHASE);
        e.setAmount(amount);
        e.setSourceRefId(sourceRefId);
        e.setOccurredOn(LocalDate.now());
        coinEventRepository.save(e);
        profile.setCoins(profile.getCoins() + amount);
    }

    private TitleCatalog.TitleDef findTitleOrThrow(String key) {
        return titleCatalog.find(key).orElseThrow(() -> new SystemRuntimeErrorException(
            SystemMessage.error("GAMIFICATION_TITLE_UNKNOWN").build(), HttpStatus.NOT_FOUND));
    }

    private SystemRuntimeErrorException conflict(String code) {
        return new SystemRuntimeErrorException(SystemMessage.error(code).build(), HttpStatus.CONFLICT);
    }
}
