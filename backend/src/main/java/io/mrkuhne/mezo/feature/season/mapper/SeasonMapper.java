package io.mrkuhne.mezo.feature.season.mapper;

import io.mrkuhne.mezo.api.dto.SeasonAdherence;
import io.mrkuhne.mezo.api.dto.SeasonAdherenceDay;
import io.mrkuhne.mezo.api.dto.SeasonAdherenceSession;
import io.mrkuhne.mezo.api.dto.SeasonAdherenceResponse;
import io.mrkuhne.mezo.api.dto.SeasonBand;
import io.mrkuhne.mezo.api.dto.SeasonBlockChoice;
import io.mrkuhne.mezo.api.dto.SeasonDraft;
import io.mrkuhne.mezo.api.dto.SeasonNumbers;
import io.mrkuhne.mezo.api.dto.SeasonPreview;
import io.mrkuhne.mezo.api.dto.SeasonResponse;
import io.mrkuhne.mezo.api.dto.SeasonRules;
import io.mrkuhne.mezo.api.dto.SeasonSleepAnchor;
import io.mrkuhne.mezo.api.dto.SeasonSportSlot;
import io.mrkuhne.mezo.api.dto.SeasonTodo;
import io.mrkuhne.mezo.api.dto.SeasonWarning;
import io.mrkuhne.mezo.feature.season.entity.SeasonDraftJson;
import io.mrkuhne.mezo.feature.season.entity.SeasonEntity;
import io.mrkuhne.mezo.feature.season.entity.SeasonNumbersJson;
import io.mrkuhne.mezo.feature.season.service.AdherenceService;
import io.mrkuhne.mezo.feature.season.service.SeasonPreviewService;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Component;

/** Contract DTO ↔ season domain records (hand-written: the draft is a jsonb record, not an entity). */
@Component
public class SeasonMapper {

    public SeasonDraftJson fromDto(SeasonDraft d) {
        return new SeasonDraftJson(d.getTitle(), d.getTrajectory().getValue(), d.getTargetWeightKg(),
            d.getRatePctPerWeek(), d.getKgPerWeek(), d.getStartDate(), d.getWeeks(),
            d.getGymDays() == null ? List.of() : d.getGymDays().stream().distinct().sorted().toList(),
            d.getGymTime(),
            d.getSport() == null ? List.of() : d.getSport().stream()
                .map(s -> new SeasonDraftJson.SportSlot(s.getDayOfWeek(), s.getTime(), s.getDurationMin(), s.getSport()))
                .toList(),
            d.getSleepAnchor() == null ? null
                : new SeasonDraftJson.SleepAnchor(d.getSleepAnchor().getAnchor().getValue(), d.getSleepAnchor().getTime()),
            d.getAllowedRecipeIds() == null ? List.of() : List.copyOf(d.getAllowedRecipeIds()),
            d.getBlock() == null ? null : new SeasonDraftJson.Block(d.getBlock().getSource().getValue(),
                d.getBlock().getMesocycleId(), d.getBlock().getTemplateId()));
    }

    public SeasonDraft toDto(SeasonDraftJson j) {
        if (j == null) {
            return null;
        }
        return SeasonDraft.builder()
            .title(j.title())
            .trajectory(SeasonDraft.TrajectoryEnum.fromValue(j.trajectory()))
            .targetWeightKg(j.targetWeightKg())
            .ratePctPerWeek(j.ratePctPerWeek())
            .kgPerWeek(j.kgPerWeek())
            .startDate(j.startDate())
            .weeks(j.weeks())
            .gymDays(new ArrayList<>(j.gymDaysOrEmpty()))
            .gymTime(j.gymTime())
            .sport(new ArrayList<>(j.sportOrEmpty().stream().map(s -> SeasonSportSlot.builder()
                .dayOfWeek(s.dayOfWeek()).time(s.time()).durationMin(s.durationMin()).sport(s.sport()).build()).toList()))
            .sleepAnchor(j.sleepAnchor() == null ? null : SeasonSleepAnchor.builder()
                .anchor(SeasonSleepAnchor.AnchorEnum.fromValue(j.sleepAnchor().anchor()))
                .time(j.sleepAnchor().time()).build())
            .allowedRecipeIds(new ArrayList<>(j.allowedOrEmpty()))
            .block(j.block() == null ? null : SeasonBlockChoice.builder()
                .source(SeasonBlockChoice.SourceEnum.fromValue(j.block().source()))
                .mesocycleId(j.block().mesocycleId()).templateId(j.block().templateId()).build())
            .build();
    }

