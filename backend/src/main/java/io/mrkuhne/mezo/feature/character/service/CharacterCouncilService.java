package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.feature.character.config.CharacterCouncilProperties;
import io.mrkuhne.mezo.feature.character.entity.*;
import io.mrkuhne.mezo.feature.character.repository.*;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Model work is outside database transactions; publication verifies the lease and source versions. */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = {FeaturesConfiguration.CHARACTER_SWITCH, FeaturesConfiguration.COMPANION_SWITCH}, havingValue = "true")
public class CharacterCouncilService {
    private final CharacterCouncilProcessing processing;
    private final CharacterCouncilBudget budget;
    private final CharacterFollowupService followups;
    private final CharacterMutationLock mutations;
    private final jakarta.persistence.EntityManager entityManager;
    private final CharacterCouncilProperties properties;
    private final CharacterObservationRepository observations;
    private final CharacterConferenceRepository conferences;
    private final CharacterClaimRepository claims;
    private final CharacterDimensionRepository dimensions;
    private final KonziliumProposalRound proposals;
    private final KonziliumCrossTalkRound discussion;
    private final KonziliumVerdictRound verdicts;
    private final KonziliumChapterResolver chapters;
    private final ClaimLifecycle lifecycle;
    private final CharacterCouncilEvidenceTools tools;
    private final ObjectProvider<CharacterCouncilService> self;

    public void run(UUID owner, LocalDate day) {
        var lease = processing.claim(owner, day);
        if (lease == null) return;
        try {
            budget.run(owner, false, () -> { prepare(lease); return null; });
        } catch (RuntimeException failure) {
            processing.failed(lease);
            throw failure;
        }
    }

    private void prepare(CharacterCouncilProcessing.Lease lease) {
            UUID owner = lease.owner();
            LocalDate day = lease.day();
            var input = observations.findPending(owner, day.minusDays(1),
                    org.springframework.data.domain.PageRequest.of(0, properties.maxTopics()));
            var due = followups.due(owner, day);
            if (input.isEmpty()) { self.getObject().quiet(lease, due); return; }
            var expected = new TreeMap<UUID, Instant>();
            claims.findByCreatedByAndStatusOrderByConfidenceDesc(owner, "ACTIVE")
                    .forEach(c -> expected.put(c.getId(), c.getUpdatedAt()));
            var proposed = proposals.runDaily(owner, day, input, followups.evidence(due));
            if (proposed.proposals().isEmpty()) {
                var checked = proposed.turns().stream().flatMap(turn -> turn.refIds().stream())
                        .collect(java.util.stream.Collectors.toSet());
                if (!input.stream().allMatch(source -> checked.contains(source.getId().toString()))) {
                    processing.failed(lease);
                    return;
                }
                io.mrkuhne.mezo.feature.llmlog.context.LlmCallQuota.capture().verify();
                self.getObject().publish(lease, input, expected, proposed.turns(),
                        new ConferenceDeliberationEnvelope(List.of()),
                        new KonziliumVerdictRound.Result(List.of(), List.of(), List.of(), List.of(), true), due);
                return;
            }
            var selected = proposed.proposals().stream().limit(properties.maxTopics()).toList();
            var session = tools.open(owner);
            String period = "Megfigyelési időszak: " + input.stream().map(CharacterObservationEntity::getDay)
                    .min(LocalDate::compareTo).orElseThrow() + " – "
                    + input.stream().map(CharacterObservationEntity::getDay).max(LocalDate::compareTo).orElseThrow();
            var discussed = discussion.runForPeriod(owner, period, selected, session);
            var result = verdicts.runForPeriod(owner, period, selected, discussed.reactions(), session);
            if (result.shownRulings().isEmpty()) { processing.failed(lease); return; }
            var turns = new ArrayList<>(proposed.turns()); turns.addAll(result.turns());
            var deliberation = DeliberationAssembler.assemble(selected, discussed.reactions(), result.verdicts(),
                    result.shownRulings(), chapters.resolve(owner, selected));
            io.mrkuhne.mezo.feature.llmlog.context.LlmCallQuota.capture().verify();
            self.getObject().publish(lease, input, expected, turns, deliberation, result, due);
    }

