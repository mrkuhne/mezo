package io.mrkuhne.mezo.feature.proactive.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import org.junit.jupiter.api.Test;

/**
 * Pins the memoir prompt's LOAD-BEARING lines (mezo-uajy) — the marker the fake dispatches on,
 * the no-moralizing voice contract, the paragraph instruction and the anchors JSON shape — plus
 * the pure {@link MemoirGenerator#memoryLabel} composition. The full prose is deliberately NOT
 * pinned: the voice stays tunable without a test edit, only the contract lines are frozen.
 */
class MemoirPromptTest {

    @Test
    void testPrompt_shouldCarryVoiceContractAndJsonShape() {
        assertThat(MemoirGenerator.PROMPT)
                .startsWith(MemoirGenerator.MEMOIR_MARKER)
                .contains("sosem moralizálsz")
                .contains("nem adsz tanácsot")
                .contains("2–4 bekezdés")
                .contains("\\n\\n")
                .contains("Gyógyszer adagolására vonatkozó változtatást SOHA ne javasolj")
                .contains("\"anchors\"");
    }

    @Test
    void testMemoryLabel_shouldComposeHungarianDateWithNote() {
        assertThat(MemoirGenerator.memoryLabel(LocalDate.of(2026, 8, 29), "a négyórás verseny"))
                .isEqualTo("aug. 29., szombat — a négyórás verseny");
    }

    @Test
    void testMemoryLabel_shouldStandAlone_whenNoteMissing() {
        assertThat(MemoirGenerator.memoryLabel(LocalDate.of(2026, 8, 29), null))
                .isEqualTo("aug. 29., szombat");
        assertThat(MemoirGenerator.memoryLabel(LocalDate.of(2026, 8, 29), "  "))
                .isEqualTo("aug. 29., szombat");
    }

    @Test
    void testMemoryLabel_shouldClipOverlongNotes() {
        String note = "x".repeat(80);
        assertThat(MemoirGenerator.memoryLabel(LocalDate.of(2026, 8, 29), note))
                .isEqualTo("aug. 29., szombat — " + "x".repeat(60));
    }
}
