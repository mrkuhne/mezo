package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.CompanionPreferencesRequest;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.profile.service.ProfileAssembler;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.*;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

@ActiveProfiles("companion-fake")
class PersonalContextAssemblerIT extends AbstractIntegrationTest {
    @Autowired private PersonalContextAssembler assembler;
    @Autowired private CompanionPreferencesService preferences;
    @Autowired private CompanionPreferencesPopulator preferencesPopulator;
    @Autowired private UserPopulator users;
    @Autowired private AiConversationPopulator conversations;
    @Autowired private GraphPopulator graph;
    @Autowired private ChatService chat;
    @Autowired private ChatStreamService stream;
    @Autowired private io.mrkuhne.mezo.feature.auth.service.AuthService accounts;

    @Test
    void testPreview_shouldMatchChatAndKeepLiteralUserText_whenPreferencesChange() {
        var user = users.createUser().getId();
        preferencesPopulator.preferences(user, "Saját bemutatkozás {{NÉV}}", "Kérek rövid válaszokat.", true);
        graph.createSourcedNode(user, GraphNodeEntity.KIND_INSIGHT, ProfileAssembler.PROFILE_TITLE,
                "Tanult kommunikációs minta.", ProfileAssembler.SOURCE_PROFILE, user);
        var preview = assembler.assemble(user, LocalDate.now());
        assertThat(preview.getSections()).extracting(s -> s.getId()).containsExactly("core", "about", "instructions", "learned");
        assertThat(preview.getRenderedText()).contains("Saját bemutatkozás {{NÉV}}", "Tanult kommunikációs minta.");
        // gear-audited: intentionally checks both cheap CHAT and normal prepared turns using the same assembler.
        for (String content : new String[]{"Szia!", "Mi a mai terv?"}) {
            var turn = chat.prepareTurn(user, conversations.conversation(user).getId(), SendMessageRequest.builder().content(content).build());
            assertThat(turn.turnContext()).contains(preview.getRenderedText());
            assertThat(turn.turnContext().split("\\[Személyes alapadatok\\]", -1)).hasSize(2);
        }
        preferences.update(user, new CompanionPreferencesRequest("Új bemutatkozás", "Másik instrukció", false));
        var changed = assembler.assemble(user, LocalDate.now());
        assertThat(changed.getRenderedText()).contains("Új bemutatkozás", "Másik instrukció").doesNotContain("Tanult kommunikációs minta.");
        assertThat(changed.getSections().get(3).getIncluded()).isFalse();
        assertThat(changed.getSections().get(3).getText()).contains("Tanult kommunikációs minta.");
        // gear-audited: next-turn edits must apply even to the light CHAT branch.
        assertThat(chat.prepareTurn(user, conversations.conversation(user).getId(), SendMessageRequest.builder().content("Szia!").build()).turnContext())
                .contains(changed.getRenderedText()).doesNotContain("Saját bemutatkozás {{NÉV}}");
    }
    @Test
    void testAnswers_shouldReceiveExactPreview_whenSyncAndStreaming() {
        var user = users.createUser().getId();
        preferencesPopulator.preferences(user, "Fontos a rendszeres edzés.", "Rövid, konkrét mondatokat kérek.", false);
        String preview = assembler.render(user, LocalDate.now());
        // gear-audited: a general topic exercises the plain chat branch; subclass repeats conversation-first.
        var request = SendMessageRequest.builder().content("Beszélgessünk az irodalomról.").build();
        assertThat(chat.sendMessage(user, conversations.conversation(user).getId(), request).getContent()).contains(preview);
        var events = stream.streamMessage(user, conversations.conversation(user).getId(), request)
                .collectList().block(java.time.Duration.ofSeconds(30));
        assertThat(events).isNotNull();
        String answer = events.stream().filter(event -> "delta".equals(event.event()))
                .map(event -> ((io.mrkuhne.mezo.api.dto.StreamDelta) event.data()).getText())
                .collect(java.util.stream.Collectors.joining());
        assertThat(answer).contains(preview);
    }

    @Test
    void testPreview_shouldUseCanonicalName_whenAccountIsCorrected() {
        var user = users.createUser();
        var request = new io.mrkuhne.mezo.api.dto.UpdateAccountRequest("Javított név", user.getEmail());
        accounts.updateAccount(user, request);
        assertThat(assembler.render(user.getId(), LocalDate.now())).contains("Név: \"Javított név\"");
    }

}
