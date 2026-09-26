package io.mrkuhne.mezo.feature.people.repository;

import java.time.Instant;
import java.util.UUID;

/** S4 (mezo-d6ivw.4): the effect engine's day-flag input — id + day + context, nothing else. */
public record MentionContextSignal(UUID personId, Instant ts, String contextLabel) {}
