package io.mrkuhne.mezo.feature.lifegoal.catalog;

import io.mrkuhne.mezo.feature.lifegoal.entity.PillarSourceJson;
import java.util.List;

/** One row of the closed catalog: the source spec, Hungarian label/group, allowed kinds, unit, default skill. */
public record SignalCatalogEntry(String id, PillarSourceJson source, String label, String group,
    List<String> kinds, String unit, String defaultSkillKey) {}
