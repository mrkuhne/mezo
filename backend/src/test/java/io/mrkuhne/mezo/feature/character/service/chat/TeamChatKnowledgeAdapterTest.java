package io.mrkuhne.mezo.feature.character.service.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.mrkuhne.mezo.feature.character.service.edition.TeamCharacter;
import io.mrkuhne.mezo.feature.companion.service.KnowledgeFactService;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * mezo-d6ivw.11 (S7 final review item 6): the csapatfal knowledge block's MEZO, SZKEPTIKUS and
 * fail-open branches — the IT covers only the postable-area mix.
 */
class TeamChatKnowledgeAdapterTest {

    private static final UUID OWNER = UUID.randomUUID();
    private final KnowledgeFactService facts = mock(KnowledgeFactService.class);
    private final TeamChatKnowledgeAdapter adapter = new TeamChatKnowledgeAdapter(facts);

    @Test
    void mezo_getsMezoFactsOnly_upToTheFullCap() {
        when(facts.promptFactsForOwners(OWNER, List.of("mezo"), TeamChatKnowledgeAdapter.MAX))
                .thenReturn(List.of("m1", "m2", "m3"));
        assertThat(adapter.forArea(OWNER, TeamCharacter.MEZO)).containsExactly("m1", "m2", "m3");
        verify(facts, never()).promptFactsForOwners(eq(OWNER), eq(List.of("szkeptikus")), anyInt());
    }

    @Test
    void szkeptikus_ownsNoArea_getsMezoFactsOnly_upToTheFullCap() {
        when(facts.promptFactsForOwners(OWNER, List.of("mezo"), TeamChatKnowledgeAdapter.MAX))
                .thenReturn(List.of("m1", "m2", "m3", "m4"));
        assertThat(adapter.forArea(OWNER, TeamCharacter.SZKEPTIKUS)).containsExactly("m1", "m2", "m3", "m4");
        verify(facts, never()).promptFactsForOwners(eq(OWNER), eq(List.of(TeamCharacter.SZKEPTIKUS.key())), anyInt());
    }

    @Test
    void anError_isAnEmptyBlock_neverAThrow() {
        when(facts.promptFactsForOwners(any(), any(), anyInt())).thenThrow(new IllegalStateException("db down"));
        assertThat(adapter.forArea(OWNER, TeamCharacter.FALAT)).isEmpty();
        assertThat(adapter.forArea(OWNER, TeamCharacter.MEZO)).isEmpty();
    }
}
