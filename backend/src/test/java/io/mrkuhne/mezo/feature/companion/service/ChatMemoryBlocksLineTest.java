package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.ChatMemoryItem;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** S8 (mezo-d6ivw.12): one prompt line of a memory item — a blank name is no name. */
class ChatMemoryBlocksLineTest {

    private static ChatMemoryItem personFact(String who) {
        return new ChatMemoryItem(ChatMemoryItem.KIND_PERSON_FACT, UUID.randomUUID(), UUID.randomUUID(),
                who, "Nem szereti a meglepetéseket", Instant.now(), false, UUID.randomUUID());
    }

    @Test
    void testLine_shouldPrefixTheName_whenKnown() {
        assertThat(ChatMemoryBlocks.line(personFact("Anna"))).isEqualTo("Anna: Nem szereti a meglepetéseket");
    }

    @Test
    void testLine_shouldTreatABlankNameLikeNoName() {
        assertThat(ChatMemoryBlocks.line(personFact(""))).isEqualTo("Nem szereti a meglepetéseket");
        assertThat(ChatMemoryBlocks.line(personFact(" \t"))).isEqualTo("Nem szereti a meglepetéseket");
        assertThat(ChatMemoryBlocks.line(personFact(null))).isEqualTo("Nem szereti a meglepetéseket");
    }
}
