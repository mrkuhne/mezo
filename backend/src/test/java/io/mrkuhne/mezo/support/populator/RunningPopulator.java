package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.train.entity.RunSessionLogEntity;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockEntity;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockStructure;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockStructure.RpeTarget;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockStructure.RunPrescribedSession;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockStructure.RunSegment;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockStructure.RunWeek;
import io.mrkuhne.mezo.feature.train.repository.RunSessionLogRepository;
import io.mrkuhne.mezo.feature.train.repository.RunningBlockRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/**
 * Test data factory for the Running aggregate (block + logged run session) — see
 * docs/references/integration_test_framework.md (one populator per aggregate). Persists via
 * repository {@code saveAndFlush} so DB constraints fire.
 */
@TestComponent
@RequiredArgsConstructor
public class RunningPopulator {

    private final RunningBlockRepository blockRepository;
    private final RunSessionLogRepository logRepository;

    public RunningBlockEntity createBlock(UUID createdBy, String title, String status) {
        RunningBlockEntity e = new RunningBlockEntity();
        e.setCreatedBy(createdBy);
        e.setTitle(title);
        e.setKind("interval");
        e.setStatus(status);
        e.setStartDate(LocalDate.parse("2026-06-16"));
        e.setEndDate(LocalDate.parse("2026-08-11"));
        e.setWeeks(8);
        e.setCurrentWeek(3);
        e.setStructure(sampleStructure());
        return blockRepository.saveAndFlush(e);
    }

    /**
     * Block whose structure carries exactly {@code weeks} weeks, each with {@code sessionsPerWeek}
     * sprint sessions — lets the projection's running energy-delta (sessions/week) be asserted
     * deterministically. {@code weeks} also sets the entity's {@code weeks} field.
     */
    public RunningBlockEntity createBlockWithSessions(
        UUID createdBy, String title, String status, int weeks, int sessionsPerWeek) {
        RunningBlockEntity e = new RunningBlockEntity();
        e.setCreatedBy(createdBy);
        e.setTitle(title);
        e.setKind("interval");
        e.setStatus(status);
        e.setStartDate(LocalDate.parse("2026-06-01"));
        e.setEndDate(LocalDate.parse("2026-06-01").plusWeeks(weeks).minusDays(1));
        e.setWeeks(weeks);
        e.setCurrentWeek(1);
        e.setStructure(structureWithSessions(weeks, sessionsPerWeek));
        return blockRepository.saveAndFlush(e);
    }

    private static RunningBlockStructure structureWithSessions(int weeks, int sessionsPerWeek) {
        java.util.List<RunWeek> weekList = new java.util.ArrayList<>();
        for (int w = 1; w <= weeks; w++) {
            java.util.List<RunPrescribedSession> sessions = new java.util.ArrayList<>();
            for (int s = 0; s < sessionsPerWeek; s++) {
                sessions.add(new RunPrescribedSession(
                    "w" + w + "-s" + s, s % 7, "18:00", "Sprint-intervallum", "sprint",
                    new RpeTarget(9, 10), 6,
                    List.of(new RunSegment("warmup", 300, null),
                            new RunSegment("work", 15, null),
                            new RunSegment("rest", 45, null),
                            new RunSegment("cooldown", 300, null))));
            }
            weekList.add(new RunWeek(w, "Alapozás", sessions));
        }
        return new RunningBlockStructure(weekList);
    }

    public RunSessionLogEntity createLog(UUID createdBy, UUID blockId, int week, String key) {
        RunSessionLogEntity e = new RunSessionLogEntity();
        e.setCreatedBy(createdBy);
        e.setBlockId(blockId);
        e.setWeekNumber(week);
        e.setSessionKey(key);
        e.setDate(LocalDate.parse("2026-06-30"));
        e.setCompletedRounds(6);
        e.setRpeActual(9);
        return logRepository.saveAndFlush(e);
    }

    public static RunningBlockStructure sampleStructure() {
        RunPrescribedSession sprint = new RunPrescribedSession(
            "tue-sprint", 1, "18:00", "Sprint-intervallum", "sprint", new RpeTarget(9, 10), 6,
            List.of(new RunSegment("warmup", 300, null),
                    new RunSegment("work", 15, null),
                    new RunSegment("rest", 45, null),
                    new RunSegment("cooldown", 300, null)));
        RunWeek w3 = new RunWeek(3, "Alapozás", List.of(sprint));
        return new RunningBlockStructure(List.of(w3));
    }
}
