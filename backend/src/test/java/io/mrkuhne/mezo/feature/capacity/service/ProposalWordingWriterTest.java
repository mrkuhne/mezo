package io.mrkuhne.mezo.feature.capacity.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.mrkuhne.mezo.feature.capacity.service.AdjustmentPayload.MoveSessionDay;
import io.mrkuhne.mezo.feature.capacity.service.Effects.DayEffect;
import io.mrkuhne.mezo.feature.capacity.service.Effects.RestEffect;
import io.mrkuhne.mezo.feature.capacity.service.Effects.WeekTotals;
import io.mrkuhne.mezo.feature.capacity.service.ProposalWordingWriter.Wording;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.core.task.SimpleAsyncTaskExecutor;
import tools.jackson.databind.json.JsonMapper;

/**
 * Boop B7 K3 (mezo-r36n9.17, Task 16): the proposal words — the spike-phrased template from facts + engine effects,
 * and the cheap-tier rephrasing accepted only when it brings no number. Figures are invented ("például").
 */
class ProposalWordingWriterTest {

    static final LocalDate THU = LocalDate.of(2026, 11, 26);
    static final LocalDate SAT = LocalDate.of(2026, 11, 28);
    static final LocalDate SUN = LocalDate.of(2026, 11, 29);

    static ProposalDraft move() {
        Map<String, Object> f = new LinkedHashMap<>();
        f.put("fromDate", THU.toString());
        f.put("reason", "6 óra megbeszélés");
        f.put("sessionLabel", "Lábnap");
        f.put("sessionTime", "18:00");
        f.put("minutes", 60);
        f.put("heavy", true);
        f.put("toDate", SAT.toString());
        f.put("toEmptyCalendar", true);
        f.put("toReason", "");
        return new ProposalDraft("MOVE_SESSION_DAY",
            List.of(AdjustmentDraft.of(new MoveSessionDay(UUID.randomUUID(), THU, SAT))), f, 0.6);
    }

    static Effects effects() {
        return new Effects(
            List.of(new DayEffect(THU, "túl sok", "szoros", 1.6, 0.95, 290, 0),
                new DayEffect(SAT, "laza", "rendben", 0.35, 0.85, null, 290)),
            List.of(new RestEffect(SUN, "röplabda", 1, 0)), null,
            new WeekTotals(4, 17920, 52.5), new WeekTotals(4, 17920, 52.5), LocalDate.of(2026, 12, 19), 290);
    }

    @SuppressWarnings("unchecked")
    static ProposalWordingWriter writer(CompanionLlm llm) {
        ObjectProvider<CompanionLlm> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(llm);
        return new ProposalWordingWriter(provider, new LlmCallContextHolder(), JsonMapper.builder().build(),
            new SimpleAsyncTaskExecutor("words-test-"));
    }

    @Test
    void templateFollowsTheSpikeAndSaysTheExtraComesWithTheSession() {
        Wording w = writer(null).template(move(), effects());

        assertThat(w.title()).isEqualTo("A csütörtöki edzést tedd át szombatra");
        assertThat(w.move()).isEqualTo("csütörtök 18:00  →  szombat 18:00 (üres nap)");
        assertThat(w.effectLines()).containsExactly(
            "A csütörtök túl sok helyett szoros lesz, a szombat laza helyett rendben",
            "Az edzésnapi 290 kcal többlet szombaton jár, amikor megcsinálod",
            "A vasárnapi röplabda előtt nem marad pihenőnap",
            "A heti 4 edzés megmarad, az Évad terve nem változik");
        assertThat(w.why()).containsExactly("Amit csütörtökön látok: 6 óra megbeszélés",
            "Amit szombaton látok: üres a naptárad");
    }

    @Test
    void wordingFallsBackToTemplate() {
        CompanionLlm throwing = mock(CompanionLlm.class);
        when(throwing.complete(anyString(), anyString())).thenThrow(new IllegalStateException("quota"));
        CompanionLlm junk = mock(CompanionLlm.class);
        when(junk.complete(anyString(), anyString())).thenReturn("nem JSON");
        CompanionLlm missing = mock(CompanionLlm.class);
        when(missing.complete(anyString(), anyString())).thenReturn("{\"title\":\"Tedd át\",\"effectLines\":[\"egy\"]}");
        Wording template = writer(null).template(move(), effects());

        assertThat(writer(null).word(move(), effects())).isEqualTo(template);
        assertThat(writer(throwing).word(move(), effects())).isEqualTo(template);
        assertThat(writer(junk).word(move(), effects())).isEqualTo(template);
        assertThat(writer(missing).word(move(), effects())).isEqualTo(template);
    }

