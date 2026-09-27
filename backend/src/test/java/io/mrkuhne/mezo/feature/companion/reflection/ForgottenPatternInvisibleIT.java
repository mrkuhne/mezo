package io.mrkuhne.mezo.feature.companion.reflection;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.PatternDecisionRequest;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import io.mrkuhne.mezo.feature.companion.reflection.service.ObservationFeedService;
import io.mrkuhne.mezo.feature.companion.reflection.service.ReflectionReplyService;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.companion.service.PatternService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.PatternEventPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * S6 (mezo-d6ivw.6) Task A8: a {@code forgotten} row is a soft-delete-with-veto — it must never
 * resurface through any user-facing pattern reader (the list, the observation feed, replies)
 * even though it is not the {@code deleted} flag the repositories already filter on.
 *
 * <p>{@code quiet-from == quiet-to} disables {@code ObservationBudget}'s quiet-hours check
 * entirely, same idiom as {@code KnowledgeRecheckServiceIT} — these assertions must never go
 * flaky depending on the wall-clock hour they happen to run at.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = {
        "mezo.companion.reflection.notice.quiet-from=00:00",
        "mezo.companion.reflection.notice.quiet-to=00:00"})
class ForgottenPatternInvisibleIT extends AbstractIntegrationTest {

    @Autowired private PatternService patternService;
    @Autowired private ObservationFeedService feed;
    @Autowired private ReflectionReplyService replyService;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private PatternEventPopulator patternEventPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private PatternRepository patternRepository;

    @Test
    void forgottenRow_shouldNotAppearInThePatternListOrTheFeed() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = patternPopulator.reflectionNoPlan(owner, PatternEntity.STATUS_CONFIRMED);
        patternEventPopulator.decision(owner, row.getId(), PatternEventEntity.KIND_CONFIRMED, Instant.now());
        row.setStatus(PatternEntity.STATUS_FORGOTTEN);
        patternPopulator.save(row);

        assertThat(patternService.list(owner)).noneMatch(p -> p.getId().equals(row.getId()));
        assertThat(feed.forDay(owner, null)).noneMatch(c -> c.getPatternId().equals(row.getId()));
    }

    @Test
    void forgottenRow_shouldRejectReplies() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = patternPopulator.reflectionNoPlan(owner, PatternEntity.STATUS_FORGOTTEN);

        assertThatThrownBy(() -> replyService.reply(owner, row.getId(), "watch", null))
                .isInstanceOf(SystemRuntimeErrorException.class);
    }

    /** Final review Minor 8: a forgotten row cannot be revived by a Minták decision. */
    @Test
    void forgottenRow_shouldRejectDecide_withNotFound() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = patternPopulator.reflectionNoPlan(owner, PatternEntity.STATUS_FORGOTTEN);

        assertThatThrownBy(() -> patternService.decide(owner, row.getId(),
                new PatternDecisionRequest().decision("confirm")))
                .isInstanceOf(SystemRuntimeErrorException.class)
                .extracting(e -> ((SystemRuntimeErrorException) e).getStatus())
                .isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(patternRepository.findById(row.getId()).orElseThrow().isForgotten()).isTrue();
    }
}
