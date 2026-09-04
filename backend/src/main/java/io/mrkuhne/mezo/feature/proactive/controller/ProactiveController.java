package io.mrkuhne.mezo.feature.proactive.controller;

import io.mrkuhne.mezo.api.controller.ProactiveApi;
import io.mrkuhne.mezo.api.dto.AdviceApplyRequest;
import io.mrkuhne.mezo.api.dto.ChallengeDecisionRequest;
import io.mrkuhne.mezo.api.dto.ChallengeResponse;
import io.mrkuhne.mezo.api.dto.ExperimentDecisionRequest;
import io.mrkuhne.mezo.api.dto.ExperimentResponse;
import io.mrkuhne.mezo.api.dto.FeedMessageResponse;
import io.mrkuhne.mezo.api.dto.MemoirArchiveResponse;
import io.mrkuhne.mezo.api.dto.MemoirResponse;
import io.mrkuhne.mezo.api.dto.PredictionResponse;
import io.mrkuhne.mezo.api.dto.WeeklyLessonResponse;
import io.mrkuhne.mezo.api.dto.WeeklyReviewDigestResponse;
import io.mrkuhne.mezo.api.dto.WeeklyReviewResponse;
import io.mrkuhne.mezo.api.dto.WeeklySuggestionResponse;
import io.mrkuhne.mezo.feature.proactive.mapper.ProactiveMapper;
import io.mrkuhne.mezo.feature.proactive.service.AdviceApplyService;
import io.mrkuhne.mezo.feature.proactive.service.ProactiveChallengeService;
import io.mrkuhne.mezo.feature.proactive.service.ProactiveExperimentService;
import io.mrkuhne.mezo.feature.proactive.service.ProactiveFeedService;
import io.mrkuhne.mezo.feature.proactive.service.ProactiveMemoirService;
import io.mrkuhne.mezo.feature.proactive.service.ProactivePredictionService;
import io.mrkuhne.mezo.feature.proactive.service.ProactiveWeeklySuggestionService;
import io.mrkuhne.mezo.feature.proactive.service.WeeklyLessonService;
import io.mrkuhne.mezo.feature.proactive.service.WeeklyReviewDigestService;
import io.mrkuhne.mezo.feature.proactive.service.WeeklyReviewService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class ProactiveController implements ProactiveApi {

    private final ProactiveWeeklySuggestionService weeklySuggestionService;
    private final ProactiveMemoirService memoirService;
    private final ProactivePredictionService predictionService;
    private final ProactiveExperimentService experimentService;
    private final ProactiveChallengeService challengeService;
    private final ProactiveFeedService feedService;
    private final AdviceApplyService adviceApplyService;
    private final ProactiveMapper mapper;
    private final WeeklyReviewService weeklyReviewService;
    private final WeeklyReviewDigestService weeklyReviewDigestService;
    private final WeeklyLessonService weeklyLessonService;
    private final CurrentUserId currentUserId;

    private static void requireMonday(LocalDate start) {
        if (start.getDayOfWeek() != DayOfWeek.MONDAY) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("WEEKLY_REVIEW_START_NOT_MONDAY").build(), HttpStatus.BAD_REQUEST);
        }
    }

    @Override
    public List<FeedMessageResponse> getFeed(LocalDate date) {
        return feedService.getFeed(currentUserId.get(), date);
    }

    @Override
    public WeeklySuggestionResponse getWeeklySuggestion(LocalDate date) {
        return weeklySuggestionService.getWeeklySuggestion(currentUserId.get(), date);
    }

    @Override
    public MemoirResponse getMemoir() {
        return memoirService.getMemoir(currentUserId.get());
    }

    @Override
    public MemoirArchiveResponse getMemoirArchive() {
        return memoirService.archive(currentUserId.get());
    }

    @Override
    public List<PredictionResponse> getPredictions() {
        return predictionService.getPredictions(currentUserId.get());
    }

    @Override
    public List<ExperimentResponse> getExperiments() {
        return experimentService.getExperiments(currentUserId.get());
    }

    @Override
    public List<ExperimentResponse> proposeExperiments() {
        return experimentService.propose(currentUserId.get());
    }

    @Override
    public ExperimentResponse decideExperiment(UUID id, ExperimentDecisionRequest request) {
        return experimentService.decide(currentUserId.get(), id, request);
    }

    /**
     * S5 (bd mezo-d58h.5): delegates straight into {@link AdviceApplyService#apply} — no
     * transaction opened here. {@code apply} is itself {@code @Transactional} and takes the
     * per-user advisory lock as the first statement of THAT transaction (see its javadoc); a
     * caller that wrapped it in an outer transaction which had already touched
     * {@code companion_message} would break that lock-ordering invariant.
     */
    @Override
    public FeedMessageResponse applyAdviceAction(UUID id, AdviceApplyRequest request) {
        return mapper.toFeedResponse(
                adviceApplyService.apply(currentUserId.get(), id, request.getActionKey().getValue()));
    }

    @Override
    public List<ChallengeResponse> getChallenges(UUID templateSessionId, LocalDate date) {
        return challengeService.getChallenges(currentUserId.get(), templateSessionId, date);
    }

    @Override
    public ChallengeResponse decideChallenge(UUID id, ChallengeDecisionRequest request) {
        return challengeService.decide(currentUserId.get(), id, request);
    }

    @Override
    public WeeklyReviewResponse getWeeklyReview(LocalDate start) {
        requireMonday(start);
        return weeklyReviewService.getResponse(currentUserId.get(), start);
    }

    @Override
    public WeeklyReviewResponse regenerateWeeklyReview(LocalDate start) {
        requireMonday(start);
        return weeklyReviewService.regenerate(currentUserId.get(), start);
    }

    @Override
    public List<WeeklyLessonResponse> getWeeklyReviewLessons(LocalDate start) {
        requireMonday(start);
        return weeklyLessonService.list(currentUserId.get(), start);
    }

    @Override
    public WeeklyReviewDigestResponse getWeeklyReviewDigest(LocalDate start) {
        requireMonday(start);
        return weeklyReviewDigestService.getDigest(currentUserId.get(), start);
    }
}
