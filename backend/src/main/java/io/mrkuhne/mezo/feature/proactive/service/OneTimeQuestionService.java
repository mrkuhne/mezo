package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.companion.feedback.entity.MessageFeedbackEntity;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Once-ever questions (round 2 S5, bd mezo-d58h.7.5, spec 2026-09-05 §c) — the "ask once, remember
 * the answer, change nothing" genre. A variant of {@link SetupCheckService}: the same ordered
 * first-wins shape, the same setup-tier {@code advice} delivery, the same envelope {@code setupKey}
 * slot — but the re-emit window is not "weekly", it is NEVER.
 *
 * <p><b>Budget (spec §c):</b> at most one question per day, and a question never stacks with an
 * advice card — so this service refuses to speak at all on a day that already has one. That gate is
 * belt AND braces with the severity table ({@link AdvicePriority} ranks both question keys
 * next-to-last, above only {@code all_healthy}), and both are deliberate: the gate makes the intent
 * legible in the log, the rank keeps the invariant true for any future caller.
 *
 * <p><b>Once-ever</b> is {@link CompanionMessageRepository#questionAlreadyAsked} — a native read
 * that sees soft-deleted rows, because a superseded question card WAS asked. See that method's
 * javadoc for the trade it closes.
 *
 * <p><b>The card is verbatim</b> ({@link AdviceCandidate#fromQuestion}): the advice prompt would
 * rewrite a question into coaching advice and dissolve the 👍/👎 answer key out of it. That is also
 * why the facts here may carry numbers — {@code ProseNumberGuard} never runs on this card.
 *
 * <p><b>Nothing follows from an answer</b> except one remembered fact
 * ({@link QuestionAnswerService}). No feature is hidden, no data excluded, no rule input changed.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class OneTimeQuestionService {

    /** Spec §(17): a feature family that was genuinely used and then went quiet. */
    public static final String QUESTION_FEATURE_ABANDONMENT = "question_feature_abandonment";
    /** Spec §(18): eight workouts of identical debrief values. */
    public static final String QUESTION_FLAT_FEEDBACK = "question_flat_feedback";
    /** The question tier's own eyebrow — visibly not a „Mezo · észrevétel" advice card. */
    public static final String EYEBROW = "Mezo · kérdés";

    private static final String ANSWER_UP_ABANDONMENT = "👍 — tudatosan tettem félre";
    private static final String ANSWER_DOWN_ABANDONMENT = "👎 — csak kikopott, visszatérnék hozzá";
    private static final String ANSWER_UP_FLAT = "👍 — tényleg ennyire egyforma";
    private static final String ANSWER_DOWN_FLAT = "👎 — inkább reflexből koppintom";

    private static final String MIND_LABEL = "a napló, a szokások, az esti rituálé és az Életjelek";
    private static final String CHAT_LABEL = "a velem való beszélgetés";

    private final CompanionMessageRepository companionMessageRepository;
    private final FeatureAbandonmentDetector featureAbandonmentDetector;
    private final FlatFeedbackDetector flatFeedbackDetector;
    private final AdviceCardService adviceCardService;

    /** The question asked today, or empty — which is the normal case for almost every day of the
     *  app's life (each question exists exactly once per user, ever). */
    @Transactional
    public Optional<CompanionMessageEntity> runFor(UUID userId) {
        if (companionMessageRepository.findByCreatedByAndMessageDateAndKind(
                userId, LocalDate.now(), CompanionMessageEntity.KIND_ADVICE).isPresent()) {
            log.info("Question skipped for user {}: today's card budget is already spent", userId);
            return Optional.empty();
        }
        Optional<CompanionMessageEntity> abandonment = abandonmentQuestion(userId);
        return abandonment.isPresent() ? abandonment : flatFeedbackQuestion(userId);
    }

    /** The two one-tap answers of a question, as the FACT each stands for — the answer-capture side
     *  ({@link QuestionAnswerService}) needs exactly this mapping and must not re-invent it. Empty
     *  for an unknown key or an unknown verdict: an answer we cannot read is not a fact. */
    public Optional<String> answerFact(String questionKey, String verdict) {
        boolean up = MessageFeedbackEntity.VERDICT_UP.equals(verdict);
        boolean down = MessageFeedbackEntity.VERDICT_DOWN.equals(verdict);
        if (!up && !down) {
            return Optional.empty();
        }
        return switch (questionKey) {
            case QUESTION_FEATURE_ABANDONMENT -> Optional.of(up
                ? "A napló/szokás/rituálé/Életjel felületeket TUDATOSAN tette félre — ne ajánlgasd őket."
                : "A napló/szokás/rituálé/Életjel felületek egyszerűen kikoptak nála, és szívesen "
                    + "visszatérne hozzájuk.");
            case QUESTION_FLAT_FEEDBACK -> Optional.of(up
                ? "Az edzés-visszajelzései tényleg stabilan azonosak — vedd őket készpénznek."
                : "Az edzés-visszajelzéseit gyakran reflexből koppintja; adatminőségi fenntartással "
                    + "kezeld őket.");
            default -> Optional.empty();
        };
    }

    /** Every fact text a question can ever produce — the flip-detection input
     *  ({@link QuestionAnswerService}). */
    public List<String> allAnswerFacts(String questionKey) {
        return Stream.of(MessageFeedbackEntity.VERDICT_UP, MessageFeedbackEntity.VERDICT_DOWN)
            .map(verdict -> answerFact(questionKey, verdict))
            .flatMap(Optional::stream)
            .toList();
    }

    /** The knowledge-fact category a question's answer belongs to (ck_knowledge_fact_category). */
    public static String categoryOf(String questionKey) {
        return QUESTION_FLAT_FEEDBACK.equals(questionKey) ? "train" : "life";
    }

    private Optional<CompanionMessageEntity> abandonmentQuestion(UUID userId) {
        if (companionMessageRepository.questionAlreadyAsked(userId, QUESTION_FEATURE_ABANDONMENT)) {
            return Optional.empty();
        }
        return featureAbandonmentDetector.detect(userId).flatMap(verdict -> {
            String label = FeatureAbandonmentDetector.FAMILY_CHAT.equals(verdict.family())
                ? CHAT_LABEL : MIND_LABEL;
            List<String> facts = List.of(
                "Az elmúlt %d napban semmi új nem került ide.".formatted(verdict.idleDays()),
                "Korábban összesen %d bejegyzés született itt.".formatted(verdict.priorRows()));
            String text = ("Feltűnt, hogy %s mostanában érintetlen maradt. Nem baj — csak szeretném "
                + "tudni, hogyan gondoljak rá: tudatosan tetted félre, vagy egyszerűen csak "
                + "kikopott? A válaszod megjegyzem, és semmi más nem történik tőle.").formatted(label);
            return ask(userId, QUESTION_FEATURE_ABANDONMENT, facts,
                List.of(ANSWER_UP_ABANDONMENT, ANSWER_DOWN_ABANDONMENT), text);
        });
    }

    private Optional<CompanionMessageEntity> flatFeedbackQuestion(UUID userId) {
        if (companionMessageRepository.questionAlreadyAsked(userId, QUESTION_FLAT_FEEDBACK)) {
            return Optional.empty();
        }
        return flatFeedbackDetector.detect(userId).flatMap(verdict -> {
            List<String> facts = List.of(
                "Az utolsó %d edzés visszajelzése végig ugyanaz volt.".formatted(verdict.workouts()),
                "Terhelés: %d, ízületi panasz: %d — minden alkalommal."
                    .formatted(verdict.workload(), verdict.jointPain()));
            String text = "Az utolsó edzéseidnél a terhelés- és ízületi visszajelzés mindig ugyanaz "
                + "volt. Ez lehet, hogy tényleg ennyire stabil — vagy csak reflexből koppintod. "
                + "Melyik igaz? Megjegyzem a válaszod, és semmi mást nem csinálok vele.";
            return ask(userId, QUESTION_FLAT_FEEDBACK, facts,
                List.of(ANSWER_UP_FLAT, ANSWER_DOWN_FLAT), text);
        });
    }

    private Optional<CompanionMessageEntity> ask(UUID userId, String questionKey,
                                                 List<String> facts, List<String> answers,
                                                 String text) {
        Optional<CompanionMessageEntity> card = adviceCardService.deliver(userId,
            AdviceCandidate.fromQuestion(questionKey, EYEBROW, facts, answers, text));
        if (card.isEmpty()) {
            // Nothing was written, so nothing was asked — the question stays available. Only
            // reachable if a card landed between the budget gate and the delivery lock.
            log.info("Question {} was not delivered for user {} — it stays unasked", questionKey, userId);
        } else {
            log.info("Question {} asked for user {} — once, ever", questionKey, userId);
        }
        return card;
    }
}
