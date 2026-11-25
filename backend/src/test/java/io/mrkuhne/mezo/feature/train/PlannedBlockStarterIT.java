package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MesoTemplateStartRequest;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.service.MesoTemplateService;
import io.mrkuhne.mezo.feature.train.service.PlannedBlockStarter;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.MesoTemplatePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Queue;
import java.util.UUID;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * A planned block starts on its day (mezo-r36n9.113 Task 6, fix round 1): concurrent reads activate it once, only the
 * newest due planned run that starts after the running one is ever activated, and older overdue ones are left alone.
 * Clock pinned to Saturday 2026-11-21. All values invented.
 */
@Import({YearPlanContractIT.PinnedClockConfig.class, PlannedBlockStarterIT.Events.class})
class PlannedBlockStarterIT extends AbstractIntegrationTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 11, 21);

    @TestConfiguration
    static class Events {
        final Queue<MesocycleActivated> seen = new ConcurrentLinkedQueue<>();

        @EventListener
        void on(MesocycleActivated e) {
            seen.add(e);
        }
    }

    @Autowired private PlannedBlockStarter starter;
    @Autowired private MesoTemplateService templateService;
    @Autowired private MesoTemplatePopulator templatePopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private MesocycleRepository mesocycleRepository;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private Events events;
    @Autowired private JdbcTemplate jdbc;

    @BeforeEach
    void clearEvents() {
        events.seen.clear();
    }

    private UUID stamp(UUID owner, LocalDate start, MesoTemplateStartRequest.StatusEnum status) {
        UUID template = templatePopulator.template(owner).getId();
        return templateService.start(owner, template,
            MesoTemplateStartRequest.builder().startDate(start).status(status).build()).getId();
    }

    private MesocycleEntity meso(UUID owner, LocalDate start, String status) {
        MesocycleEntity m = trainPopulator.createMesocycle(owner, "Blokk " + start, status);
        m.setStartDate(start);
        m.setEndDate(start.plusWeeks(6));
        return mesocycleRepository.saveAndFlush(m);
    }

    private String status(UUID id) {
        return mesocycleRepository.findById(id).orElseThrow().getStatus();
    }

    private long activations(UUID mesoId) {
        return events.seen.stream().filter(e -> e.mesocycleId().equals(mesoId)).count();
    }

    @Test
    void concurrentReadsActivateOnce() throws Exception {
        UUID owner = databasePopulator.populateUser("starter-race@test.local");
        UUID old = stamp(owner, LocalDate.of(2026, 11, 2), MesoTemplateStartRequest.StatusEnum.ACTIVE);
        UUID due = stamp(owner, TODAY, MesoTemplateStartRequest.StatusEnum.PLANNED);

        int threads = 4;
        CyclicBarrier barrier = new CyclicBarrier(threads);
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        try {
            List<Future<?>> runs = new ArrayList<>();
            for (int i = 0; i < threads; i++) {
                runs.add(pool.submit(() -> {
                    barrier.await(10, TimeUnit.SECONDS);
                    starter.startDue(owner);
                    return null;
                }));
            }
            for (Future<?> f : runs) f.get(30, TimeUnit.SECONDS); // any exception fails the test here
        } finally {
            pool.shutdownNow();
        }

        assertThat(status(due)).isEqualTo("active");
        assertThat(status(old)).isEqualTo("archived");
        assertThat(activations(due)).isEqualTo(1);
        Integer rows = jdbc.queryForObject("select count(*) from muscle_group_volume_log where mesocycle_id = ? "
            + "and is_deleted = false", Integer.class, due);
        Integer muscles = jdbc.queryForObject("select count(distinct muscle) from muscle_group_volume_log "
            + "where mesocycle_id = ? and is_deleted = false", Integer.class, due);
        assertThat(rows).isPositive().isEqualTo(muscles);
    }

    @Test
    void secondCallIsANoOp() {
        UUID owner = databasePopulator.populateUser("starter-twice@test.local");
        UUID due = stamp(owner, TODAY, MesoTemplateStartRequest.StatusEnum.PLANNED);

        starter.startDue(owner);
        starter.startDue(owner);

        assertThat(status(due)).isEqualTo("active");
        assertThat(activations(due)).isEqualTo(1);
    }

    @Test
    void plannedRunDatedBeforeTheActiveOneNeverActivates() {
        UUID owner = databasePopulator.populateUser("starter-stale@test.local");
        MesocycleEntity running = meso(owner, LocalDate.of(2026, 11, 16), "active");
        MesocycleEntity stale = meso(owner, LocalDate.of(2026, 11, 10), "planned");

        starter.startDue(owner);

        assertThat(status(stale.getId())).isEqualTo("planned");
        assertThat(status(running.getId())).isEqualTo("active");
        assertThat(events.seen).isEmpty();
    }

    @Test
    void onlyTheNewestOverdueRunActivatesAndRepeatedReadsNeverFlip() {
        UUID owner = databasePopulator.populateUser("starter-newest@test.local");
        MesocycleEntity older = meso(owner, LocalDate.of(2026, 11, 18), "planned");
        MesocycleEntity newest = meso(owner, LocalDate.of(2026, 11, 20), "planned");

        starter.startDue(owner);
        starter.startDue(owner);
        starter.startDue(owner);

        assertThat(status(newest.getId())).isEqualTo("active");
        assertThat(status(older.getId())).isEqualTo("planned");
        assertThat(activations(newest.getId())).isEqualTo(1);
        assertThat(events.seen).hasSize(1);
    }
}
