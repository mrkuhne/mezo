package io.mrkuhne.mezo.feature.auth.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashSet;
import java.util.Set;
import org.junit.jupiter.api.Test;

class InviteServiceTest {

    @Test
    void testGenerateCode_shouldMatchReadableShape_whenCalled() {
        String code = InviteService.generateCode();
        assertThat(code).matches("MEZO-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}");
    }

    @Test
    void testGenerateCode_shouldBeUnique_whenCalledManyTimes() {
        Set<String> seen = new HashSet<>();
        for (int i = 0; i < 1000; i++) seen.add(InviteService.generateCode());
        assertThat(seen).hasSize(1000);
    }
}
