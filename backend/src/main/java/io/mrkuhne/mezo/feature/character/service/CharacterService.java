package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.api.dto.CharacterClaimDto;
import io.mrkuhne.mezo.api.dto.CharacterClaimDtoEvidenceInner;
import io.mrkuhne.mezo.api.dto.CharacterConferenceResponse;
import io.mrkuhne.mezo.api.dto.CharacterConferenceResponseChangesInner;
import io.mrkuhne.mezo.api.dto.CharacterConferenceSummary;
import io.mrkuhne.mezo.api.dto.CharacterDimensionResponse;
import io.mrkuhne.mezo.api.dto.CharacterDimensionSummary;
import io.mrkuhne.mezo.api.dto.CharacterExpertDto;
import io.mrkuhne.mezo.api.dto.CharacterExpertsResponse;
import io.mrkuhne.mezo.api.dto.CharacterFeedItem;
import io.mrkuhne.mezo.api.dto.CharacterOverviewResponse;
import io.mrkuhne.mezo.api.dto.CharacterRunObservation;
import io.mrkuhne.mezo.api.dto.CharacterRunObservationSignal;
import io.mrkuhne.mezo.api.dto.CharacterRunResponse;
import io.mrkuhne.mezo.api.dto.CharacterRunSummary;
import io.mrkuhne.mezo.api.dto.ConferenceTurn;
import io.mrkuhne.mezo.feature.character.entity.CharacterClaimEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterConferenceEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterDimensionEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterObservationEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterPortraitRevisionEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterRunEntity;
import io.mrkuhne.mezo.feature.character.entity.ConferenceOutcomeEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ObservationSignalsEnvelope;
import io.mrkuhne.mezo.feature.character.repository.CharacterClaimRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterConferenceRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterDimensionRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterObservationRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterPortraitRevisionRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterRunRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
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
    private static final String NIGHTLY = "NIGHTLY";
    private static final long RUN_RANGE_MAX_SPAN_DAYS = 62;

    private final CharacterDimensionRepository dimensionRepository;
    private final CharacterClaimRepository claimRepository;
    private final CharacterObservationRepository observationRepository;
    private final CharacterConferenceRepository conferenceRepository;
    private final CharacterPortraitRevisionRepository revisionRepository;
    private final CharacterRunRepository runRepository;

    /** Idempotent: inserts only the CORE + META catalog entries missing for this owner. Called by
     *  every read below so a first-ever GET always finds all 8 rows already there. */
    @Transactional
    public void ensureCoreDimensions(UUID owner) {
        Set<String> existingKeys = new HashSet<>();
        for (CharacterDimensionEntity dim : dimensionRepository.findByCreatedBy(owner)) {
            existingKeys.add(dim.getKey());
        }
        for (CharacterCoreCatalog.CoreDimension core : CharacterCoreCatalog.SEEDED) {
            if (existingKeys.contains(core.key())) {
                continue;
            }
            CharacterDimensionEntity dim = new CharacterDimensionEntity();
            dim.setCreatedBy(owner);
            dim.setKey(core.key());
            dim.setTitle(core.title());
            dim.setKind(CharacterCoreCatalog.kindOf(core.key()));
            dim.setExpertKey(core.expertKey());
            dimensionRepository.save(dim);
        }
    }

    /**
     * The Csapat-page persona catalog: the 7 {@link CharacterExpertCatalog} experts followed by
     * the Szkeptikus and Mezo — S3 round roles, deliberately kept out of
     * {@link CharacterExpertCatalog} itself (which stays expert-only, one-CORE-dimension-per-entry).
     * Composing the two extra static entries here (rather than growing the catalog with
     * non-expert rows) keeps that catalog's shape — and the {@code CharacterExpertCatalogTest}
     * pin on it — untouched. A pure static read: no DB, no LLM, character switch only.
     *
     * <p>The Szkeptikus/Mezo persocards in the prototype don't carry a distinct "role" text the
     * way expert cards do (a {@code pchip}); each card only has a {@code prole} (voice/manner)
     * line and a {@code pwatch} line. {@code role} is therefore set to the persona's identity
     * where the prototype offers one and otherwise mirrors {@code voiceLine} — no text is
     * invented, only reused verbatim. The Szkeptikus entry now derives from
     * {@link CharacterExpertCatalog#SKEPTIC} (round 4) and carries the META dimension key.
     */
    public CharacterExpertsResponse experts() {
        List<CharacterExpertDto> experts = new ArrayList<>();
        for (CharacterExpertCatalog.Expert e : CharacterExpertCatalog.EXPERTS) {
            experts.add(CharacterExpertDto.builder()
                    .key(e.key())
                    .displayName(e.displayName())
                    .role(e.role())
                    .voiceLine(e.voiceLine())
                    .watch(e.watch())
                    .dimensionKey(e.primaryDimensionKey())
                    .kind(CharacterExpertDto.KindEnum.EXPERT)
                    .build());
        }
        CharacterExpertCatalog.Expert skeptic = CharacterExpertCatalog.SKEPTIC;
        experts.add(CharacterExpertDto.builder()
                .key(skeptic.key())
                .displayName(skeptic.displayName())
                .role(skeptic.role())
                .voiceLine(skeptic.voiceLine())
                .watch(skeptic.watch())
                .dimensionKey(skeptic.primaryDimensionKey())
                .kind(CharacterExpertDto.KindEnum.SKEPTIC)
                .build());
        experts.add(CharacterExpertDto.builder()
                .key("mezo")
                .displayName("Mezo")
                .role("Elnök · Integrátor")
                .voiceLine("Elnök · Integrátor")
                .watch(List.of("ő összegez feléd — a csapat az ő fejében dolgozik."))
                .dimensionKey(null)
                .kind(CharacterExpertDto.KindEnum.CHAIR)
                .build());
        return CharacterExpertsResponse.builder().experts(experts).build();
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
        if (CharacterCoreCatalog.KIND_META.equals(dim.getKind())) {
            return CharacterCoreCatalog.CORE.size();
        }
        return CharacterCoreCatalog.CORE.size() + 1;
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
                    .dimensionKeys(obs.getDimensionKeys().keys())
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

    /**
     * The run timeline over an inclusive {@code [from, to]} day window (Gépterem, mezo-1gim.14),
     * newest day first — {@code []} is the honest empty answer, never a 404. {@code to < from} or
     * a span over {@value #RUN_RANGE_MAX_SPAN_DAYS} days is a client error: the read is a bounded
     * window, not a full-history dump.
     */
    @Transactional(readOnly = true)
    public List<CharacterRunSummary> runs(UUID owner, LocalDate from, LocalDate to) {
        if (to.isBefore(from)) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("CHARACTER_RUN_RANGE_INVALID").build(), HttpStatus.BAD_REQUEST);
        }
        long spanDays = ChronoUnit.DAYS.between(from, to) + 1; // inclusive
        if (spanDays > RUN_RANGE_MAX_SPAN_DAYS) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("CHARACTER_RUN_RANGE_INVALID").build(), HttpStatus.BAD_REQUEST);
        }
        return runRepository.findByCreatedByAndDayBetweenOrderByDayDescGeneratedAtDesc(owner, from, to)
                .stream().map(this::toRunSummary).toList();
    }

    /**
     * One run's full detail: its summary plus the observations it resolved from. A NIGHTLY row
     * resolves by {@code (owner, day)}; a WEEKLY/MONTHLY/BOOTSTRAP row resolves by the conference
     * it fed ({@code consumedByConferenceId}) — the same split the writers themselves observe
     * (Karakter S9 spec §3).
     *
     * <p>The NIGHTLY {@code (owner, day)} resolution deliberately EXCLUDES
     * {@link CharacterFeedbackService#USER_EXPERT_KEY} observations (final review, mezo-1gim.14,
     * M5): Daniel's own claim-feedback observations share the same {@code day} as that night's
     * pipeline output (they're written whenever he answers, not scoped to a run), but they were
     * never produced by the nightly job — they belong to the konzílium flow, which consumes them
     * later. Counting or listing them here would misattribute Daniel's own words to the nightly
     * pipeline's output. The alternative (including them but adding a separate counted field) was
     * rejected: the honest fix is to keep the NIGHTLY run detail scoped to what the nightly job
     * itself actually wrote.
     */
    @Transactional(readOnly = true)
    public CharacterRunResponse run(UUID owner, UUID runId) {
        CharacterRunEntity run = runRepository.findByIdAndCreatedBy(runId, owner)
                .orElseThrow(() -> new SystemRuntimeErrorException(
                        SystemMessage.error("CHARACTER_RUN_NOT_FOUND").build(), HttpStatus.NOT_FOUND));

        List<CharacterObservationEntity> observations = NIGHTLY.equals(run.getKind())
                ? observationRepository.findByCreatedByAndDayAndExpertKeyNotOrderByCreatedAtAsc(
                        owner, run.getDay(), CharacterFeedbackService.USER_EXPERT_KEY)
                : run.getConferenceId() == null
                        ? List.of()
                        : observationRepository.findByCreatedByAndConsumedByConferenceIdOrderByDayAscCreatedAtAsc(
                                owner, run.getConferenceId());

        return CharacterRunResponse.builder()
                .summary(toRunSummary(run))
                .observations(observations.stream().map(this::toRunObservation).toList())
                .build();
    }

    private CharacterRunSummary toRunSummary(CharacterRunEntity run) {
        return CharacterRunSummary.builder()
                .id(run.getId())
                .kind(CharacterRunSummary.KindEnum.fromValue(run.getKind()))
                .day(run.getDay())
                .observationCount(run.getObservationCount())
                .callCount(run.getCallCount())
                .detectorKeys(run.getDetectorKeys().keys())
                .expertKeys(run.getExpertKeys().keys())
                .conferenceId(run.getConferenceId())
                .build();
    }

    private CharacterRunObservation toRunObservation(CharacterObservationEntity obs) {
        List<CharacterRunObservationSignal> signals = obs.getSignals().signals().stream()
                .map(this::toRunObservationSignal)
                .toList();
        return CharacterRunObservation.builder()
                .id(obs.getId())
                .expertKey(obs.getExpertKey())
                .dimensionKeys(obs.getDimensionKeys().keys())
                .text(obs.getText())
                .salience(obs.getSalience().intValue())
                .signals(signals)
                .build();
    }

    private CharacterRunObservationSignal toRunObservationSignal(ObservationSignalsEnvelope.Signal signal) {
        return CharacterRunObservationSignal.builder()
                .detectorKey(signal.detectorKey())
                .summary(signal.summary())
                .refCount(signal.refIds().size())
                .build();
    }

    /** Entity→DTO mapping for one claim — also called by {@code CharacterController} to render
     *  the row {@link io.mrkuhne.mezo.feature.character.service.CharacterFeedbackService#apply}
     *  hands back (mezo-1gim.10), so it stays reused rather than duplicated. */
    public CharacterClaimDto toClaimDto(CharacterClaimEntity claim) {
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
