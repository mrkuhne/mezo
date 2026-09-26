package io.mrkuhne.mezo.feature.nutrition.service;

import java.time.LocalTime;

/**
 * A tervező ajánlott étkezési ablaka (mezo-6g52f), ahogy a logoláskor az étkezéssel együtt
 * tárolódott. A pontozó ehhez méri az időzítést; {@code null} ablak = a statikus slot-ablak config.
 */
public record MealWindow(LocalTime from, LocalTime to) {
}