    @Test
    void wordingNeverIntroducesNumbers() {
        CompanionLlm inventing = mock(CompanionLlm.class);
        when(inventing.complete(anyString(), anyString())).thenReturn("""
            {"title":"Szombatra vele","effectLines":["Csütörtök könnyebb lesz","3 óra pihenőt nyersz",
            "A 290 kcal szombaton jár","A heti 4 edzés marad"],"why":["Sok a megbeszélés","Szombat üres"]}""");
        CompanionLlm faithful = mock(CompanionLlm.class);
        when(faithful.complete(anyString(), anyString())).thenReturn("""
            {"title":"Vidd át a lábnapot szombatra","effectLines":["Csütörtök szorosra enyhül, szombat rendben lesz",
            "A 290 kcal többlet szombaton jár, ha megcsinálod","Vasárnap röpi előtt nem pihensz",
            "A heti 4 edzés marad"],"why":["Csütörtökön 6 óra megbeszélésed van","Szombat üres"]}""");
        Wording template = writer(null).template(move(), effects());

        assertThat(writer(inventing).word(move(), effects())).isEqualTo(template);

        Wording rephrased = writer(faithful).word(move(), effects());
        assertThat(rephrased.title()).isEqualTo("Vidd át a lábnapot szombatra");
        assertThat(rephrased.move()).isEqualTo(template.move()); // the from → to line is always the template's
        assertThat(rephrased.effectLines()).hasSize(4);
    }

    @Test
    void templateOnlyNeverCallsTheModel() {
        CompanionLlm llm = mock(CompanionLlm.class);
        Wording w = writer(llm).word(move(), effects(), true);

        assertThat(w).isEqualTo(writer(null).template(move(), effects()));
        verify(llm, never()).complete(anyString(), anyString());
    }

    @Test
    void everyKindHasThreeOrFourEffectLines() {
        Map<String, Object> bed = new LinkedHashMap<>();
        bed.put("night", "2026-11-25");
        bed.put("nextDate", THU.toString());
        bed.put("eventTitle", "Hívás");
        bed.put("eventEnd", "21:30");
        bed.put("bedtimeBefore", "22:30");
        bed.put("bedtimeAfter", "23:00");
        bed.put("sessionBefore", "6:45");
        bed.put("sessionAfter", "7:15");
        bed.put("firstEventNext", "8:30");
        Effects sleep = new Effects(List.of(), List.of(),
            new Effects.SleepEffect(LocalDate.parse("2026-11-25"), java.time.LocalTime.of(22, 30),
                java.time.LocalTime.of(23, 0), 450),
            new WeekTotals(4, 17920, 52.5), new WeekTotals(4, 17920, 52.5), null, null);
        Wording b = writer(null).template(new ProposalDraft("SHIFT_BEDTIME", List.of(), bed, 0.1), sleep);
        assertThat(b.title()).isEqualTo("Szerdán feküdj később, a csütörtöki edzés kezdődjön később");
        assertThat(b.move()).isEqualTo("lefekvés 22:30 → 23:00  ·  csütörtök edzés 6:45 → 7:15");
        assertThat(b.effectLines()).hasSizeBetween(3, 4)
            .contains("A 21:30-ig tartó esemény után is meglesz a 7 óra 30 perc alvás");

        Map<String, Object> todo = new LinkedHashMap<>();
        todo.put("date", "2026-11-27");
        todo.put("eventTitle", "Sprint review");
        todo.put("fromStart", "16:30");
        todo.put("fromEnd", "17:15");
        todo.put("toStart", "15:30");
        todo.put("toEnd", "16:15");
        todo.put("gapBeforeMin", 15L);
        todo.put("gapAfterMin", 75L);
        Wording t = writer(null).template(new ProposalDraft("CALENDAR_TODO", List.of(), todo, 0.1), sleep);
        assertThat(t.title()).isEqualTo("A pénteki „Sprint review” eseményt tedd egy órával korábbra");
        assertThat(t.effectLines()).hasSizeBetween(3, 4);

        Map<String, Object> meal = new LinkedHashMap<>();
        meal.put("date", THU.toString());
        meal.put("blockStart", "13:00");
        meal.put("blockEnd", "15:30");
        meal.put("lunchKcal", 200);
        meal.put("dinnerKcal", -200);
        Wording m = writer(null).template(new ProposalDraft("MOVE_MEAL_ENERGY", List.of(), meal, 0.05), sleep);
        assertThat(m.move()).isEqualTo("ebéd +200 kcal  ·  vacsora −200 kcal");
        assertThat(m.effectLines()).hasSizeBetween(3, 4).contains("A napi keret ugyanannyi marad");
    }
}
