package io.mrkuhne.mezo.feature.biometrics.checkin.config;

import jakarta.validation.constraints.NotBlank;
import java.time.ZoneId;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * The owner's calendar zone that decides "today" for check-ins (Boop B3, mezo-r36n9.13) — the same
 * {@code mezo.wearable.zone} value {@code WearableProperties} binds. Read through its own binding because
 * biometrics must not import wearable (wearable → biometrics already exists; ArchitectureTest's cycle-free
 * slices).
 */
@Validated
@ConfigurationProperties(prefix = "mezo.wearable")
public record OwnerZoneProperties(@NotBlank String zone) {

    public ZoneId zoneId() {
        return ZoneId.of(zone);
    }
}
