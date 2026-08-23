package io.mrkuhne.mezo.feature.companion.profile;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.profile.service.ProfileAssemblerJob;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.TestPropertySource;

/** W4.3 (mezo-b3pp.17): switch off ⇒ the job bean does not exist at all (the house cron idiom). */
@TestPropertySource(properties = "mezo.techcore.cron.profile-assembler-job.enabled=false")
class ProfileAssemblerJobSwitchOffIT extends AbstractIntegrationTest {

    @Autowired
    private ApplicationContext context;

    @Test
    void the_job_bean_is_absent() {
        assertThat(context.getBeanProvider(ProfileAssemblerJob.class).getIfAvailable()).isNull();
    }
}