    @Transactional
    public void publish(CharacterCouncilProcessing.Lease lease, List<CharacterObservationEntity> input,
            Map<UUID, Instant> expected, List<ConferenceTranscriptEnvelope.Turn> turns,
            ConferenceDeliberationEnvelope deliberation, KonziliumVerdictRound.Result result,
            List<CharacterFollowupService.Due> due) {
        mutations.lock(lease.owner());
        if (!processing.owns(lease)) return;
        var currentIds = claims.findByCreatedByAndStatusOrderByConfidenceDesc(lease.owner(), "ACTIVE").stream()
                .map(CharacterClaimEntity::getId).collect(java.util.stream.Collectors.toSet());
        if (!currentIds.equals(expected.keySet())) throw changed();
        for (var entry : expected.entrySet()) {
            var current = claims.lockOwned(entry.getKey(), lease.owner()).orElse(null);
            if (current == null) throw changed();
            entityManager.refresh(current, jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
            if (!Objects.equals(current.getUpdatedAt(), entry.getValue())) throw changed();
        }
        for (var source : input) {
            var current = observations.findByIdAndCreatedBy(source.getId(), lease.owner()).orElseThrow(CharacterCouncilService::changed);
            if (current.getConsumedByConferenceId() != null || !Objects.equals(current.getText(), source.getText())) throw changed();
        }
        var conference = new CharacterConferenceEntity(); conference.setCreatedBy(lease.owner());
        conference.setKind("DAILY"); conference.setWeekStart(lease.day()); conference.setGeneratedAt(Instant.now());
        conference.setFollowups(result.followups());
        conference.setTranscript(new ConferenceTranscriptEnvelope(turns)); conference.setDeliberation(deliberation);
        conference.setOutcome(new ConferenceOutcomeEnvelope(List.of())); conferences.saveAndFlush(conference);
        var changes = new ArrayList<>(lifecycle.openChapters(lease.owner(), conference.getId(), result.chapters()));
        var applied = lifecycle.applyAndBind(lease.owner(), conference.getId(), result.rulings(), deliberation);
        changes.addAll(applied.changes());
        conference.setDeliberation(applied.deliberation());
        conference.setOutcome(new ConferenceOutcomeEnvelope(changes));
        // A stale portrait must never mask the freshly committed active claims. The next synthesis
        // can regenerate prose; prompt assembly already falls back to the current claim list.
        changes.stream().map(ConferenceOutcomeEnvelope.Change::dimensionKey).filter(Objects::nonNull).distinct()
                .forEach(key -> dimensions.findByCreatedByAndKey(lease.owner(), key).ifPresent(d -> {
                    d.setPortrait(""); d.setMaturity((short) 0); dimensions.save(d);
                }));
        for (var source : input) {
            // Only consume experts whose proposal made it into this persisted discussion.
            if (deliberation.threads().isEmpty() || deliberation.threads().stream().flatMap(t -> t.items().stream())
                    .anyMatch(i -> i.expertKey().equals(source.getExpertKey()))) {
                var current = observations.findByIdAndCreatedBy(source.getId(), lease.owner()).orElseThrow();
                current.setConsumedByConferenceId(conference.getId()); observations.save(current);
            }
        }
        if (deliberation.threads().isEmpty()) {
            followups.reschedule(lease.owner(), due, lease.day());
            processing.quiet(lease);
        } else {
            followups.markRevisited(lease.owner(), due, conference.getId(), lease.day());
            processing.completed(lease, conference.getId());
        }
    }

    @Transactional
    public void quiet(CharacterCouncilProcessing.Lease lease, List<CharacterFollowupService.Due> due) {
        mutations.lock(lease.owner());
        if (!processing.owns(lease)) return;
        followups.reschedule(lease.owner(), due, lease.day());
        processing.quiet(lease);
    }

    private static SystemRuntimeErrorException changed() {
        return new SystemRuntimeErrorException(SystemMessage.error("CHARACTER_REPLY_SOURCE_CHANGED").build());
    }
}
