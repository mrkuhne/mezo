package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.feature.character.config.CharacterFollowupProperties;
import io.mrkuhne.mezo.feature.character.entity.CharacterConferenceEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterFollowupsEnvelope;
import io.mrkuhne.mezo.feature.character.repository.CharacterConferenceRepository;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(name = io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class CharacterFollowupService {
    private final CharacterConferenceRepository conferences;
    private final CharacterMutationLock mutations;
    private final CharacterFollowupProperties properties;

    public record Draft(Integer index, String kind, String question, String requiredEvidence, LocalDate dueOn) {}
    public record Due(UUID sourceConferenceId, CharacterFollowupsEnvelope.Item item) {}

    public CharacterFollowupsEnvelope create(List<Draft> drafts, List<ClaimProposal> proposals, LocalDate today) {
        var items = new ArrayList<CharacterFollowupsEnvelope.Item>();
        if (drafts == null) return new CharacterFollowupsEnvelope(items);
        for (var draft : drafts) {
            if (items.size() == 3) break;
            if (draft == null || draft.index() == null || draft.index() < 0 || draft.index() >= proposals.size()
                    || draft.kind() == null || !List.of("QUESTION", "HYPOTHESIS").contains(draft.kind())
                    || draft.question() == null || draft.question().isBlank() || draft.question().length() > 1000
                    || draft.requiredEvidence() == null || draft.requiredEvidence().isBlank() || draft.requiredEvidence().length() > 1000
                    || draft.dueOn() == null || !draft.dueOn().isAfter(today)
                    || draft.dueOn().isAfter(today.plusDays(properties.maxHorizonDays()))) continue;
            if (items.stream().anyMatch(item -> item.sourceIndex() == draft.index())) continue;
            items.add(new CharacterFollowupsEnvelope.Item(UUID.randomUUID(), draft.index(), draft.kind(),
                    proposals.get(draft.index()).expertKey(), draft.question(), draft.requiredEvidence(),
                    draft.dueOn(), "WAITING", null, null));
        }
        return new CharacterFollowupsEnvelope(items);
    }

    public List<Due> due(UUID owner, LocalDate day) {
        return conferences.findDueFollowups(owner, day, properties.maxDue()).stream()
                .flatMap(conference -> conference.getFollowups().items().stream()
                        .filter(item -> "WAITING".equals(item.status()) && !item.dueOn().isAfter(day))
                        .map(item -> new Due(conference.getId(), item)))
                .limit(properties.maxDue()).toList();
    }

    public List<ExpertEvidence> evidence(List<Due> due) {
        return due.stream().map(value -> new ExpertEvidence(value.item().expertKey(), List.of(
                "Esedékes utánkövetés, eredeti szál: " + value.sourceConferenceId() + ", bejegyzés: " + value.item().sourceIndex()
                        + ". Kérdés: " + value.item().question() + ". Szükséges adat: " + value.item().requiredEvidence()
                        + ". Ez korábbi kérdés, nem új bizonyíték. Eszközzel ellenőrizd az új forrást; hiányzó adat nem cáfolat. "
                        + "Ne erősíts és ne alkalmazz ismét állítást ugyanazzal a bizonyítékkal."),
                List.of(value.sourceConferenceId().toString()))).toList();
    }

    /** Called within publication, even for a quiet recheck. Missing data keeps the question open. */
    @Transactional
    public void reschedule(UUID owner, List<Due> due, LocalDate day) {
        mutations.lock(owner);
        for (var value : due) {
            var source = conferences.findByIdAndCreatedBy(value.sourceConferenceId(), owner).orElse(null);
            if (source == null || source.getFollowups() == null) continue;
            source.setFollowups(new CharacterFollowupsEnvelope(source.getFollowups().items().stream().map(item ->
                    item.id().equals(value.item().id()) && "WAITING".equals(item.status()) && !item.dueOn().isAfter(day)
                            ? new CharacterFollowupsEnvelope.Item(item.id(), item.sourceIndex(), item.kind(), item.expertKey(),
                                    item.question(), item.requiredEvidence(), day.plusDays(properties.recheckDays()), "WAITING", day, null)
                            : item).toList()));
            conferences.save(source);
        }
    }

    @Transactional
    public void markRevisited(UUID owner, List<Due> due, UUID conferenceId, LocalDate day) {
        mutations.lock(owner);
        for (var value : due) {
            var source = conferences.findByIdAndCreatedBy(value.sourceConferenceId(), owner).orElse(null);
            if (source == null || source.getFollowups() == null) continue;
            source.setFollowups(new CharacterFollowupsEnvelope(source.getFollowups().items().stream().map(item ->
                    item.id().equals(value.item().id()) && "WAITING".equals(item.status())
                            ? new CharacterFollowupsEnvelope.Item(item.id(), item.sourceIndex(), item.kind(), item.expertKey(),
                                    item.question(), item.requiredEvidence(), item.dueOn(), "REVISITED", day, conferenceId)
                            : item).toList()));
            conferences.save(source);
        }
    }

    @Transactional
    public void closeAnswered(UUID owner, UUID sourceId, int index, LocalDate day) {
        mutations.lock(owner);
        var source = conferences.findByIdAndCreatedBy(sourceId, owner).orElse(null);
        if (source == null || source.getFollowups() == null) return;
        source.setFollowups(new CharacterFollowupsEnvelope(source.getFollowups().items().stream().map(item ->
                item.sourceIndex() == index && "QUESTION".equals(item.kind()) && "WAITING".equals(item.status())
                        ? new CharacterFollowupsEnvelope.Item(item.id(), index, item.kind(), item.expertKey(), item.question(),
                                item.requiredEvidence(), item.dueOn(), "CLOSED", day, null) : item).toList()));
        conferences.save(source);
    }
}
