package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.Collection;
import java.util.List;
import org.springframework.http.HttpStatus;

/** Validation and storage normalisation of a plan's sport-loaded muscle groups (mezo-r36n9.77). */
public final class SportGroups {

    private SportGroups() {}

    /**
     * @param groups  requested groups (nullable)
     * @param allowed the landmark table's keys, in table order (VolumeProperties.baselines().keySet())
     * @return de-duplicated, in table order; null when empty. 400 on an unknown or null entry.
     */
    public static List<String> normalize(List<String> groups, Collection<String> allowed) {
        if (groups == null || groups.isEmpty()) {
            return null;
        }
        for (String g : groups) {
            if (g == null || !allowed.contains(g)) {
                throw new SystemRuntimeErrorException(
                    SystemMessage.error("TRAIN_SPORT_GROUP_INVALID").build(), HttpStatus.BAD_REQUEST);
            }
        }
        List<String> ordered = allowed.stream().filter(groups::contains).toList();
        return ordered.isEmpty() ? null : ordered;
    }
}
