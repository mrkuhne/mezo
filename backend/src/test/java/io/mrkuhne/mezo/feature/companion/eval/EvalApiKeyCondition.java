package io.mrkuhne.mezo.feature.companion.eval;

import java.util.Map;
import org.junit.jupiter.api.extension.ConditionEvaluationResult;
import org.junit.jupiter.api.extension.ExecutionCondition;
import org.junit.jupiter.api.extension.ExtensionContext;

/**
 * The eval gate, which must not lie (mezo-ozri.3). The pre-S3 gate named {@code GEMINI_API_KEY}
 * unconditionally: after the provider switch it would have skipped the ONE real chat-quality
 * measurement in silence and reported green.
 *
 * <p>Two outcomes, deliberately asymmetric:
 * <ul>
 *   <li><b>Nobody asked for a model</b> (no {@code -Dmezo.eval.model}) and the incumbent key is
 *       absent → skip. A keyless CI stays green; this suite is opt-in twice over anyway.</li>
 *   <li><b>Somebody asked for THIS model</b> and its provider's key is absent → throw. A requested
 *       measurement that cannot run is a failure, never a silent pass.</li>
 * </ul>
 */
public class EvalApiKeyCondition implements ExecutionCondition {

    @Override
    public ConditionEvaluationResult evaluateExecutionCondition(ExtensionContext context) {
        return decide(EvalTarget.fromSystemProperties(), System.getenv());
    }

    static ConditionEvaluationResult decide(EvalTarget target, Map<String, String> env) {
        if (target.keyPresentIn(env)) {
            return ConditionEvaluationResult.enabled(
                "Eval target " + target.model() + " (" + target.providerKey() + "), key present");
        }
        if (target.explicit()) {
            throw new IllegalStateException(
                "Eval run requested " + EvalTarget.MODEL_PROPERTY + "=" + target.model()
                    + " but " + target.apiKeyEnvVar() + " is not set — the measurement cannot run, "
                    + "and skipping it would report a green gate for a model nobody measured (mezo-ozri.3)");
        }
        return ConditionEvaluationResult.disabled(
            "No " + EvalTarget.MODEL_PROPERTY + " requested and " + target.apiKeyEnvVar()
                + " is absent — incumbent eval skipped");
    }
}
