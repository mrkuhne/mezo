package io.mrkuhne.mezo.feature.character.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import io.mrkuhne.mezo.feature.auth.service.PromptPersona;
import io.mrkuhne.mezo.feature.character.entity.TeamChatThreadEntity;
import io.mrkuhne.mezo.feature.character.service.chat.TeamChatBudget;
import io.mrkuhne.mezo.feature.character.service.chat.TeamChatContext;
import io.mrkuhne.mezo.feature.character.service.chat.TeamChatContextBlock;
import io.mrkuhne.mezo.feature.character.service.chat.TeamChatLines;
import io.mrkuhne.mezo.feature.character.service.chat.TeamChatVoiceWriter;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import tools.jackson.databind.json.JsonMapper;

/**
 * Csapatfal Act III Task 9 (mezo-a9bo7.22): the team chat voice — owner, guest and Szkeptikus in
 * one guarded call, under the monthly USD cap, falling back to the template on every failure.
 */
class TeamChatVoiceWriterTest {

    private static final UUID OWNER = UUID.randomUUID();
    private static final String TEMPLATE = "Ma legyen egy könnyebb nap, és egyél egy kicsit többet.";
    private static final List<String> FACTS =
            List.of("Terhelés 7 nap átlagban: 610,0 perc-ekvivalens/nap (küszöb 500,0)");

    private CompanionLlm llm;
    private TeamChatBudget budget;
    private TeamChatVoiceWriter writer;

    @BeforeEach
    void setUp() {
        llm = mock(CompanionLlm.class);
        budget = mock(TeamChatBudget.class);
        TeamChatContext context = mock(TeamChatContext.class);
        PromptPersona persona = mock(PromptPersona.class);
        when(budget.hasRoom(OWNER)).thenReturn(true);
        when(context.build(any(), any(), any()))
                .thenReturn(new TeamChatContextBlock(List.of(), List.of("2026-09-20 → EXPIRED"), List.of(), List.of()));
        when(persona.render(any(), anyString())).thenAnswer(inv -> inv.getArgument(1));
        writer = new TeamChatVoiceWriter(llm, new LlmCallContextHolder(), persona, budget, context,
                JsonMapper.builder().build());
    }

    private static TeamChatThreadEntity thread(String owner, String guest) {
        TeamChatThreadEntity t = new TeamChatThreadEntity();
        t.setId(UUID.randomUUID());
        t.setCreatedBy(OWNER);
        t.setFlagKey(FlagKey.LOAD_FUEL_MISMATCH);
        t.setOwnerCharacter(owner);
        t.setGuestCharacter(guest);
        t.setStatus("OPEN");
        t.setOpenedAt(Instant.now());
        return t;
    }

    private void answer(String json) {
        when(llm.complete(anyString(), anyString())).thenReturn(json);
    }

    private String userMessage() {
        ArgumentCaptor<String> user = ArgumentCaptor.forClass(String.class);
        verify(llm).complete(anyString(), user.capture());
        return user.getValue();
    }

    @Test
    void markerIsMirroredLiterallyInTheFake() {
        assertThat(FakeCompanionLlm.TEAM_CHAT_MARKER_MIRROR).isEqualTo(TeamChatVoiceWriter.MARKER);
    }

    @Test
    void happyPath_ownerAndGuestVoiced() {
        answer("""
                {"owner":"Az elmúlt 7 napban sokat mozogtál. Ma egy könnyebb nap jólesne ⚡",
                 "guest":"Egy kis plusz szénhidrát ma segít 🍽","skeptic":null}""");

        TeamChatLines lines = writer.write(OWNER, thread("mocor", "falat"), "OPEN", FACTS, TEMPLATE, false);

        assertThat(lines.voiced()).isTrue();
        assertThat(lines.ownerBody()).startsWith("Az elmúlt 7 napban");
        assertThat(lines.guestBody()).contains("Egy kis plusz szénhidrát ma segít 🍽");
        assertThat(lines.skepticBody()).isEmpty();
        ArgumentCaptor<String> system = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> user = ArgumentCaptor.forClass(String.class);
        verify(llm).complete(system.capture(), user.capture());
        assertThat(system.getValue()).startsWith(TeamChatVoiceWriter.MARKER + "\n");
        assertThat(user.getValue())
                .contains("karakter: Mocor · mozgás · emoji:")
                .contains("most kapcsolt be: mondd el, mi a teendő")
                .contains("tények:\n- " + FACTS.getFirst())
                .contains("teendő: " + TEMPLATE)
                .contains("háttér — számot innen NE írj")
                .contains("2026-09-20 → EXPIRED")
                .contains("vendég: Falat")
                .doesNotContain("szkeptikus:");
    }

    @Test
    void ownerRejectedByTheGuard_templateAndNoGuest() {
        answer("""
                {"owner":"Az elmúlt 99 napban sokat mozogtál. Ma pihenj ⚡","guest":"Egyél többet 🍽"}""");

        TeamChatLines lines = writer.write(OWNER, thread("mocor", "falat"), "OPEN", FACTS, TEMPLATE, true);

        assertThat(lines).isEqualTo(TeamChatLines.template(TEMPLATE));
    }

