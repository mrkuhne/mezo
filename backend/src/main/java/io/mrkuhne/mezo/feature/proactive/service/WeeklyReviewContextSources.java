package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.api.dto.LifeGoalTodaySummary;
import io.mrkuhne.mezo.api.dto.PillarDayStatus;
import io.mrkuhne.mezo.api.dto.TrendArrow;
import io.mrkuhne.mezo.feature.companion.entity.PeriodSummaryEntity;
import io.mrkuhne.mezo.feature.companion.repository.PeriodSummaryRepository;
import io.mrkuhne.mezo.feature.journal.entity.DecisionEntryEntity;
import io.mrkuhne.mezo.feature.journal.entity.JournalEntryEntity;
import io.mrkuhne.mezo.feature.journal.repository.DecisionEntryRepository;
import io.mrkuhne.mezo.feature.journal.repository.JournalEntryRepository;
import io.mrkuhne.mezo.feature.lifegoal.service.LifeGoalProgressService;
import io.mrkuhne.mezo.feature.medication.entity.MedicationEntity;
import io.mrkuhne.mezo.feature.medication.repository.MedicationRepository;
import io.mrkuhne.mezo.feature.medication.service.MedicationCycleService;
import io.mrkuhne.mezo.feature.medication.service.dto.MedicationCycle;
import io.mrkuhne.mezo.feature.people.entity.MentionEntity;
import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import io.mrkuhne.mezo.feature.people.repository.MentionRepository;
import io.mrkuhne.mezo.feature.people.repository.PersonRepository;
import io.mrkuhne.mezo.feature.proactive.entity.ExperimentEntity;
import io.mrkuhne.mezo.feature.proactive.repository.ExperimentRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * The weekly review's WIDER gather input (bd mezo-d20.7.8, handoff §6.4 item D) — the sources the
 * design spec listed and the first cut dropped: journal entries, decisions, running N=1
 * experiments, people mentions, the medication cycle, and the week's {@code period_summary}
 * narrative. Split out of {@link WeeklyReviewGenerator} so the generator's constructor stays
 * readable and so every NEW cross-feature import this slice adds sits in ONE auditable place.
 *
 * <p><b>Code-collected, model-selected — unchanged.</b> Every section below is a rendered FACT
 * block; not one of them asks the model a question or hands it a judgement to make. The prompt is
 * byte-identical to before this slice ({@code "KIZÁRÓLAG a megadott adatokból"} already governs
 * whatever the gather renders, and the standing {@code "gyógyszer-adagolást érintő javaslat
 * tilos"} line becomes load-bearing now that the cycle is actually in the payload).
 *
 * <p><b>The prompt has a budget.</b> More context is not free, so each source is rendered at the
 * COARSEST granularity that still carries its signal, and every list is capped:
 * <ul>
 *   <li><b>Journal</b> — the one source that earns full prose, clipped to {@value #JOURNAL_CLIP}
 *       chars (roughly the opening sentences) and capped at {@value #MAX_JOURNAL} entries, so one
 *       long entry cannot dominate the week.</li>
 *   <li><b>Decisions</b> — the decision line only, clipped to {@value #DECISION_CLIP}; a decision
 *       REVIEWED in the week also carries its 1–5 rating. The {@code contextSnapshot} is
 *       deliberately NOT rendered: it is a machine snapshot of the day's metrics, which the day
 *       lines above already say better.</li>
 *   <li><b>Experiments</b> — title + status + the window position; the hypothesis prose is cut
 *       (the title states it, and P2 titles are {@code varchar(200)} of exactly that).</li>
 *   <li><b>Mentions</b> — a COUNT per person, nothing else. The excerpts are short, numerous and
 *       affect-laden; at a week's volume they read as noise, and they would drag third parties'
 *       words into a prompt about Daniel. "Who did the week happen around, and how often" is the
 *       signal; the quotes are not.</li>
 *   <li><b>Medication cycle</b> — TWO derived positions (the week's first and last day), one
 *       line, no dose ledger.</li>
 *   <li><b>Week narrative</b> — the consolidated {@code period_summary(week)} row, clipped to
 *       {@value #NARRATIVE_CLIP}. Its cron ({@code 03:30 MON}) runs three hours before the review
 *       cron ({@code 06:50 MON}) on the SAME {@code weekStart}, so by review time the rung for the
 *       reviewed week is already there.</li>
 * </ul>
 * Worst case the whole block is ~3 kB of text; a typical week is a fraction of that.
 *
 * <p><b>Left out on purpose:</b> gratitude entries (a fixed three-a-day ritual list — high volume,
 * near-zero week-to-week variance), {@code daily_summary} narratives (the week's
 * {@code period_summary} IS their consolidation — rendering both is the same week twice), mention
 * excerpts/tone and the owner-curated person prose ({@code knownFacts}/{@code notes} are not
 * week-scoped), the medication dose ledger (the cycle position already encodes it), and
 * {@code proposed} experiments (a proposal is not something that ran through the week).
 *
 * <p><b>Honesty.</b> A section is appended only when it has rows — an absent source leaves NO
 * scaffolding in the payload. Nothing is inferred: an unknown cycle position or an ungraded review
 * renders the house {@code –}, never a fabricated number, and a clipped text carries an explicit
 * {@code …} so the model never reads a cut sentence as a finished one.
 *
 * <p><b>Cycle check (ADR 0012 / {@code ArchitectureTest#feature_slices_are_cycle_free}).</b> Three
 * of these edges are new: {@code proactive → journal}, {@code proactive → people},
 * {@code proactive → medication}. All three point into slices with NO path back to proactive
 * (journal and medication import no other feature at all; people imports {@code auth} and
 * {@code goal}, and {@code goal} imports {@code auth}/{@code biometrics}/{@code train} — none of
 * which import proactive; the ONLY feature that imports proactive today is {@code notification}).
 * A consumer-owned port is therefore NOT warranted here: ADR 0012 prescribes it where the direct
 * edge would close a cycle, and {@code CheckInNoteSourceAdapter}'s javadoc is the standing
 * precedent for the other half of that rule — a plain read is preferred when the direction is
 * already safe. {@code proactive → companion} (period_summary) and the experiment read are not
 * new edges at all. {@code ArchitectureTest} is run explicitly for this change.
 *
 * <p><b>mezo-iizd.9 — the life-goal edge, and why it is a DIRECT read here.</b> {@code companion}
 * may NOT import {@code lifegoal}: {@code lifegoal} already imports {@code companion}
 * ({@code MetricSeriesService}, {@code LifeGoalProposePort}), so the reverse edge would close a
 * cycle that {@code ArchitectureTest#feature_slices_are_cycle_free} catches. The weekly review,
 * however, lives in {@code feature/proactive}, which already reads journal/medication/people
 * directly (above), and {@code lifegoal} imports NO proactive class — so {@code proactive →
 * lifegoal} is one-directional and precedent-following. No port/adapter is introduced here; the
 * companion-side {@code [Célok]} block, whose direction genuinely IS cycle-closing, gets its
 * {@code LifeGoalSource} port in mezo-iizd.10.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class WeeklyReviewContextSources {

    /** One entry per day of the week is the natural ceiling; beyond that it is a journalling spree. */
    static final int MAX_JOURNAL = 7;
    /** Prose clip — roughly the opening sentences of an entry. */
    static final int JOURNAL_CLIP = 180;
    /** Decisions made + decisions reviewed, combined. */
    static final int MAX_DECISIONS = 6;
    static final int DECISION_CLIP = 140;
    /** More overlapping experiments than this is not a week's worth of signal. */
    static final int MAX_EXPERIMENTS = 5;
    /** The inner circle a week actually touches. */
    static final int MAX_PEOPLE = 5;
    static final int NARRATIVE_CLIP = 600;
    /** More active life goals than this is not a week the model can hold apart. */
    static final int MAX_LIFE_GOALS = 5;
    /**
     * What a goal with no measured day says INSTEAD of a tally — the frontend's rule, mirrored
     * ({@code goalWeekSentence.ts}: "Ezen a héten még nincs adata."). "0 találat-nap" would read
     * as a measured miss and invite the model to explain a zero nobody measured.
     */
    static final String NO_DATA_PHRASE = "ezen a héten még nincs adata";

    private final JournalEntryRepository journalEntryRepository;
    private final DecisionEntryRepository decisionEntryRepository;
    private final ExperimentRepository experimentRepository;
    private final MentionRepository mentionRepository;
    private final PersonRepository personRepository;
    private final MedicationRepository medicationRepository;
    private final MedicationCycleService medicationCycleService;
    private final PeriodSummaryRepository periodSummaryRepository;
    /**
     * Cycle-free DIRECT read ({@code lifegoal} imports no proactive class — see the class javadoc);
     * the companion direction needs a port instead, which is mezo-iizd.10. Held through an
     * {@link ObjectProvider} because {@code LifeGoalProgressService} hangs off
     * {@link FeaturesConfiguration#LIFEGOAL_SWITCH}, which this bean's own
     * companion+proactive condition does NOT imply: a hard field would turn "life goals off" into a
     * context-startup failure. Absent bean ⇒ no section, exactly like an empty source.
     */
    private final ObjectProvider<LifeGoalProgressService> lifeGoalProgressService;

    /**
     * The wider-context block for {@code [weekStart, weekEnd]}, or an EMPTY string when not one of
     * the six sources has anything to say (the caller appends it verbatim, so "nothing" must cost
     * nothing). {@code since}/{@code until} are {@code WeeklyReviewWeekWindow}'s instant bounds,
     * passed in so the timestamped sources share the generator's ONE window definition.
     */
    public String render(UUID userId, LocalDate weekStart, LocalDate weekEnd, Instant since, Instant until) {
        StringBuilder out = new StringBuilder();
        appendJournal(out, userId, weekStart, weekEnd);
        appendDecisions(out, userId, weekStart, weekEnd, since, until);
        appendExperiments(out, userId, weekStart, weekEnd);
        appendMentions(out, userId, since, until);
        appendMedicationCycle(out, userId, weekStart, weekEnd);
        appendWeekNarrative(out, userId, weekStart);
        appendLifeGoals(out, userId);
        return out.toString();
    }

    private void appendJournal(StringBuilder out, UUID userId, LocalDate weekStart, LocalDate weekEnd) {
        List<JournalEntryEntity> entries = new ArrayList<>(journalEntryRepository
                .findByCreatedByAndOccurredOnBetweenAndDeletedFalseOrderByOccurredOnDescCreatedAtDesc(
                        userId, weekStart, weekEnd));
        if (entries.isEmpty()) {
            return;
        }
        // the finder is newest-first (it backs a reverse-chronological list UI); the week reads
        // forwards here, so sort before capping.
        entries.sort(Comparator.comparing(JournalEntryEntity::getOccurredOn));
        out.append("\nNAPLÓBEJEGYZÉSEK:\n");
        for (JournalEntryEntity entry : entries.subList(0, Math.min(entries.size(), MAX_JOURNAL))) {
            out.append("- ").append(entry.getOccurredOn()).append(": ")
                    .append(clip(entry.getText(), JOURNAL_CLIP)).append('\n');
        }
    }

    private void appendDecisions(StringBuilder out, UUID userId, LocalDate weekStart, LocalDate weekEnd,
            Instant since, Instant until) {
        List<String> lines = new ArrayList<>();
        for (DecisionEntryEntity decision : decisionEntryRepository
                .findByCreatedByAndDecidedOnBetweenAndDeletedFalseOrderByDecidedOnAsc(userId, weekStart, weekEnd)) {
            lines.add("- meghozva " + decision.getDecidedOn() + ": "
                    + clip(decision.getDecisionText(), DECISION_CLIP));
        }
        for (DecisionEntryEntity decision : decisionEntryRepository
                .findByCreatedByAndReviewedAtGreaterThanEqualAndReviewedAtLessThanAndDeletedFalseOrderByReviewedAtAsc(
                        userId, since.plusSeconds(1), until)) {
            // the rating is null until the user gives one — an ungraded review says so, it does
            // not borrow a number from anywhere
            String rating = decision.getOutcomeRating() != null ? decision.getOutcomeRating() + "/5" : "–";
            lines.add("- értékelve " + decision.getDecidedOn() + " (" + rating + "): "
                    + clip(decision.getDecisionText(), DECISION_CLIP));
        }
        if (lines.isEmpty()) {
            return;
        }
        out.append("\nDÖNTÉSEK:\n");
        for (String line : lines.subList(0, Math.min(lines.size(), MAX_DECISIONS))) {
            out.append(line).append('\n');
        }
    }

    private void appendExperiments(StringBuilder out, UUID userId, LocalDate weekStart, LocalDate weekEnd) {
        List<ExperimentEntity> running = experimentRepository
                .findByCreatedByAndStatusInOrderByGeneratedAtDesc(userId,
                        List.of(ExperimentEntity.STATUS_ACTIVE, ExperimentEntity.STATUS_COMPLETED))
                .stream()
                .filter(e -> overlapsWeek(e, weekStart, weekEnd))
                .limit(MAX_EXPERIMENTS)
                .toList();
        if (running.isEmpty()) {
            return;
        }
        out.append("\nKÍSÉRLETEK A HÉTEN:\n");
        for (ExperimentEntity experiment : running) {
            out.append("- ").append(experiment.getTitle()).append(" [").append(experiment.getStatus());
            if (ExperimentEntity.STATUS_COMPLETED.equals(experiment.getStatus())) {
                // outcomeGood stays null when the window had no data — the honest "inconclusive"
                Boolean good = experiment.getOutcomeGood();
                out.append(", ").append(good == null ? "nem eldönthető" : good ? "bevált" : "nem vált be");
            } else {
                long day = ChronoUnit.DAYS.between(experiment.getStartDate(), weekEnd) + 1;
                out.append(", ").append(Math.min(day, experiment.getTotalDays()))
                        .append('/').append(experiment.getTotalDays()).append(". nap");
            }
            out.append("]\n");
        }
    }

    /** An experiment RAN through the week when its {@code [startDate, startDate+totalDays)} window
     *  intersects it. No start date (a never-accepted proposal) means it never ran. */
    private static boolean overlapsWeek(ExperimentEntity experiment, LocalDate weekStart, LocalDate weekEnd) {
        LocalDate start = experiment.getStartDate();
        if (start == null) {
            return false;
        }
        LocalDate end = start.plusDays(experiment.getTotalDays() - 1L);
        return !start.isAfter(weekEnd) && !end.isBefore(weekStart);
    }

    private void appendMentions(StringBuilder out, UUID userId, Instant since, Instant until) {
        List<MentionEntity> mentions = mentionRepository
                .findByCreatedByAndTsGreaterThanEqualAndTsLessThanAndDeletedFalse(
                        userId, since.plusSeconds(1), until);
        if (mentions.isEmpty()) {
            return;
        }
        Map<UUID, Integer> counts = new LinkedHashMap<>();
        for (MentionEntity mention : mentions) {
            counts.merge(mention.getPersonId(), 1, Integer::sum);
        }
        List<Map.Entry<UUID, Integer>> ranked = new ArrayList<>(counts.entrySet());
        ranked.sort(Comparator.comparing(Map.Entry<UUID, Integer>::getValue, Comparator.reverseOrder()));
        List<String> rows = new ArrayList<>();
        for (Map.Entry<UUID, Integer> entry : ranked) {
            Optional<PersonEntity> person =
                    personRepository.findByIdAndCreatedByAndDeletedFalse(entry.getKey(), userId);
            if (person.isEmpty()) {
                continue; // the person row is gone — a nameless count is not a fact worth rendering
            }
            rows.add("- " + person.get().getName() + ": " + entry.getValue() + " említés");
            if (rows.size() == MAX_PEOPLE) {
                break;
            }
        }
        if (rows.isEmpty()) {
            return;
        }
        out.append("\nEMBER-EMLÍTÉSEK A HÉTEN:\n");
        for (String row : rows) {
            out.append(row).append('\n');
        }
    }

    private void appendMedicationCycle(StringBuilder out, UUID userId, LocalDate weekStart, LocalDate weekEnd) {
        Optional<MedicationEntity> active = medicationRepository
                .findFirstByCreatedByAndActiveTrueAndDeletedFalse(userId);
        if (active.isEmpty()) {
            return;
        }
        MedicationEntity medication = active.get();
        MedicationCycle atEnd = medicationCycleService.derive(userId, medication, weekEnd);
        if (atEnd.cycleDay() == 0) {
            return; // no dose at or before the week's end — nothing is known, so nothing is said
        }
        MedicationCycle atStart = medicationCycleService.derive(userId, medication, weekStart);
        out.append("\nGYÓGYSZER-CIKLUS: ").append(medication.getName())
                .append(" — hét eleje: ").append(position(atStart))
                .append(" → hét vége: ").append(position(atEnd)).append('\n');
    }

    /** {@code "4. nap (Stabil)"}, or the house {@code –} when no dose anchors that day. */
    private static String position(MedicationCycle cycle) {
        return cycle.cycleDay() == 0 ? "–" : cycle.cycleDay() + ". nap (" + cycle.phaseLabel() + ")";
    }

    private void appendWeekNarrative(StringBuilder out, UUID userId, LocalDate weekStart) {
        periodSummaryRepository
                .findByCreatedByAndGranularityAndPeriodStart(
                        userId, PeriodSummaryEntity.GRANULARITY_WEEK, weekStart)
                .ifPresent(summary -> out.append("\nA HÉT KONSZOLIDÁLT NARRATÍVÁJA:\n")
                        .append(clip(summary.getSummaryText(), NARRATIVE_CLIP)).append('\n'));
    }

    /**
     * {@code ÉLETCÉLOK · AZ ELMÚLT 7 NAP} — the life-goal engine's ALREADY-COMPUTED trend
     * (mezo-iizd.9). Code collects, model explains: the arrow and the hit-day tally are both
     * derived facts, and the prompt explicitly FORBIDS recomputing them
     * ({@link WeeklyReviewGenerator}'s {@code PROMPT}).
     *
     * <p><b>The window is the TRAILING 7 DAYS as of render time — deliberately NOT the reviewed
     * week, and the header says so.</b> {@code LifeGoalProgressService#today(UUID)} builds its
     * {@code days7} over {@code [now-6, now]}, while the weekly cron fires Monday 06:50 for
     * {@code weekStart = previousOrSame(MONDAY).minusWeeks(1)}, i.e. {@code [D-7, D-1]}. The two
     * windows are one day apart: the reviewed Monday falls out and today (~7 hours old, so
     * essentially never a hit) falls in. Rather than let a "hét iránya" header quietly deflate the
     * tally by that one day, the section is LABELLED for the window it actually measures. The
     * arrow survives the shift intact — it is a 7-day vs 21-day mean comparison, to which one
     * boundary day is immaterial.
     *
     * <p><b>Why not a windowed source.</b> Rendering the reviewed week exactly would need a
     * {@code today(userId, from, to)} variant on the lifegoal service; that is a separate,
     * later issue, NOT a silent widening of this one. Until it exists, the honest label is the
     * fix — so the next reader does not rediscover the shift as a bug.
     *
     * <p>The same reasoning drops today's {@code pillarsHitToday / pillarsTotal} ratio: a
     * snapshot of THIS morning has no place in a retrospective about last week, and at 06:50 it
     * would read {@code 0 / N} in nearly every real run.
     *
     * <p>Only ACTIVE goals arrive — {@code today()} yields exactly those, under the same "evaluable"
     * definition the nightly engine uses, so a parked or closed goal can never leak into the prompt.
     * No goal ⇒ NO header: an empty section would still cost context and would tempt the model to
     * talk about the absence (the same rule every other source above follows).
     *
     * <p>The arrow is rendered as a WORD, not the glyph: {@code →} and {@code ↑} are easy for a
     * model to misread inside prose, "tartja" is not.
     *
     * <p><b>A goal with NO data-day gets an explicit no-data phrase, never a "0 találat-nap"
     * tally.</b> A zero there does not mean "missed every day", it means "we measured nothing" —
     * and a measured-looking zero is exactly the kind of fact the model would go on to explain.
     * This mirrors the frontend rule verbatim ({@code frontend/src/features/me/logic/
     * goalWeekSentence.ts}, which refuses the same sentence and says "Ezen a héten még nincs
     * adata."), so the same week never reads as a miss on one surface and as silence on the other.
     */
    private void appendLifeGoals(StringBuilder out, UUID userId) {
        LifeGoalProgressService progress = lifeGoalProgressService.getIfAvailable();
        if (progress == null) {
            return; // life goals switched off — nothing is known, so nothing is said
        }
        List<LifeGoalTodaySummary> goals = progress.today(userId).getGoals();
        if (goals == null || goals.isEmpty()) {
            return;
        }
        out.append("\nÉLETCÉLOK · AZ ELMÚLT 7 NAP (a motor számolta — magyarázd, ne számold újra):\n");
        for (LifeGoalTodaySummary goal : goals.subList(0, Math.min(goals.size(), MAX_LIFE_GOALS))) {
            List<PillarDayStatus> days = goal.getDays7() == null ? List.of() : goal.getDays7();
            long dataDays = days.stream().filter(status -> status != PillarDayStatus.NO_DATA).count();
            long hits = days.stream().filter(status -> status == PillarDayStatus.HIT).count();
            out.append("- ").append(goal.getTitle());
            if (goal.getDimension() != null) {
                out.append(" [").append(goal.getDimension()).append(']');
            }
            out.append(' ').append(arrowWord(goal.getArrow())).append(" · ")
                    .append(dataDays == 0 ? NO_DATA_PHRASE : hits + " találat-nap a 7-ből")
                    .append('\n');
        }
    }

    /** The arrow's Hungarian word — the glyph is misreadable inside prompt prose, the word is not. */
    private static String arrowWord(TrendArrow arrow) {
        if (arrow == null) {
            return "nincs irány";
        }
        return switch (arrow) {
            case UP -> "emelkedik";
            case FLAT -> "tartja";
            case DOWN -> "csúszik";
            case INSUFFICIENT -> "kevés adat az irányhoz";
        };
    }

    /** Hard clip with an explicit continuation mark — a cut sentence must LOOK cut. */
    private static String clip(String text, int maxLen) {
        if (text == null) {
            return "";
        }
        String collapsed = text.replaceAll("\\s+", " ").strip();
        return collapsed.length() <= maxLen ? collapsed : collapsed.substring(0, maxLen) + "…";
    }
}
