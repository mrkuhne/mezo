package io.mrkuhne.mezo.feature.character.service.chat;

public final class TeamChatReplyDecision {
    public enum Outcome { ANSWER_ONLY, CLOSE_NEW_EXCEPTION, CLOSE_AS_HIT_ON_ACTIVE, EXCUSE_TAP_EQUIVALENT }
    static final int FACT_MAX = 160;
    private TeamChatReplyDecision() {}

    public static Outcome decide(String threadStatus, String offer, TeamChatReplyDraft d, boolean activeSameTag,
            boolean vetoed, String offerExceptionNormalizedTag) {
        if (!"OPEN".equals(threadStatus) || d == null || !d.voiced() || !TeamChatReplyDraft.CONCRETE.equals(d.verdict())) {
            return Outcome.ANSWER_ONLY;
        }
        if (d.contextTag() == null || d.contextTag().isBlank() || d.contextTag().strip().length() > TeamChatExceptionMatcher.TAG_MAX
                || d.factText() == null || d.factText().isBlank() || d.factText().strip().length() > FACT_MAX
                || d.keywords() == null || d.keywords().isEmpty()) {
            return Outcome.ANSWER_ONLY;
        }
        String tag = TeamChatExceptionMatcher.normalize(d.contextTag());
        if (tag.isEmpty()) return Outcome.ANSWER_ONLY; // emoji/punctuation only: no tag to remember
        if (TeamChatService.OFFER_REVIEW.equals(offer)) return Outcome.ANSWER_ONLY;
        if (TeamChatService.OFFER_EXCUSE.equals(offer)) {
            return tag.equals(offerExceptionNormalizedTag) ? Outcome.EXCUSE_TAP_EQUIVALENT : Outcome.ANSWER_ONLY;
        }
        if (vetoed) return Outcome.ANSWER_ONLY;
        return activeSameTag ? Outcome.CLOSE_AS_HIT_ON_ACTIVE : Outcome.CLOSE_NEW_EXCEPTION;
    }
}
