package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEnvelope;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CompanionMessagePopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/** companion_message jsonb envelope round-trip + the partial-unique regeneration contract (spec §4). */
@Transactional
class CompanionMessagePersistenceIT extends AbstractIntegrationTest {

    private static final LocalDate DAY = LocalDate.of(2026, 8, 15);

    @Autowired private CompanionMessageRepository companionMessageRepository;
    @Autowired private CompanionMessagePopulator companionMessagePopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testSave_shouldRoundTripContentEnvelope_whenReloaded() {
        UUID user = userPopulator.createUser("companion-message-rt@test.local").getId();
        CompanionMessageEntity saved = companionMessagePopulator.createMessage(
                user, DAY, CompanionMessageEntity.KIND_MORNING, "Jó reggelt", List.of("Aludtál 7 órát."));

        CompanionMessageEntity reloaded = companionMessageRepository
                .findByCreatedByAndMessageDateAndKind(user, DAY, CompanionMessageEntity.KIND_MORNING)
                .orElseThrow();

        assertThat(reloaded.getId()).isEqualTo(saved.getId());
        assertThat(reloaded.getContent().eyebrow()).isEqualTo("Jó reggelt");
        assertThat(reloaded.getContent().body()).containsExactly("Aludtál 7 órát.");
        assertThat(reloaded.getContent().refs()).isEmpty();
        assertThat(reloaded.getGeneratedAt()).isNotNull();
    }

    @Test
    void testSave_shouldRejectSecondLiveRowForSameDayAndKind_whenUniqueIndexHolds() {
        UUID user = userPopulator.createUser("companion-message-uq@test.local").getId();
        companionMessagePopulator.createMessage(
                user, DAY, CompanionMessageEntity.KIND_MORNING, "Jó reggelt", List.of("Aludtál 7 órát."));

        assertThatThrownBy(() -> companionMessagePopulator.createMessage(
                user, DAY, CompanionMessageEntity.KIND_MORNING, "Jó reggelt", List.of("Aludtál 7 órát.")))
                .hasMessageContaining("uq_companion_message_created_by_date_kind");
    }

    @Test
    void testSoftDelete_shouldAllowRegeneration_whenOldRowDeleted() {
        UUID user = userPopulator.createUser("companion-message-regen@test.local").getId();
        CompanionMessageEntity first = companionMessagePopulator.createMessage(
                user, DAY, CompanionMessageEntity.KIND_MORNING, "Jó reggelt", List.of("Aludtál 7 órát."));
        companionMessageRepository.delete(first);   // @SQLDelete -> is_deleted = true
        companionMessageRepository.flush();

        CompanionMessageEntity second = companionMessagePopulator.createMessage(
                user, DAY, CompanionMessageEntity.KIND_MORNING, "Jó reggelt", List.of("Aludtál újra 7 órát."));

        assertThat(second.getId()).isNotEqualTo(first.getId());
        assertThat(companionMessageRepository
                .findByCreatedByAndMessageDateAndKind(user, DAY, CompanionMessageEntity.KIND_MORNING))
                .hasValueSatisfying(m -> assertThat(m.getId()).isEqualTo(second.getId()));
    }

    @Test
    void testFindByCreatedByAndMessageDateOrderByGeneratedAtAsc_shouldOrderByGeneratedAt_whenTwoKinds() throws InterruptedException {
        UUID user = userPopulator.createUser("companion-message-order@test.local").getId();
        CompanionMessageEntity morning = companionMessagePopulator.createMessage(
                user, DAY, CompanionMessageEntity.KIND_MORNING, "Jó reggelt", List.of("Aludtál 7 órát."));
        Thread.sleep(5);
        CompanionMessageEntity midday = companionMessagePopulator.createMessage(
                user, DAY, CompanionMessageEntity.KIND_MIDDAY, "Déli check-in", List.of("Így alakul a napod."));

        List<CompanionMessageEntity> ordered = companionMessageRepository
                .findByCreatedByAndMessageDateOrderByGeneratedAtAsc(user, DAY);

        assertThat(ordered).extracting(CompanionMessageEntity::getId)
                .containsExactly(morning.getId(), midday.getId());
    }

    @Test
    void testFindByCreatedByAndMessageDateAndKind_shouldReturnEmpty_whenOtherUsersRow() {
        UUID owner = userPopulator.createUser("companion-message-own@test.local").getId();
        UUID other = userPopulator.createUser("companion-message-other@test.local").getId();
        companionMessagePopulator.createMessage(
                other, DAY, CompanionMessageEntity.KIND_MORNING, "Jó reggelt", List.of("Aludtál 7 órát."));

        assertThat(companionMessageRepository
                .findByCreatedByAndMessageDateAndKind(owner, DAY, CompanionMessageEntity.KIND_MORNING))
                .isEmpty();
    }
}