    @Test
    void guestRejectedAlone_isDropped_ownerStaysVoiced() {
        answer("""
                {"owner":"Az elmúlt 7 napban sokat mozogtál. Ma pihenj egy kicsit.","guest":"Egyél 42 grammal többet 🍽"}""");

        TeamChatLines lines = writer.write(OWNER, thread("mocor", "falat"), "OPEN", FACTS, TEMPLATE, false);

        assertThat(lines.voiced()).isTrue();
        assertThat(lines.guestBody()).isEmpty();
    }

    @Test
    void budgetExhausted_noLlmCall_template() {
        when(budget.hasRoom(OWNER)).thenReturn(false);

        TeamChatLines lines = writer.write(OWNER, thread("mocor", "falat"), "OPEN", FACTS, TEMPLATE, true);

        assertThat(lines).isEqualTo(TeamChatLines.template(TEMPLATE));
        verifyNoInteractions(llm);
    }

    @Test
    void llmFailure_template() {
        when(llm.complete(anyString(), anyString())).thenThrow(new IllegalStateException("boom"));

        assertThat(writer.write(OWNER, thread("mocor", "falat"), "OPEN", FACTS, TEMPLATE, false))
                .isEqualTo(TeamChatLines.template(TEMPLATE));
    }

    @Test
    void unparseableAnswer_template() {
        answer("not-json");

        assertThat(writer.write(OWNER, thread("mocor", "falat"), "OPEN", FACTS, TEMPLATE, false))
                .isEqualTo(TeamChatLines.template(TEMPLATE));
    }

    @Test
    void skeptic_onlyWhenEligible() {
        String json = """
                {"owner":"Az elmúlt 7 napban sokat mozogtál. Ma pihenj egy kicsit.","guest":null,
                 "skeptic":"Két napon nincs rögzített kalória, ez becslés."}""";
        List<String> facts = List.of(FACTS.getFirst(), "Hiányzó adat: az utolsó 7 napból 2 napon nincs rögzített kalória");
        answer(json);

        TeamChatLines eligible = writer.write(OWNER, thread("mocor", null), "OPEN", facts, TEMPLATE, true);

        assertThat(eligible.skepticBody()).contains("Két napon nincs rögzített kalória, ez becslés.");
        assertThat(userMessage()).contains("szkeptikus: a Szkeptikus egy száraz mondatban");
    }

    @Test
    void skeptic_notEligible_isNeitherAskedNorKept() {
        answer("""
                {"owner":"Az elmúlt 7 napban sokat mozogtál. Ma pihenj egy kicsit.","skeptic":"Ez csak becslés."}""");

        TeamChatLines lines = writer.write(OWNER, thread("mocor", null), "OPEN", FACTS, TEMPLATE, false);

        assertThat(lines.voiced()).isTrue();
        assertThat(lines.skepticBody()).isEmpty();
        assertThat(userMessage()).doesNotContain("szkeptikus:");
    }

    @Test
    void skeptic_neverOnResolve_butTheGuestMaySpeak() {
        answer("""
                {"owner":"Rendben, a terhelés visszaállt. Szép munka ⚡","guest":"Akkor este teljes gázzal 🍽",
                 "skeptic":"Ez csak becslés."}""");

        TeamChatLines lines = writer.write(OWNER, thread("mocor", "falat"), "RESOLVE", FACTS, TEMPLATE, true);

        assertThat(lines.voiced()).isTrue();
        assertThat(lines.guestBody()).isPresent();
        assertThat(lines.skepticBody()).isEmpty();
        assertThat(userMessage()).contains("rendeződött: zárd le röviden").doesNotContain("szkeptikus:");
    }

    @Test
    void skepticWithEmoji_isDropped() {
        answer("""
                {"owner":"Az elmúlt 7 napban sokat mozogtál. Ma pihenj egy kicsit.","skeptic":"Ez csak becslés ⚡"}""");

        TeamChatLines lines = writer.write(OWNER, thread("mocor", null), "OPEN", FACTS, TEMPLATE, true);

        assertThat(lines.voiced()).isTrue();
        assertThat(lines.skepticBody()).isEmpty();
    }

    @Test
    void fakeAnswerPassesTheGuard() {
        FakeCompanionLlm fake = new FakeCompanionLlm();
        writer = new TeamChatVoiceWriter(fake, new LlmCallContextHolder(), mockPersona(), budget,
                emptyContext(), JsonMapper.builder().build());

        TeamChatLines lines = writer.write(OWNER, thread("mocor", "falat"), "OPEN", FACTS, TEMPLATE, true);

        assertThat(lines.voiced()).isTrue();
        assertThat(lines.ownerBody()).isEqualTo(FakeCompanionLlm.teamChatOwnerBody(FACTS.getFirst()));
        assertThat(lines.guestBody()).contains(FakeCompanionLlm.TEAM_CHAT_GUEST_BODY);
        assertThat(lines.skepticBody()).contains(FakeCompanionLlm.TEAM_CHAT_SKEPTIC_BODY);
    }

