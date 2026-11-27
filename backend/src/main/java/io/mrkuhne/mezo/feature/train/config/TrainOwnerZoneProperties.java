package io.mrkuhne.mezo.feature.train.config;

import jakarta.validation.constraints.NotBlank;
import java.time.ZoneId;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * The owner's calendar zone that decides "today" and the week cut for the Sport read models (Boop Sport S2,
 * mezo-r36n9.202) — the same {@code mezo.wearable.zone} value {@code WearableProperties} binds, read through train's
 * own binding because train must not import wearable (cycle-free slices).
 */
@Validated
@ConfigurationProperties(prefix = "mezo.wearable")
public record TrainOwnerZoneProperties(@NotBlank String zone) {

    public ZoneId zoneId() {
        return ZoneId.of(zone);
    }
}
