package io.mrkuhne.mezo.feature.goal.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.goal.entity.IntakeDayMarkEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

/**
 * intake_day_mark DDL proof (bd mezo-3n2so, spec 2026-09-27-learned-expenditure-part2-design §6.1):
 * one row per user per calendar day, enforced by {@code uq_intake_day_mark_user_day}, and the
 * date-window lookup the weekly summary and the day-mark UI depend on.
 */
@Transactional
class IntakeDayMarkRepositoryIT extends AbstractIntegrationTest {

    @Autowired private IntakeDayMarkRepository intakeDayMarkRepository;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void testFindByCreatedByAndDayBetween_shouldReturnOnlyThatUsersMarksInWindow() {
        UUID userA = databasePopulator.populateUser("intake-day-mark-a-" + UUID.randomUUID() + "@test.local");
        UUID userB = databasePopulator.populateUser("intake-day-mark-b-" + UUID.randomUUID() + "@test.local");

        intakeDayMarkRepository.saveAndFlush(newMark(userA, LocalDate.of(2026, 9, 21), "COMPLETE"));
        intakeDayMarkRepository.saveAndFlush(newMark(userA, LocalDate.of(2026, 9, 23), "INCOMPLETE"));
        intakeDayMarkRepository.saveAndFlush(newMark(userB, LocalDate.of(2026, 9, 21), "COMPLETE"));

        var marks = intakeDayMarkRepository.findByCreatedByAndDayBetweenAndDeletedFalse(
            userA, LocalDate.of(2026, 9, 20), LocalDate.of(2026, 9, 27));

        assertThat(marks).hasSize(2)
            .extracting(IntakeDayMarkEntity::getDay, IntakeDayMarkEntity::getStatus)
            .containsExactlyInAnyOrder(
                org.assertj.core.groups.Tuple.tuple(LocalDate.of(2026, 9, 21), "COMPLETE"),
                org.assertj.core.groups.Tuple.tuple(LocalDate.of(2026, 9, 23), "INCOMPLETE"));
        assertThat(marks).allSatisfy(m -> assertThat(m.getCreatedBy()).isEqualTo(userA));

        assertThat(intakeDayMarkRepository.findByCreatedByAndDayAndDeletedFalse(userA, LocalDate.of(2026, 9, 21)))
            .isPresent();
    }

    @Test
    void testUniqueUserDay_shouldRejectASecondNonDeletedRow_forTheSameUserAndDay() {
        UUID userA = databasePopulator.populateUser("intake-day-mark-dup-" + UUID.randomUUID() + "@test.local");
        intakeDayMarkRepository.saveAndFlush(newMark(userA, LocalDate.of(2026, 9, 21), "COMPLETE"));

        IntakeDayMarkEntity duplicate = newMark(userA, LocalDate.of(2026, 9, 21), "INCOMPLETE");
        assertThatThrownBy(() -> intakeDayMarkRepository.saveAndFlush(duplicate))
            .isInstanceOf(DataIntegrityViolationException.class);
    }

    private IntakeDayMarkEntity newMark(UUID user, LocalDate day, String status) {
        IntakeDayMarkEntity e = new IntakeDayMarkEntity();
        e.setCreatedBy(user);
        e.setDay(day);
        e.setStatus(status);
        return e;
    }
}
