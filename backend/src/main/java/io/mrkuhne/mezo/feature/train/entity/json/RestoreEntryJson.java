package io.mrkuhne.mezo.feature.train.entity.json;

import java.util.UUID;

/**
 * One exercise a deload week halved (volume engine v2, spec §6.4 rule 2): what to give back the
 * week after. Keyed by IDENTITY as well as row id — a day edit re-mints exercise row ids, so the
 * week after finds the current row by {@code exerciseId}, else on the same template day
 * ({@code dayIndex}) by catalog id, else by exact name. {@code sets} is the pre-deload amount,
 * {@code deloadSets} what the deload wrote (a row the owner changed since is left alone).
 */
public record RestoreEntryJson(
    UUID exerciseId,
    UUID catalogId,
    String exerciseName,
    int dayIndex,
    int sets,
    int deloadSets) {}
