package io.mrkuhne.mezo.feature.character.edition;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import io.mrkuhne.mezo.feature.character.service.CharacterCouncilJob;
import io.mrkuhne.mezo.feature.character.service.edition.TeamEditionService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * Task 5 brief: with {@code mezo.feature.team-edition.enabled=false} the {@link TeamEditionService}
 * bean must not exist, and {@link CharacterCouncilJob} — which consumes it via
 * {@code ObjectProvider#ifAvailable} — must not error. A bare wrapper with only a {@code @Nested}
 * class, exactly like {@code CharacterObservationJobIT}: mixing a real always-on IT (a class that
 * itself extends {@link AbstractIntegrationTest} and has its own {@code @Test} methods) with a
 * differently-propertied {@code @Nested} sibling confuses Spring's test-context cache — the
 * always-on class's own DI failed with "No qualifying bean of type TeamEditionService" once a
 * {@code @Nested} class with the switch off ran in the same suite (verified by reading the
 * Surefire log before splitting this into its own file).
 */
class TeamEditionServiceSwitchOffIT {

    @Nested
    @ActiveProfiles("companion-fake")
    @TestPropertySource(properties = {
        "mezo.feature.team-edition.enabled=false",
        "mezo.techcore.cron.character-council-job.enabled=true",
        // Fix round (mezo-a9bo7.12): without this, the job's ready-at gate (default 21:00) can
        // skip its council/edition path entirely depending on wall-clock time, silently turning
        // this into a no-op test that would pass even if job::run threw. 00:00 always clears the
        // gate, so the job path this test exercises actually runs on every invocation.
        "mezo.character.council.ready-at=00:00"
    })
    class Disabled extends AbstractIntegrationTest {

        @Autowired private ApplicationContext context;
        @Autowired private CharacterCouncilJob job;

        @Test
        void noTeamEditionServiceBean_andJobDoesNotError() {
            assertThat(context.getBeanNamesForType(TeamEditionService.class)).isEmpty();
            assertThatCode(job::run).doesNotThrowAnyException();
        }
    }
}
