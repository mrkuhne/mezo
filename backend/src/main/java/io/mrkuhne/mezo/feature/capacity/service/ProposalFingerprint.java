package io.mrkuhne.mezo.feature.capacity.service;

import io.mrkuhne.mezo.feature.capacity.port.CapacityCalendarPort.CalendarEventView;
import io.mrkuhne.mezo.feature.capacity.service.WeekPicture.PlannedSession;
import io.mrkuhne.mezo.feature.capacity.service.WeekPicture.SportSlot;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.util.Collection;
import java.util.HexFormat;
import java.util.List;
import java.util.Objects;

/**
 * What a stored proposal depends on (Boop B7 K3, mezo-r36n9.17): for each day it touches — the gym sessions as the
 * train windows resolve them (template, time, length, done, running), the sport slots, the calendar events (by their
 * device id and times, not the row id, which a sync may renew), whether the day started, the raw-plan facts the accept
 * rules read (planned, skipped, target or origin of a live move) and that night's bedtime. The verdict and ratio are
 * left out on purpose: they follow his body signals through the day and would make every proposal stale by noon.
 * Pure; SHA-256 hex.
 */
public final class ProposalFingerprint {

    private ProposalFingerprint() {
    }

    public static String of(WeekPicture w, Collection<LocalDate> touched) {
        StringBuilder sb = new StringBuilder();
        touched.stream().distinct().sorted().forEach(d -> day(sb, w, d));
        return sha256(sb.toString());
    }

    private static void day(StringBuilder sb, WeekPicture w, LocalDate d) {
        sb.append("day ").append(d).append('\n');
        for (PlannedSession s : w.sessionsOn(d)) {
            sb.append("gym ").append(s.templateId()).append('|').append(s.start()).append('|').append(s.minutes())
                .append('|').append(s.done()).append('|').append(s.running()).append('\n');
        }
        w.sport().stream().filter(s -> s.date().equals(d)).map(ProposalFingerprint::sport).sorted()
            .forEach(l -> sb.append(l).append('\n'));
        List<String> events = w.events().stream().filter(e -> d.equals(e.date())).map(ProposalFingerprint::event)
            .sorted().toList();
        events.forEach(l -> sb.append(l).append('\n'));
        sb.append("started ").append(w.startedDays().contains(d))
            .append(" planned ").append(w.plan().rawGymDays().contains(d))
            .append(" skipped ").append(w.plan().skippedDays().contains(d))
            .append(" claimed ").append(w.plan().claimedTargets().contains(d))
            .append(" movedFrom ").append(w.plan().movedFrom().contains(d))
            .append(" bed ").append(w.sleep().bedtimes().get(d)).append('\n');
    }

    private static String sport(SportSlot s) {
        return "sport " + s.start() + "|" + s.minutes() + "|" + s.label();
    }

    private static String event(CalendarEventView e) {
        return "event " + Objects.toString(e.externalId(), String.valueOf(e.id())) + "|" + e.start() + "|" + e.end()
            + "|" + e.allDay();
    }

    private static String sha256(String s) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest(s.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new AssertionError(e); // SHA-256 is mandatory on every JVM
        }
    }
}
