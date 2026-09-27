package io.mrkuhne.mezo.feature.character.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.mrkuhne.mezo.feature.auth.service.PromptPersona;
import io.mrkuhne.mezo.feature.character.entity.TeamChatThreadEntity;
import io.mrkuhne.mezo.feature.character.service.chat.TeamChatBudget;
import io.mrkuhne.mezo.feature.character.service.chat.TeamChatContext;
import io.mrkuhne.mezo.feature.character.service.chat.TeamChatContextBlock;
import io.mrkuhne.mezo.feature.character.service.chat.TeamChatReplyDraft;
import io.mrkuhne.mezo.feature.character.service.chat.TeamChatReplyVoiceWriter;
import io.mrkuhne.mezo.feature.character.service.chat.TeamChatVoiceWriter;
import io.mrkuhne.mezo.feature.character.service.edition.TeamCharacter;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import tools.jackson.databind.json.JsonMapper;

/**
 * Emlékezet S7 Task 5 (mezo-d6ivw.7): the guarded LLM call that answers the user's own reply on a
 * team chat ügy — one voiced acknowledgement, or the honest template on any guard/parse failure.
 */
class TeamChatReplyVoiceWriterTest {

    private static final UUID OWNER = UUID.randomUUID();

    private CompanionLlm llm;
    private TeamChatBudget budget;
    private TeamChatContext context;
    private TeamChatReplyVoiceWriter writer;

    @BeforeEach
    void setUp() {
        llm = mock(CompanionLlm.class);
        budget = mock(TeamChatBudget.class);
        context = mock(TeamChatContext.class);
        PromptPersona persona = mock(PromptPersona.class);
        when(budget.hasRoom(OWNER)).thenReturn(true);
        when(context.build(any(), any(), any()))
                .thenReturn(new TeamChatContextBlock(List.of(), List.of("2026-09-20 → EXPIRED"), List.of(), List.of()));
        when(persona.render(any(), anyString())).thenAnswer(inv -> inv.getArgument(1));
        writer = writerAnsweringNothing(persona);
    }

    private TeamChatReplyVoiceWriter writerAnsweringNothing(PromptPersona persona) {
        return new TeamChatReplyVoiceWriter(llm, new LlmCallContextHolder(), persona, budget, context,
                JsonMapper.builder().build());
    }

    private TeamChatReplyVoiceWriter writerAnswering(String json) {
        when(llm.complete(anyString(), anyString())).thenReturn(json);
        return writer;
    }

    private static TeamChatThreadEntity thread(String owner) {
        TeamChatThreadEntity t = new TeamChatThreadEntity();
        t.setId(UUID.randomUUID());
        t.setCreatedBy(OWNER);
        t.setFlagKey(FlagKey.LOAD_FUEL_MISMATCH);
        t.setOwnerCharacter(owner);
        t.setStatus("OPEN");
        t.setOpenedAt(Instant.now());
        return t;
    }

    private static final TeamChatThreadEntity falatThread = thread("falat");

    @Test
    void markerMirror_matches() {
        assertThat(FakeCompanionLlm.TEAM_CHAT_REPLY_MARKER_MIRROR).isEqualTo(TeamChatReplyVoiceWriter.MARKER);
        assertThat(TeamChatReplyVoiceWriter.MARKER).doesNotStartWith(TeamChatVoiceWriter.MARKER);
        assertThat(TeamChatVoiceWriter.MARKER).doesNotStartWith(TeamChatReplyVoiceWriter.MARKER);
    }

    @Test
    void parsesVerdictAndProposal_andAllowsTheUsersOwnNumbers() {
        var writer = writerAnswering("{\"reply\":\"Értem, a 10 órás kupa után ez természetes.\",\"verdict\":\"concrete_context\","
                + "\"contextTag\":\"meccsnap\",\"factText\":\"Meccsnapokon későn eszel — ez rendben van.\",\"keywords\":[\"Meccs\",\"kupa\"]}");
        var d = writer.write(OWNER, falatThread, List.of("10-kor ért véget a röpi kupa"), List.of(), null);
        assertThat(d.voiced()).isTrue();
        assertThat(d.verdict()).isEqualTo("concrete_context");
        assertThat(d.keywords()).containsExactly("meccs", "kupa");
    }

