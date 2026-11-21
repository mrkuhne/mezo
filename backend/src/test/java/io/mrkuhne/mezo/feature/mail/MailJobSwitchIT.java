package io.mrkuhne.mezo.feature.mail;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.mail.service.MailJob;
import io.mrkuhne.mezo.feature.mail.service.MailRunner;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.TestPropertySource;

/** The feature on but the cron switch off: no MailJob bean (the runner, used by the manual run, stays). */
@TestPropertySource(properties = {"mezo.mail.enabled=true", "mezo.techcore.cron.mail-job.enabled=false"})
class MailJobSwitchIT extends AbstractIntegrationTest {

    @Autowired private ApplicationContext context;

    @Test
    void cronSwitchOffMeansNoJobBean() {
        assertThat(context.getBeanNamesForType(MailJob.class)).isEmpty();
        assertThat(context.getBeanNamesForType(MailRunner.class)).hasSize(1);
    }
}
