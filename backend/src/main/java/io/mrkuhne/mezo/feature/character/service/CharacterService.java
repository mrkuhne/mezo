package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.api.dto.CharacterClaimDto;
import io.mrkuhne.mezo.api.dto.CharacterClaimDtoEvidenceInner;
import io.mrkuhne.mezo.api.dto.CharacterConferenceResponse;
import io.mrkuhne.mezo.api.dto.CharacterConferenceResponseChangesInner;
import io.mrkuhne.mezo.api.dto.CharacterConferenceSummary;
import io.mrkuhne.mezo.api.dto.CharacterDimensionResponse;
import io.mrkuhne.mezo.api.dto.CharacterDimensionSummary;
import io.mrkuhne.mezo.api.dto.CharacterFeedItem;
import io.mrkuhne.mezo.api.dto.CharacterOverviewResponse;
import io.mrkuhne.mezo.api.dto.ConferenceTurn;
import io.mrkuhne.mezo.feature.character.entity.CharacterClaimEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterConferenceEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterDimensionEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterObservationEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterPortraitRevisionEntity;
import io.mrkuhne.mezo.feature.character.entity.ConferenceOutcomeEnvelope;
import io.mrkuhne.mezo.feature.character.repository.CharacterClaimRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterConferenceRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterDimensionRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterObservationRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterPortraitRevisionRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Karakter dossier reads (mezo-1gim slice 1, spec §2–§6): lazy CORE-dimension seeding, dossier
 * overview, one dimension in full, the merged feed, and konzílium reads. Mapping stays inline
 * here — five small entity→DTO mappers don't yet warrant a MapStruct class (proactive mapper
 * precedent applies once the surface grows in Slice 3+).
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class CharacterService {

    private static final int TOP_CLAIMS_CAP = 3;
    private static final int REVISIONS_CAP = 10;
    private static final String ACTIVE = "ACTIVE";

    private final CharacterDimensionRepository dimensionRepository;
    private final CharacterClaimRepository claimRepository;
    private final CharacterObservationRepository observationRepository;
    private final CharacterConferenceRepository conferenceRepository;
    private final CharacterPortraitRevisionRepository revisionRepository;

    /** Idempotent: inserts only the CORE catalog entries missing for this owner. Called by every
     *  read below so a first-ever GET always finds all 7 CORE rows already there. */
    @Transactional
    public void ensureCoreDimensions(UUID owner) {
        Set<String> existingKeys = new HashSet<>();
        for (CharacterDimensionEntity dim : dimensionRepository.findByCreatedBy(owner)) {
            existingKeys.add(dim.getKey());
        }
        for (CharacterCoreCatalog.CoreDimension core : CharacterCoreCatalog.CORE) {
            if (existingKeys.contains(core.key())) {
                continue;
            }
            CharacterDimensionEntity dim = new CharacterDimensionEntity();
            dim.setCreatedBy(owner);
            dim.setKey(core.key());
            dim.setTitle(core.title());
            dim.setKind("CORE");
            dim.setExpertKey(core.expertKey());
            dimensionRepository.save(dim);
        }
    }

    @Transactional
    public CharacterOverviewResponse overview(UUID owner) {
        ensureCoreDimensions(owner);
        List<CharacterDimensionEntity> dims = new ArrayList<>(dimensionRepository.findByCreatedBy(owner));
        dims.sort(Comparator.comparingInt(this::displayOrder)
                .thenComparing(CharacterDimensionEntity::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder())));

        List<CharacterDimensionSummary> summaries = new ArrayList<>();
        for (CharacterDimensionEntity dim : dims) {
            List<CharacterClaimEntity> topClaims = claimRepository
                    .findByCreatedByAndDimensionIdAndStatusOrderByConfidenceDesc(owner, dim.getId(), ACTIVE)
                    .stream().limit(TOP_CLAIMS_CAP).toList();
            summaries.add(CharacterDimensionSummary.builder()
                    .key(dim.getKey())
                    .title(dim.getTitle())
                    .kind(CharacterDimensionSummary.KindEnum.fromValue(dim.getKind()))
                    .expertKey(dim.getExpertKey())
                    .maturity(dim.getMaturity().intValue())
                    .portrait(dim.getPortrait())
                    .topClaims(topClaims.stream().map(this::toClaimDto).toList())
                    .build());
        }
        return CharacterOverviewResponse.builder().dimensions(summaries).build();
    }

    /** CORE rows sort by their fixed catalog index; CHAPTER rows sort after all CORE rows, by
     *  {@code createdAt} (the UI's chronological order). */
    private int displayOrder(CharacterDimensionEntity dim) {
        for (int i = 0; i < CharacterCoreCatalog.CORE.size(); i++) {
            if (CharacterCoreCatalog.CORE.get(i).key().equals(dim.getKey())) {
                return i;
            }
        }
        return CharacterCoreCatalog.CORE.size();
    }

    @Transactional
    public CharacterDimensionResponse dimension(UUID owner, String key) {
        ensureCoreDimensions(owner);
        CharacterDimensionEntity dim = dimensionRepository.findByCreatedByAndKey(owner, key)
                .orElseThrow(() -> new SystemRuntimeErrorException(
                        SystemMessage.error("CHARACTER_DIMENSION_NOT_FOUND").build(), HttpStatus.NOT_FOUND));

        List<CharacterClaimEntity> claims = claimRepository
                .findByCreatedByAndDimensionIdAndStatusOrderByConfidenceDesc(owner, dim.getId(), ACTIVE);
        List<CharacterPortraitRevisionEntity> revisions = revisionRepository
                .findByCreatedByAndDimensionIdOrderByVersionDesc(owner, dim.getId())
                .stream().limit(REVISIONS_CAP).toList();

        return CharacterDimensionResponse.builder()
                .key(dim.getKey())
                .title(dim.getTitle())
                .kind(CharacterDimensionResponse.KindEnum.fromValue(dim.getKind()))
                .expertKey(dim.getExpertKey())
                .maturity(dim.getMaturity().intValue())
                .portrait(dim.getPortrait())
                .claims(claims.stream().map(this::toClaimDto).toList())
                .revisions(revisions.stream().map(this::toRevisionDto).toList())
                .build();
    }

    @Transactional(readOnly = true)
    public List<CharacterFeedItem> feed(UUID owner, int limit) {
        List<CharacterFeedItem> items = new ArrayList<>();

        for (CharacterObservationEntity obs : observationRepository
                .findByCreatedByOrderByDayDescCreatedAtDesc(owner, PageRequest.of(0, limit))) {
            items.add(CharacterFeedItem.builder()
                    .kind(CharacterFeedItem.KindEnum.OBSERVATION)
                    .at(toOffset(obs.getCreatedAt()))
                    .expertKey(obs.getExpertKey())
                    .dimensionKeys(obs.getDimensionKeys())
                    .text(obs.getText())
                    .build());
        }

        conferenceRepository.findFirstByCreatedByOrderByGeneratedAtDesc(owner).ifPresent(conf -> {
            for (ConferenceOutcomeEnvelope.Change change : conf.getOutcome().changes()) {
                items.add(CharacterFeedItem.builder()
                        .kind(CharacterFeedItem.KindEnum.CONFERENCE_CHANGE)
                        .at(toOffset(conf.getGeneratedAt()))
                        .expertKey(null)
                        .dimensionKeys(change.dimensionKey() != null ? List.of(change.dimensionKey()) : List.of())
                        .text(change.summary())
                        .build());
            }
        });

        items.sort(Comparator.comparing(CharacterFeedItem::getAt).reversed());
        return items.size() > limit ? items.subList(0, limit) : items;
    }

    @Transactional(readOnly = true)
    public List<CharacterConferenceSummary> conferences(UUID owner) {
        return conferenceRepository.findByCreatedByOrderByGeneratedAtDesc(owner).stream()
                .map(summary -> CharacterConferenceSummary.builder()
                        .id(summary.getId())
                        .kind(CharacterConferenceSummary.KindEnum.fromValue(summary.getKind()))
                        .weekStart(summary.getWeekStart())
                        .generatedAt(toOffset(summary.getGeneratedAt()))
                        .build())
                .toList();
    }

    @Transactional(readOnly = true)
    public CharacterConferenceResponse conference(UUID owner, UUID id) {
        CharacterConferenceEntity conf = conferenceRepository.findByIdAndCreatedBy(id, owner)
                .orElseThrow(() -> new SystemRuntimeErrorException(
                        SystemMessage.error("CHARACTER_CONFERENCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));

        List<ConferenceTurn> transcript = conf.getTranscript().turns().stream()
                .map(turn -> ConferenceTurn.builder()
                        .persona(turn.persona())
                        .text(turn.text())
                        .refIds(turn.refIds())
                        .build())
                .toList();
        List<CharacterConferenceResponseChangesInner> changes = conf.getOutcome().changes().stream()
                .map(change -> CharacterConferenceResponseChangesInner.builder()
                        .kind(change.kind())
                        .dimensionKey(change.dimensionKey())
                        .summary(change.summary())
                        .build())
                .toList();

        return CharacterConferenceResponse.builder()
                .id(conf.getId())
                .kind(CharacterConferenceResponse.KindEnum.fromValue(conf.getKind()))
                .weekStart(conf.getWeekStart())
                .generatedAt(toOffset(conf.getGeneratedAt()))
                .transcript(transcript)
                .changes(changes)
                .build();
    }

    private CharacterClaimDto toClaimDto(CharacterClaimEntity claim) {
        List<CharacterClaimDtoEvidenceInner> evidence = claim.getEvidence().refs().stream()
                .map(ref -> CharacterClaimDtoEvidenceInner.builder()
                        .kind(ref.kind())
                        .id(ref.id())
                        .label(ref.label())
                        .build())
                .toList();
        return CharacterClaimDto.builder()
                .id(claim.getId())
                .text(claim.getText())
                .confidence(claim.getConfidence())
                .sensitive(claim.getSensitive())
                .proposedBy(claim.getProposedBy())
                .evidence(evidence)
                .build();
    }

    private io.mrkuhne.mezo.api.dto.CharacterPortraitRevisionDto toRevisionDto(CharacterPortraitRevisionEntity rev) {
        return io.mrkuhne.mezo.api.dto.CharacterPortraitRevisionDto.builder()
                .version(rev.getVersion())
                .portrait(rev.getPortrait())
                .createdAt(toOffset(rev.getCreatedAt()))
                .build();
    }

    private static OffsetDateTime toOffset(Instant instant) {
        return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
    }
}
