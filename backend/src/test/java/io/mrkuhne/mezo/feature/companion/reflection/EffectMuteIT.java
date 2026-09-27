package io.mrkuhne.mezo.feature.companion.reflection;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.reflection.entity.EffectMuteEntity;
import io.mrkuhne.mezo.feature.companion.reflection.repository.EffectMuteRepository;
import io.mrkuhne.mezo.feature.companion.reflection.service.EffectLinkService;
import io.mrkuhne.mezo.feature.companion.reflection.service.EffectMuteService;
import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.MentionPopulator;
import io.mrkuhne.mezo.support.populator.PersonPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * S6 (mezo-d6ivw.6): effect mute/forget — the engine side. {@code muted} is skipped by every
 * prompt reader (gate, prompt block, edition source) but stays visible on the hub/person read,
 * flagged; {@code forgotten} vanishes everywhere and — unlike a plain flag on the {@code
 * effect_link} row — survives the nightly recompute (S4, mezo-d6ivw.4), because {@code
 * effect_mute} is a separate, non-recomputed table keyed on the SUBJECT, not the row.
 */
@ActiveProfiles("companion-fake")
class EffectMuteIT extends AbstractIntegrationTest {

    private static final LocalDate TODAY = LocalDate.now();

    @Autowired private EffectMuteService muteService;
    @Autowired private EffectLinkService effectLinkService;
    @Autowired private EffectMuteRepository muteRepository;
    @Autowired private UserPopulator userPopulator;
    @Autowired private PersonPopulator personPopulator;
    @Autowired private MentionPopulator mentionPopulator;
    @Autowired private CheckInPopulator checkInPopulator;

    private UUID strongPersonId;
    private String personName;

    private static Instant noon(LocalDate day) {
        return day.atTime(12, 0).atZone(ZoneId.systemDefault()).toInstant();
    }

    /** Days {@code today-first .. today-(first+count-1)} — mirrors EffectLinkServiceIT's helper. */
    private List<LocalDate> days(int first, int count) {
        List<LocalDate> out = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            out.add(TODAY.minusDays(first + i));
        }
        return out;
    }

    /**
     * Anna: 16 mention days with an elevated mental check-in vs. a flat 12-day baseline — the same
     * shape as {@code EffectLinkServiceIT#promptBlockOnlyDoubleGatedRows}'s Anna, which clears the
     * double gate at {@code kozepes}/{@code eros}. Sets {@link #strongPersonId}/{@link #personName}.
     */
    private UUID seededOwnerWithStrongPersonEffect() {
        UUID owner = userPopulator.createUser().getId();
        PersonEntity anna = personPopulator.createPerson(owner, "Anna");
        strongPersonId = anna.getId();
        personName = anna.getName();
        List<LocalDate> mentionDays = days(1, 16);
        mentionDays.forEach(d -> mentionPopulator.createMention(owner, anna.getId(), noon(d), "neutral"));
        mentionDays.forEach(d -> checkInPopulator.createCheckIn(owner, d, "08:00", 3, 3, 3, 8, null));
        days(17, 12).forEach(d -> checkInPopulator.createCheckIn(owner, d, "08:00", 3, 3, 3, 5, null));
        effectLinkService.recompute(owner, TODAY);
        return owner;
    }

    @Test
    void mutedSubject_shouldBeSkippedByEveryPromptReader_butStayVisibleFlagged() {
        UUID owner = seededOwnerWithStrongPersonEffect();
        String personKey = strongPersonId.toString();
        muteService.mute(owner, "person", personKey, EffectMuteEntity.MODE_MUTED);

        assertThat(effectLinkService.gatedEffects(owner)).noneMatch(g -> g.subjectKey().equals(personKey));
        assertThat(effectLinkService.promptBlock(owner)).doesNotContain(personName);
        assertThat(effectLinkService.effectViews(owner, null))
                .filteredOn(v -> v.row().getSubjectKey().equals(personKey))
                .isNotEmpty().allMatch(EffectLinkService.EffectView::muted);
    }

    @Test
    void forgottenSubject_shouldVanishEverywhere_andSurviveTheNightlyRecompute() {
        UUID owner = seededOwnerWithStrongPersonEffect();
        String personKey = strongPersonId.toString();
        muteService.mute(owner, "person", personKey, EffectMuteEntity.MODE_FORGOTTEN);

        effectLinkService.recompute(owner, TODAY); // soft-deletes and re-creates the rows

        assertThat(effectLinkService.effectViews(owner, null)).noneMatch(v -> v.row().getSubjectKey().equals(personKey));
        assertThat(effectLinkService.effectsForPerson(owner, strongPersonId)).isEmpty();
        assertThat(effectLinkService.gatedEffects(owner)).noneMatch(g -> g.subjectKey().equals(personKey));
    }

    @Test
    void forgotten_shouldBeSticky() {
        UUID owner = userPopulator.createUser().getId();
        muteService.mute(owner, "event", "munka", EffectMuteEntity.MODE_FORGOTTEN);
        muteService.mute(owner, "event", "munka", EffectMuteEntity.MODE_MUTED);
        muteService.unmute(owner, "event", "munka");

        assertThat(muteRepository.findByCreatedByAndSubjectKindAndSubjectKeyAndDeletedFalse(owner, "event", "munka"))
                .get().extracting(EffectMuteEntity::getMode).isEqualTo(EffectMuteEntity.MODE_FORGOTTEN);
    }

    @Test
    void unmute_shouldRestoreAMutedSubject() {
        UUID owner = userPopulator.createUser().getId();
        muteService.mute(owner, "event", "pihenes", EffectMuteEntity.MODE_MUTED);
        muteService.unmute(owner, "event", "pihenes");

        assertThat(muteRepository.findByCreatedByAndSubjectKindAndSubjectKeyAndDeletedFalse(owner, "event", "pihenes")).isEmpty();
    }
}