    public SeasonNumbers toDto(SeasonNumbersJson n) {
        if (n == null) {
            return null;
        }
        return SeasonNumbers.builder()
            .trainDayKcal(n.trainDayKcal())
            .restDayKcal(n.restDayKcal())
            .proteinG(n.proteinG())
            .carbsTrainG(n.carbsTrainG())
            .sleepNeedMin(n.sleepNeedMin())
            .bedtime(n.bedtime())
            .targetDate(n.targetDate())
            .weeksToTarget(n.weeksToTarget())
            .paceVerdict(n.paceVerdict() == null ? null : SeasonNumbers.PaceVerdictEnum.fromValue(n.paceVerdict()))
            .kgPerWeek(n.kgPerWeek())
            .band(band(n.bandLowKg(), n.bandHighKg()))
            .gymPerWeek(n.gymPerWeek())
            .sportPerWeek(n.sportPerWeek())
            .weekKcal(n.weekKcal())
            .trainSportDayKcal(n.trainSportDayKcal())
            .build();
    }

    public SeasonPreview toDto(SeasonPreviewService.Preview p) {
        return SeasonPreview.builder()
            .before(toDto(p.before()))
            .after(toDto(p.after()))
            .todo(new ArrayList<>(p.todo().stream()
                .map(t -> SeasonTodo.builder().key(t.key()).title(t.title()).body(t.body()).build()).toList()))
            .warnings(new ArrayList<>(p.warnings().stream()
                .map(w -> SeasonWarning.builder().key(w.key()).text(w.text()).build()).toList()))
            .fingerprint(p.fingerprint())
            .build();
    }

    /** {@code current} = the season as it stands (live slots once active); {@code mesocycleId} = its block. */
    public SeasonResponse toResponse(SeasonEntity s, SeasonDraftJson current, UUID mesocycleId) {
        return SeasonResponse.builder()
            .id(s.getId())
            .title(s.getTitle())
            .status(SeasonResponse.StatusEnum.fromValue(s.getStatus()))
            .startDate(s.getStartDate())
            .endDate(s.endDate())
            .weeks(s.getWeeks())
            .goalId(s.getGoalId())
            .sleepNeedMin(s.getSleepNeedMin())
            .mesocycleId(mesocycleId)
            .rules(SeasonRules.builder()
                .processedFoodMaxNova(s.getProcessedFoodMaxNova())
                .deloadMaintain(s.isDeloadMaintain())
                .useLearnedExpenditure(s.isUseLearnedExpenditure())
                .proposeExperiments(s.isProposeExperiments())
                .menuDay(s.getMenuDay())
                .menuTime(s.getMenuTime())
                .build())
            .draft(toDto(current))
            .build();
    }

    public SeasonAdherenceResponse toDto(AdherenceService.Result r) {
        return SeasonAdherenceResponse.builder()
            .days(new ArrayList<>(r.days().stream().map(SeasonMapper::day).toList()))
            .summary(toDto(r.summary()))
            .build();
    }

    public SeasonAdherence toDto(AdherenceService.Summary s) {
        return SeasonAdherence.builder()
            .foodInBand(s.foodInBand()).foodJudged(s.foodJudged())
            .sessionsDone(s.sessionsDone()).sessionsPlanned(s.sessionsPlanned())
            .nightsOk(s.nightsOk()).nightsJudged(s.nightsJudged())
            .excusedDays(s.excusedDays())
            .trainingDone(s.trainingDone()).trainingPlanned(s.trainingPlanned())
            .sportDone(s.sportDone()).sportPlanned(s.sportPlanned())
            .build();
    }

    private static SeasonAdherenceDay day(AdherenceService.AdherenceDay d) {
        return SeasonAdherenceDay.builder()
            .date(d.date()).judged(d.judged()).excused(d.excused()).excuse(d.excuse())
            .kcal(d.kcal()).targetKcal(d.targetKcal()).proteinG(d.proteinG()).targetProteinG(d.targetProteinG())
            .foodInBand(d.foodInBand()).sessionPlanned(d.sessionPlanned()).sessionDone(d.sessionDone())
            .sleepMin(d.sleepMin()).needMin(d.needMin()).sleepOk(d.sleepOk())
            .dayKind(d.dayKind())
            .sessions(new ArrayList<>(d.sessions().stream().map(x -> SeasonAdherenceSession.builder()
                .kind(x.kind()).excused(x.excused()).done(x.done()).build()).toList()))
            .build();
    }

    public static SeasonBand band(BigDecimal low, BigDecimal high) {
        return low == null || high == null ? null : SeasonBand.builder().lowKg(low).highKg(high).build();
    }
}