    @Test
    void inventedNumber_fallsBackToTemplate_withNoVerdict() {
        var d = writerAnswering("{\"reply\":\"Ez már a 3. alkalom.\",\"verdict\":\"concrete_context\",\"contextTag\":\"x\",\"factText\":\"y\",\"keywords\":[\"x1\"]}")
                .write(OWNER, falatThread, List.of("későn ettem"), List.of(), null);
        assertThat(d.voiced()).isFalse();
        assertThat(d.verdict()).isNull();
        assertThat(d.reply()).isEqualTo(TeamChatReplyVoiceWriter.templateFor(TeamCharacter.FALAT));
    }

    @Test
    void threeSentences_rejected() {
        var d = writerAnswering("{\"reply\":\"Értem. Ez rendben van. Köszönöm, hogy szóltál.\",\"verdict\":\"mood\","
                + "\"contextTag\":null,\"factText\":null,\"keywords\":[]}")
                .write(OWNER, falatThread, List.of("nem volt kedvem enni"), List.of(), null);
        assertThat(d.voiced()).isFalse();
        assertThat(d.verdict()).isNull();
        assertThat(d.reply()).isEqualTo(TeamChatReplyVoiceWriter.templateFor(TeamCharacter.FALAT));
    }

    @Test
    void malformedJson_or_llmThrows_or_budgetSpent_template() {
        // malformed JSON
        var malformed = writerAnswering("not-json")
                .write(OWNER, falatThread, List.of("valami"), List.of(), null);
        assertThat(malformed).isEqualTo(TeamChatReplyDraft.template(TeamChatReplyVoiceWriter.templateFor(TeamCharacter.FALAT)));

        // LLM throws
        when(llm.complete(anyString(), anyString())).thenThrow(new IllegalStateException("boom"));
        var threw = writer.write(OWNER, falatThread, List.of("valami"), List.of(), null);
        assertThat(threw).isEqualTo(TeamChatReplyDraft.template(TeamChatReplyVoiceWriter.templateFor(TeamCharacter.FALAT)));

        // budget spent
        when(budget.hasRoom(OWNER)).thenReturn(false);
        var noBudget = writer.write(OWNER, falatThread, List.of("valami"), List.of(), null);
        assertThat(noBudget).isEqualTo(TeamChatReplyDraft.template(TeamChatReplyVoiceWriter.templateFor(TeamCharacter.FALAT)));
    }

    @Test
    void unknownVerdict_isNulled() {
        var d = writerAnswering("{\"reply\":\"Értem, köszönöm, hogy elmondtad most.\",\"verdict\":\"banana\","
                + "\"contextTag\":null,\"factText\":null,\"keywords\":[]}")
                .write(OWNER, falatThread, List.of("valami"), List.of(), null);
        assertThat(d.voiced()).isTrue();
        assertThat(d.verdict()).isNull();
    }

    @Test
    void userMessage_carriesFlagLabelFactsUserTextAndOffer() {
        writerAnswering("{\"reply\":\"Értem, köszönöm, hogy elmondtad most.\",\"verdict\":\"other\","
                + "\"contextTag\":null,\"factText\":null,\"keywords\":[]}")
                .write(OWNER, falatThread, List.of("nem volt kedvem enni"), List.of("Terhelés magas volt"), "REVIEW ajánlva");

        ArgumentCaptor<String> user = ArgumentCaptor.forClass(String.class);
        org.mockito.Mockito.verify(llm).complete(anyString(), user.capture());
        assertThat(user.getValue())
                .contains("karakter: Falat")
                .contains("ügy: Terhelés–táplálás")
                .contains("tények:\n- Terhelés magas volt")
                .contains("a felhasználó írta:\n- nem volt kedvem enni")
                .contains("ajánlat: REVIEW ajánlva")
                .contains("háttér — számot innen NE írj")
                .contains("2026-09-20 → EXPIRED");
    }

    @Test
    void fakeAnswerPassesTheGuard() {
        FakeCompanionLlm fake = new FakeCompanionLlm();
        PromptPersona persona = mock(PromptPersona.class);
        when(persona.render(any(), anyString())).thenAnswer(inv -> inv.getArgument(1));
        TeamChatReplyVoiceWriter fakeWriter = new TeamChatReplyVoiceWriter(fake, new LlmCallContextHolder(), persona,
                budget, context, JsonMapper.builder().build());

        var d = fakeWriter.write(OWNER, falatThread, List.of("nem volt kedvem enni"), List.of(), null);

        assertThat(d.voiced()).isTrue();
        assertThat(d.reply()).isEqualTo(FakeCompanionLlm.TEAM_CHAT_REPLY_BODY);
    }
}
