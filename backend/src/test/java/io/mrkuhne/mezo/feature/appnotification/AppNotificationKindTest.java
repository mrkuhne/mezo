package io.mrkuhne.mezo.feature.appnotification;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.appnotification.domain.AppNotificationKind;
import org.junit.jupiter.api.Test;

class AppNotificationKindTest {

    @Test
    void testCatalog_shouldPinFifteenKindsWithFamiliesAndDeeplinks_perSpec() {
        assertThat(AppNotificationKind.values()).hasSize(22);
        assertThat(AppNotificationKind.PATTERN_INBOX.key()).isEqualTo("pattern_inbox");
        assertThat(AppNotificationKind.PATTERN_INBOX.familyKey()).isEqualTo("pattern");
        assertThat(AppNotificationKind.PATTERN_SIGNAL.familyKey()).isEqualTo("pattern");
        assertThat(AppNotificationKind.HYPOTHESIS_NEW.familyKey()).isEqualTo("pattern");
        assertThat(AppNotificationKind.FACT_CANDIDATE.familyKey()).isEqualTo("knowledge");
        assertThat(AppNotificationKind.FACT_REINFORCED.familyKey()).isEqualTo("knowledge");
        // memoir_ready: the existing `memoir` push category already owns that push — no family.
        assertThat(AppNotificationKind.MEMOIR_READY.familyKey()).isNull();
        assertThat(AppNotificationKind.PREDICTION_NEW.familyKey()).isEqualTo("prediction");
        assertThat(AppNotificationKind.PREDICTION_OUTCOME.familyKey()).isEqualTo("prediction");
        assertThat(AppNotificationKind.EXPERIMENT_PROPOSED.familyKey()).isEqualTo("experiment");
        assertThat(AppNotificationKind.EXPERIMENT_CLOSED.familyKey()).isEqualTo("experiment");
        assertThat(AppNotificationKind.CHALLENGE_EVENT.familyKey()).isEqualTo("challenge");
        assertThat(AppNotificationKind.MEMORY_NOTE.familyKey()).isEqualTo("memory");
        // weekly_review_ready: same no-family rationale as memoir_ready (mezo-p2tr).
        assertThat(AppNotificationKind.WEEKLY_REVIEW_READY.familyKey()).isNull();
        assertThat(AppNotificationKind.WEEKLY_REVIEW_READY.deeplink()).isEqualTo("/me/week");
        assertThat(AppNotificationKind.FACT_CANDIDATE.deeplink()).isEqualTo("/mezo/rolad");
        assertThat(AppNotificationKind.CHALLENGE_EVENT.deeplink()).isEqualTo("/train");
        assertThat(AppNotificationKind.MEMORY_NOTE.deeplink()).isEqualTo("/insights/memoria");
        // life_goal_plan (mezo-iizd.7): feed-only — a ha–akkor terv nem kap saját push-kategóriát
        // az első körben (spec D-3, a weekly_review_ready precedens).
        assertThat(AppNotificationKind.LIFE_GOAL_PLAN.key()).isEqualTo("life_goal_plan");
        assertThat(AppNotificationKind.LIFE_GOAL_PLAN.familyKey()).isNull();
        assertThat(AppNotificationKind.LIFE_GOAL_PLAN.deeplink()).isEqualTo("/me/goals");
        assertThat(AppNotificationKind.GOAL_SUGGESTION.key()).isEqualTo("goal_suggestion");
        assertThat(AppNotificationKind.GOAL_SUGGESTION.familyKey()).isNull();
        assertThat(AppNotificationKind.GOAL_SUGGESTION.deeplink())
            .isEqualTo("/me/goals/weight/suggestions");
        // mezo-0cbh — mind a négy FEED-ONLY (familyKey null): ezek olyan dolgok, amiket
        // legközelebb megnyitva megtalálsz, nem amiért rezegjen a telefon.
        assertThat(AppNotificationKind.PERSON_CANDIDATE.familyKey()).isNull();
        assertThat(AppNotificationKind.PERSON_CANDIDATE.deeplink()).isEqualTo("/me/people/jeloltek");
        assertThat(AppNotificationKind.GRAPH_CANDIDATE.familyKey()).isNull();
        assertThat(AppNotificationKind.GRAPH_CANDIDATE.deeplink()).isEqualTo("/mezo/rolad");
        assertThat(AppNotificationKind.HABIT_FORMATION.familyKey()).isNull();
        assertThat(AppNotificationKind.HABIT_FORMATION.deeplink()).isEqualTo("/me/rutin/szokas");
        assertThat(AppNotificationKind.CHARACTER_PORTRAIT.familyKey()).isNull();
        assertThat(AppNotificationKind.CHARACTER_PORTRAIT.deeplink()).isEqualTo("/me/karakter");
        assertThat(AppNotificationKind.KONZILIUM_VERDICT.familyKey()).isNull();
        assertThat(AppNotificationKind.KONZILIUM_VERDICT.deeplink()).isEqualTo("/me/karakter/konzilium");
        // mezo-eq85.4 — a `pattern` push-családon utazik, a felülete viszont az Észrevételek fül.
        assertThat(AppNotificationKind.OBSERVATION_NEW.key()).isEqualTo("observation_new");
        assertThat(AppNotificationKind.OBSERVATION_NEW.familyKey()).isEqualTo("pattern");
        assertThat(AppNotificationKind.OBSERVATION_NEW.deeplink())
            .isEqualTo("/nap/uzenetek?tab=eszrevetelek");
        // mezo-a9bo7.13 — az esti kiadás a `pattern` push-családon utazik (az observation_new
        // precedense), a felülete a csapat üzenőfala.
        assertThat(AppNotificationKind.TEAM_EDITION.key()).isEqualTo("team_edition");
        assertThat(AppNotificationKind.TEAM_EDITION.familyKey()).isEqualTo("pattern");
        assertThat(AppNotificationKind.TEAM_EDITION.deeplink()).isEqualTo("/mezo");
        assertThat(AppNotificationKind.fromKey("pattern_inbox")).contains(AppNotificationKind.PATTERN_INBOX);
        assertThat(AppNotificationKind.fromKey("nope")).isEmpty();
    }
}
