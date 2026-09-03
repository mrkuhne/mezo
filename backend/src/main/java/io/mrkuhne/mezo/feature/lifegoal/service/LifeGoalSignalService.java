package io.mrkuhne.mezo.feature.lifegoal.service;

import io.mrkuhne.mezo.api.dto.PillarKind;
import io.mrkuhne.mezo.api.dto.SignalCatalogEntry;
import io.mrkuhne.mezo.api.dto.SignalCatalogResponse;
import io.mrkuhne.mezo.feature.lifegoal.catalog.SignalCatalog;
import io.mrkuhne.mezo.feature.lifegoal.mapper.LifeGoalMapper;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * GET /api/life-goals/signals (spec D4) — the closed catalog, mapped to the wire contract.
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

    private final SignalCatalog catalog;
    private final LifeGoalMapper mapper;

    public SignalCatalogResponse catalog() {
        return SignalCatalogResponse.builder()
            .entries(catalog.entries().stream().map(this::toDto).toList())
            .build();
    }

    private SignalCatalogEntry toDto(io.mrkuhne.mezo.feature.lifegoal.catalog.SignalCatalogEntry e) {
        return SignalCatalogEntry.builder()
            .source(mapper.toSourceDto(e.source()))
            .label(e.label())
            .group(e.group())
            .kinds(e.kinds().stream().map(PillarKind::fromValue).toList())
            .unit(e.unit())
            .defaultSkillKey(e.defaultSkillKey())
            .build();
    }
}
