package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.biometrics.checkin.config.OwnerZoneProperties;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

/**
 * The owner's "today" for the chat (Boop B3, mezo-r36n9.13): the calendar day in {@code mezo.wearable.zone},
 * never the server's {@code LocalDate.now()}. "Now" is the application {@link Clock} when one is defined
 * (tests pin it), else the system clock — the {@code DayCloseService} idiom.
 */
@Component
@RequiredArgsConstructor
public class OwnerToday {

    private final OwnerZoneProperties ownerZone;
    private final ObjectProvider<Clock> clock;

    public ZoneId zone() {
        return ownerZone.zoneId();
    }

    public Instant now() {
        return clock.getIfAvailable(Clock::systemUTC).instant();
    }

    public LocalDate today() {
        return LocalDate.ofInstant(now(), zone());
    }

    /** The first instant of the owner's today — the lower bound of "today's turns". */
    public Instant startOfToday() {
        return today().atStartOfDay(zone()).toInstant();
    }
}
