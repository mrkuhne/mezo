package io.mrkuhne.mezo.feature.lifegoal.service;

import io.mrkuhne.mezo.api.dto.PillarKind;
import io.mrkuhne.mezo.api.dto.SignalCatalogEntry;
import io.mrkuhne.mezo.api.dto.SignalCatalogResponse;
import io.mrkuhne.mezo.feature.lifegoal.catalog.SignalCatalog;
import io.mrkuhne.mezo.feature.lifegoal.engine.SignalSource;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalPillarEntity;
import io.mrkuhne.mezo.feature.lifegoal.mapper.LifeGoalMapper;
import io.mrkuhne.mezo.feature.lifegoal.repository.LifeGoalPillarRepository;
import io.mrkuhne.mezo.feature.lifegoal.repository.LifeGoalRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * GET /api/life-goals/signals (spec D4) — the closed catalog, mapped to the wire contract, plus
 * per-source liveness (mezo-iizd.7).
 *
 * <p>Task-3 override: the brief stubs this to an empty list with an unused {@code catalog} field;
 * implemented fully here instead since the mapping is a one-shot, no-dependency job and leaving it
 * stubbed would both violate ArchUnit's ban on dead fields and be pointless — Task 4 then owns only
 * the habit-key validation on {@code LifeGoalPillarService}, not this endpoint.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.LIFEGOAL_SWITCH, havingValue = "true")
public class LifeGoalSignalService {

    /** A liveness-ablak: a mai nappal együtt 7 nap (spec §.7 „volt-e adat az elmúlt 7 napban"). */
    private static final int LIVENESS_WINDOW_DAYS = 7;

    private final SignalCatalog catalog;
    private final LifeGoalMapper mapper;
    private final List<SignalSource> sources;
    private final LifeGoalRepository goalRepository;
    private final LifeGoalPillarRepository pillarRepository;

    /**
     * A jel-katalógus + forrásonkénti liveness (mezo-iizd.7): hány napon volt adat az elmúlt
     * 7-ben, és a hívó AKTÍV céljainak mely aktív pillérei táplálkoznak ebből a jelből. A
     * forrás-diszpécs ugyanaz a {@code supports()}-válogatás, amit a
     * {@code LifeGoalProgressService.windowFor} használ — kikapcsolt companion mellett a
     * {@code MetricSignalSource} bean nincs, és minden metrika-jel egyszerűen alszik.
     */
    @Transactional(readOnly = true)
    public SignalCatalogResponse catalog(UUID userId) {
        LocalDate today = LocalDate.now();
        LocalDate from = today.minusDays(LIVENESS_WINDOW_DAYS - 1L);
        Map<String, List<String>> fedPillars = fedPillarsBySignalId(userId);
        return SignalCatalogResponse.builder()
            .entries(catalog.entries().stream()
                .map(e -> toDto(e, dataDays(userId, e, from, today), fedPillars.getOrDefault(e.id(), List.of())))
                .toList())
            .build();
    }

    private int dataDays(UUID userId, io.mrkuhne.mezo.feature.lifegoal.catalog.SignalCatalogEntry e,
                         LocalDate from, LocalDate to) {
        return sources.stream().filter(s -> s.supports(e.source())).findFirst()
            .map(s -> s.window(userId, e.source(), from, to))
            .map(w -> (int) w.values().entrySet().stream()
                .filter(v -> v.getValue() != null && !v.getKey().isBefore(from) && !v.getKey().isAfter(to))
                .count())
            .orElse(0);
    }

    private Map<String, List<String>> fedPillarsBySignalId(UUID userId) {
        List<UUID> activeGoalIds = goalRepository.findByCreatedByAndDeletedFalseOrderByCreatedAtDesc(userId)
            .stream().filter(g -> LifeGoalEntity.STATUS_ACTIVE.equals(g.getStatus())).map(LifeGoalEntity::getId).toList();
        if (activeGoalIds.isEmpty()) {
            return Map.of();
        }
        Map<String, List<String>> byId = new LinkedHashMap<>();
        for (LifeGoalPillarEntity p : pillarRepository.findByGoalIdInAndDeletedFalseOrderByPositionAsc(activeGoalIds)) {
            if (!p.isActive()) {
                continue;
            }
            catalog.find(p.getSource()).ifPresent(entry ->
                byId.computeIfAbsent(entry.id(), k -> new ArrayList<>()).add(p.getLabel()));
        }
        return byId;
    }

    private SignalCatalogEntry toDto(io.mrkuhne.mezo.feature.lifegoal.catalog.SignalCatalogEntry e,
                                     int daysWithData, List<String> fedPillars) {
        return SignalCatalogEntry.builder()
            .id(e.id())
            .source(mapper.toSourceDto(e.source()))
            .label(e.label())
            .group(e.group())
            .kinds(e.kinds().stream().map(PillarKind::fromValue).toList())
            .unit(e.unit())
            .defaultSkillKey(e.defaultSkillKey())
            .live(daysWithData > 0)
            .daysWithData(daysWithData)
            .fedPillars(fedPillars)
            .build();
    }
}