    private static PromptPersona mockPersona() {
        PromptPersona persona = mock(PromptPersona.class);
        when(persona.render(any(), anyString())).thenAnswer(inv -> inv.getArgument(1));
        return persona;
    }

    private static TeamChatContext emptyContext() {
        TeamChatContext context = mock(TeamChatContext.class);
        when(context.build(any(), any(), any()))
                .thenReturn(new TeamChatContextBlock(List.of(), List.of(), List.of(), List.of()));
        return context;
    }

    // --- Szkeptikus eligibility: one case per rule whose frozen payload can expose a gap ---

    @Test
    void sleepDebt_gapWhenLoggedNightsBelowTheWindow() {
        FlagPayloadEnvelope gap = FlagPayloadEnvelope.sleepDebt(
                new FlagPayloadEnvelope.SleepDebt(7.5, 3, 2, 3.0, 4.0, Map.of()));
        FlagPayloadEnvelope full = FlagPayloadEnvelope.sleepDebt(
                new FlagPayloadEnvelope.SleepDebt(7.5, 3, 3, 3.0, 4.0, Map.of()));

        assertThat(TeamChatVoiceWriter.skepticGap(FlagKey.SLEEP_DEBT, gap))
                .contains("Hiányzó adat: a 3 éjszakából 1 nincs rögzítve");
        assertThat(TeamChatVoiceWriter.skepticEligible(FlagKey.SLEEP_DEBT, full)).isFalse();
    }

    @Test
    void loadFuelMismatch_gapPerUnloggedSide() {
        FlagPayloadEnvelope gap = FlagPayloadEnvelope.loadFuelMismatch(new FlagPayloadEnvelope.LoadFuelMismatch(
                7, 610.0, 500.0, 1800.0, 2600.0, 0.69, 0.8, 5, 6.2, 6.5, 6, 4, "both", null));
        FlagPayloadEnvelope full = FlagPayloadEnvelope.loadFuelMismatch(new FlagPayloadEnvelope.LoadFuelMismatch(
                7, 610.0, 500.0, 1800.0, 2600.0, 0.69, 0.8, 7, 6.2, 6.5, 7, 4, "both", null));

        assertThat(TeamChatVoiceWriter.skepticGap(FlagKey.LOAD_FUEL_MISMATCH, gap)).contains(
                "Hiányzó adat: az utolsó 7 napból 2 napon nincs rögzített kalória, 1 éjszakán nincs rögzített alvás");
        assertThat(TeamChatVoiceWriter.skepticEligible(FlagKey.LOAD_FUEL_MISMATCH, full)).isFalse();
    }

    @Test
    void rapidWeightLoss_gapWhenFewerWeighInsThanTheTrendWindow() {
        FlagPayloadEnvelope gap = FlagPayloadEnvelope.rapidWeightLoss(
                new FlagPayloadEnvelope.RapidWeightLoss(-1.2, -0.7, 4, 4, "maintain"));
        FlagPayloadEnvelope full = FlagPayloadEnvelope.rapidWeightLoss(
                new FlagPayloadEnvelope.RapidWeightLoss(-1.2, -0.7, 7, 4, "maintain"));

        assertThat(TeamChatVoiceWriter.skepticGap(FlagKey.RAPID_WEIGHT_LOSS, gap))
                .contains("Hiányzó adat: a 7 napos súlytrend 3 napján nincs mérés");
        assertThat(TeamChatVoiceWriter.skepticEligible(FlagKey.RAPID_WEIGHT_LOSS, full)).isFalse();
    }

    /** RecoveryNeededRule raises only when sleep, RPE AND stress were all observed — its payload can
     *  never show a missing input, so the Szkeptikus never speaks on it (no fabricated doubt). */
    @Test
    void recoveryNeeded_neverEligible() {
        FlagPayloadEnvelope payload = FlagPayloadEnvelope.recoveryNeeded(new FlagPayloadEnvelope.RecoveryNeeded(
                3, 6.0, 8.0, 7.0, 5.5, "2026-09-25", 8.5, "2026-09-25", 7.5, "2026-09-25"));

        assertThat(TeamChatVoiceWriter.skepticEligible(FlagKey.RECOVERY_NEEDED, payload)).isFalse();
    }

    @Test
    void unmappedRuleOrMissingPayload_neverEligible() {
        assertThat(TeamChatVoiceWriter.skepticEligible(FlagKey.LATE_EATING, null)).isFalse();
        assertThat(TeamChatVoiceWriter.skepticEligible(FlagKey.SLEEP_DEBT, null)).isFalse();
        assertThat(TeamChatVoiceWriter.skepticEligible(FlagKey.MISSED_WORKOUTS,
                FlagPayloadEnvelope.missedWorkouts(new FlagPayloadEnvelope.MissedWorkouts(
                        7, 2, 3, List.of("2026-09-20"), List.of("2026-09-20"))))).isFalse();
    }
}
