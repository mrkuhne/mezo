package io.mrkuhne.mezo.feature.lifegoal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.lifegoal.service.LifeGoalEvalJob;
import io.mrkuhne.mezo.feature.lifegoal.service.LifeGoalProgressService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.TestPropertySource;

/**
 * The cron switch is a bean boundary (mezo-iizd.6, HabitJob pattern): off ⇒ the job bean does not
 * exist at all, while the manual evaluate path (LifeGoalProgressService) stays fully wired.
 */
@TestPropertySource(properties = "mezo.techcore.cron.life-goal-eval-job.enabled=false")
class LifeGoalEvalJobSwitchOffIT extends AbstractIntegrationTest {

    @Autowired private ApplicationContext context;

    @Test
    void testJobBean_shouldNotExist_whenTheCronSwitchIsOff() {
        assertThat(context.getBeanNamesForType(LifeGoalEvalJob.class)).isEmpty();
        assertThat(context.getBeanNamesForType(LifeGoalProgressService.class)).isNotEmpty();
    }
}
