package io.mrkuhne.mezo.feature.penz.service.guard;

import java.util.List;

/**
 * The amount guard's answer on one piece of generated text (mezo-r36n9.102): {@link Outcome#OK} when every
 * forint figure it names is allowed, {@link Outcome#DOWNGRADE} otherwise, with the offending figures (HUF minor
 * units, magnitudes, each once, in text order) so the caller can log what the model tried to say.
 */
public record GuardVerdict(Outcome outcome, List<Long> offendingMinor) {

    public enum Outcome { OK, DOWNGRADE }

    private static final GuardVerdict OK_VERDICT = new GuardVerdict(Outcome.OK, List.of());

    public GuardVerdict {
        offendingMinor = List.copyOf(offendingMinor);
    }

    public static GuardVerdict ok() {
        return OK_VERDICT;
    }

    public static GuardVerdict downgrade(List<Long> offendingMinor) {
        return new GuardVerdict(Outcome.DOWNGRADE, offendingMinor);
    }

    public boolean isOk() {
        return outcome == Outcome.OK;
    }
}
