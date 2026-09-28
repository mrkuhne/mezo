package io.mrkuhne.mezo.feature.biometrics.checkin.service;

import io.mrkuhne.mezo.api.dto.AdaptiveReason;
import io.mrkuhne.mezo.api.dto.CheckInAdaptiveItem;
import io.mrkuhne.mezo.api.dto.CheckInItemId;
import io.mrkuhne.mezo.api.dto.CheckInItemKind;
import io.mrkuhne.mezo.api.dto.CheckInPlanItem;
import io.mrkuhne.mezo.api.dto.CheckInPlanOption;
import io.mrkuhne.mezo.api.dto.CheckInPlanResponse;
import io.mrkuhne.mezo.feature.biometrics.checkin.config.CheckInPlanProperties;
import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CravingKind;
import io.mrkuhne.mezo.feature.biometrics.checkin.entity.PainRegion;
import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInRepository;
import io.mrkuhne.mezo.feature.biometrics.checkin.service.AdaptiveItemChooser.Choice;
import io.mrkuhne.mezo.feature.biometrics.checkin.service.AdaptiveItemChooser.Reason;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Random;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Builds the Check-in 2.0 question plan for one slot (mezo-ck2, spec §2.2–2.3): the slot's
 * configured items plus the question of the day.
 *
 * <p>The adaptive pick is stable for (user, date, slot) — reopening the sheet never reshuffles:
 * a row already saved with an adaptive item returns that item; otherwise the RNG is seeded by
 * (user, date, slot) and the need window ends the day BEFORE {@code date}, so answers saved today
 * cannot change today's picks. A stored need pick re-reads its specific "why" from the current
 * need sources (the row keeps only item + reason).
 */
@Service
@RequiredArgsConstructor
public class CheckInPlanService {

    private final CheckInPlanProperties properties;
    private final AdaptiveItemChooser chooser;
    private final CheckInRepository repository;
    private final List<CheckInNeedSource> needSources;

    @Transactional(readOnly = true)
    public CheckInPlanResponse plan(UUID userId, LocalDate date, String slotTime) {
        CheckInPlanProperties.Slot slot = properties.slots().get(slotTime);
        if (slot == null) {
            throw new SystemRuntimeErrorException(
                SystemMessage.field("VALIDATION_INVALID_VALUE", "slotTime").build());
        }
        Map<CheckInItem, String> wanted = wanted(userId);
        Optional<Choice> choice = storedChoice(userId, date, slotTime, wanted)
            .or(() -> chooser.choose(slotTime, slot.items(), answerCounts(userId, date),
                wanted, new Random(seed(userId, date, slotTime))));
        return CheckInPlanResponse.builder()
            .items(slot.items().stream().map(CheckInPlanService::toPlanItem).toList())
            .adaptive(choice.map(this::toAdaptiveItem).orElse(null))
            .build();
    }

    /** The adaptive item a saved row already recorded, when it is a known item/reason pair. */
    private Optional<Choice> storedChoice(UUID userId, LocalDate date, String slotTime,
                                          Map<CheckInItem, String> wanted) {
        return repository.findByCreatedByAndDateAndSlotTime(userId, date, slotTime)
            .filter(row -> row.getAdaptiveItem() != null && row.getAdaptiveReason() != null)
            .flatMap(row -> CheckInItem.byId(row.getAdaptiveItem())
                .map(item -> {
                    Reason reason = Reason.valueOf(row.getAdaptiveReason());
                    return new Choice(item, reason, reason == Reason.NEED ? wanted.get(item) : null);
                }));
    }

    /** Non-null answers per item over the {@code need-window-days} days before {@code date}. */
    private Map<CheckInItem, Long> answerCounts(UUID userId, LocalDate date) {
        LocalDate to = date.minusDays(1);
        LocalDate from = date.minusDays(properties.adaptive().needWindowDays());
        List<CheckInEntity> rows = repository.findByCreatedByAndDeletedFalseAndDateBetween(userId, from, to);
        Map<CheckInItem, Long> counts = new EnumMap<>(CheckInItem.class);
        for (CheckInItem item : CheckInItem.values()) {
            counts.put(item, rows.stream().filter(r -> item.value(r) != null).count());
        }
        return counts;
    }

    /**
     * Wanted item → its specific "why" (null = generic): the specific sources merged in bean order
     * (the first sentence for an item wins); only when they are all empty, the fallback sources.
     */
    private Map<CheckInItem, String> wanted(UUID userId) {
        Map<CheckInItem, String> wanted = merge(userId, false);
        return wanted.isEmpty() ? merge(userId, true) : wanted;
    }

    private Map<CheckInItem, String> merge(UUID userId, boolean fallback) {
        Map<CheckInItem, String> wanted = new EnumMap<>(CheckInItem.class);
        needSources.stream()
            .filter(source -> source.fallback() == fallback)
            .flatMap(source -> source.needs(userId).stream())
            .forEach(need -> {
                if (!wanted.containsKey(need.item()) || wanted.get(need.item()) == null) {
                    wanted.put(need.item(), need.why());
                }
            });
        return wanted;
    }

    /** Deterministic across JVMs: UUID, epoch day and String hashes are all specified. */
    static long seed(UUID userId, LocalDate date, String slotTime) {
        long seed = userId.getMostSignificantBits();
        seed = 31 * seed + userId.getLeastSignificantBits();
        seed = 31 * seed + date.toEpochDay();
        return 31 * seed + slotTime.hashCode();
    }

    static CheckInPlanItem toPlanItem(CheckInItem item) {
        return CheckInPlanItem.builder()
            .id(CheckInItemId.fromValue(item.id()))
            .label(item.label())
            .question(item.question())
            .low(item.low())
            .high(item.high())
            .kind(CheckInItemKind.valueOf(item.kind().name()))
            .options(options(item))
            .build();
    }

    private CheckInAdaptiveItem toAdaptiveItem(Choice choice) {
        CheckInItem item = choice.item();
        return CheckInAdaptiveItem.builder()
            .id(CheckInItemId.fromValue(item.id()))
            .label(item.label())
            .question(item.question())
            .low(item.low())
            .high(item.high())
            .kind(CheckInItemKind.valueOf(item.kind().name()))
            .options(options(item))
            .why(chooser.why(choice))
            .reason(AdaptiveReason.valueOf(choice.reason().name()))
            .build();
    }

    /** PAIN → the regions, CRAVING → the kinds (Hungarian labels); null for a plain scale. */
    private static List<CheckInPlanOption> options(CheckInItem item) {
        return switch (item.kind()) {
            case PAIN -> Arrays.stream(PainRegion.values())
                .map(r -> new CheckInPlanOption(r.name(), r.label())).toList();
            case CRAVING -> Arrays.stream(CravingKind.values())
                .map(k -> new CheckInPlanOption(k.name(), k.label())).toList();
            case SCALE -> null;
        };
    }
}
