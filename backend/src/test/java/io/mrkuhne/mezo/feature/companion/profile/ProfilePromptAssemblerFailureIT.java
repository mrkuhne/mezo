package io.mrkuhne.mezo.feature.companion.profile;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;

import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.feature.companion.profile.service.ProfilePromptAssembler;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

/**
 * W4.3 (mezo-b3pp.17) IDENT-3, deferred minor closed (mezo-b3pp.35, item 2): {@code
 * ProfilePromptAssembler.render} never throws — the profile block is optional, the surrounding
 * turn is not. The catch is CORRECT today; this test exists so a future refactor that removes it
 * fails loudly, the same reasoning {@code ChatServiceGraphBlockFailureIT} pins for
 * {@code GraphPromptAssembler}.
 *
 * <p>Own IT class on purpose — the {@code @MockitoSpyBean} forks the application context, and the
 * other profile-prompt ITs must keep the clean one (same precedent as
 * {@code ChatServiceGraphBlockFailureIT}).
 */
@ActiveProfiles("companion-fake")
class ProfilePromptAssemblerFailureIT extends AbstractIntegrationTest {

    @MockitoSpyBean private GraphNodeRepository nodeRepository;

    @Autowired private ProfilePromptAssembler assembler;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testRender_shouldReturnEmptyBlock_whenTheProfileReadFails() {
        UUID owner = userPopulator.createUser("profile-prompt-fail@test.local").getId();
        doThrow(new DataAccessResourceFailureException("boom"))
                .when(nodeRepository)
                .findByCreatedByAndSourceKindAndSourceIdAndDeletedFalse(any(), any(), any());

        assertThatCode(() -> assertThat(assembler.render(owner)).isEmpty())
                .doesNotThrowAnyException();
    }
}
