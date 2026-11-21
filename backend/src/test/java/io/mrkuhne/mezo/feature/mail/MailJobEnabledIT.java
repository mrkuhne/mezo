package io.mrkuhne.mezo.feature.mail;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.mail.service.MailJob;
import java.lang.reflect.Method;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.test.context.TestPropertySource;

/** Both switches on: the job exists and is scheduled 08:00 and 15:00 Budapest. */
@TestPropertySource(properties = {"mezo.mail.enabled=true", "mezo.techcore.cron.mail-job.enabled=true"})
class MailJobEnabledIT extends AbstractIntegrationTest {

    @Autowired private ApplicationContext context;

    @Test
    void bothSwitchesOnMeansTheJobIsScheduledTwiceDaily() throws Exception {
        assertThat(context.getBeanNamesForType(MailJob.class)).hasSize(1);
        Method run = MailJob.class.getMethod("run");
        Scheduled s = run.getAnnotation(Scheduled.class);
        assertThat(s.cron()).isEqualTo("${mezo.mail.cron:0 0 8,15 * * *}");
        assertThat(s.zone()).isEqualTo("${mezo.mail.zone:Europe/Budapest}");
    }
}
