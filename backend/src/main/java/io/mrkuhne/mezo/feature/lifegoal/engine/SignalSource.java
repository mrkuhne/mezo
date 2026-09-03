package io.mrkuhne.mezo.feature.lifegoal.engine;

import io.mrkuhne.mezo.feature.lifegoal.entity.PillarSourceJson;
import java.time.LocalDate;
import java.util.UUID;

/** Egy forrás-típus napi értéksora. A Task 5 ProgressService a listán supports()-szal diszpécsel. */
public interface SignalSource {
    boolean supports(PillarSourceJson source);

    SignalWindow window(UUID userId, PillarSourceJson source, LocalDate from, LocalDate to);
}
