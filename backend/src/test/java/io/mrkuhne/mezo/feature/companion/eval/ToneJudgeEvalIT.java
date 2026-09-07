package io.mrkuhne.mezo.feature.companion.eval;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.config.LlmProvider;
import io.mrkuhne.mezo.feature.companion.eval.ToneJudgePairing.Pair;
import io.mrkuhne.mezo.feature.companion.eval.ToneJudgePairing.Tally;
import io.mrkuhne.mezo.feature.companion.eval.ToneJudgePairing.Verdict;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.prompt.ChatOptions;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

/**
 * Blind Hungarian tone comparison between two eval runs' answers (mezo-ozri.3, spec §S3 gate 4).
 * It consumes the {@code answers-<model>.json} artifacts {@code ToolSelectionEvalIT} writes, so it
 * spends nothing on re-generating answers — only on judging them.
 *
 * <p>Run it TWICE, once per judge family, and compare: a judge from the candidate's own family is
 * not a neutral referee, and the cheap defence against self-preference is to ask both and to read
 * the answers by hand when they disagree.
 *
 * <pre>
 * ./mvnw test -Dtest=ToneJudgeEvalIT -Dmezo.excludedTestGroups= \
 *   -Dmezo.eval.model=gemini-2.5-pro \
 *   -Dmezo.eval.baseline=target/eval/answers-gemini-2.5-flash.json \
 *   -Dmezo.eval.candidate=target/eval/answers-gpt-5.6-luna.json
 * </pre>
 *
 * <p>{@code -Dmezo.eval.model} names the JUDGE here (the same {@link EvalTarget} mechanism, so the
 * same gate applies: a judge whose provider key is missing fails the run instead of skipping it).
 */
@Slf4j
@Tag("eval")
@ExtendWith(EvalApiKeyCondition.class)
@Timeout(value = 20, unit = TimeUnit.MINUTES)
class ToneJudgeEvalIT extends AbstractIntegrationTest {

    private static final EvalTarget JUDGE = EvalTarget.fromSystemProperties();
    private static final long SEED = 20260907L;

    private static final String RUBRIC = """
        Két magyar nyelvű edzés- és táplálkozás-asszisztens válaszát hasonlítod össze ugyanarra a
        kérdésre. Csak a NYELVI MINŐSÉGET és a HANGNEMET ítéld meg: természetes magyar szórend és
        ragozás, tegeződő, támogató de nem nyálas hang, tömörség, magyartalan fordulatok és angolos
        szerkezetek hiánya. A tartalmi helyesség NEM számít.
        Egy rövid indoklás után az UTOLSÓ sorod pontosan ez legyen: "VERDICT: A", "VERDICT: B"
        vagy "VERDICT: TIE".
        """;

    @Autowired private ObjectMapper objectMapper;
    @Autowired @Qualifier("googleGenAiChatModel") private ChatModel geminiChatModel;
    @Autowired @Qualifier("openAiChatModel") private ChatModel openAiChatModel;

    @Test
    void testToneJudge_shouldReportBlindWinTieLoss_whenTwoRunsAnswersAreCompared() throws Exception {
        Map<String, String> baseline = loadAnswers("mezo.eval.baseline");
        Map<String, String> candidate = loadAnswers("mezo.eval.candidate");
        List<Pair> pairs = ToneJudgePairing.pair(baseline, candidate, SEED);
        assertThat(pairs).isNotEmpty();

        List<Verdict> verdicts = new ArrayList<>();
        for (Pair pair : pairs) {
            verdicts.add(ToneJudgePairing.parseVerdict(judge(pair)));
        }
        Tally tally = ToneJudgePairing.tally(pairs, verdicts);

        log.info("Tone judge [{}] over {} pairs — candidate {} / baseline {} / tie {} / unparseable {}",
            JUDGE.model(), pairs.size(), tally.candidateWins(), tally.baselineWins(),
            tally.ties(), tally.unparseable());
        assertThat(tally.unparseable()).isLessThanOrEqualTo(pairs.size() / 10);
    }

    /**
     * The judge model is named EXPLICITLY in the options rather than left to the starter's default,
     * which is the cheap tier: a judge silently downgraded to gemini-2.5-flash would still produce
     * confident-looking verdicts.
     */
    private String judge(Pair pair) {
        String prompt = RUBRIC + "\n\n[A]\n" + pair.optionA() + "\n\n[B]\n" + pair.optionB();
        ChatModel model = JUDGE.provider() == LlmProvider.OPENAI ? openAiChatModel : geminiChatModel;
        ChatOptions options = ChatOptions.builder().model(JUDGE.model()).build();
        return model.call(new Prompt(prompt, options)).getResult().getOutput().getText();
    }

    private Map<String, String> loadAnswers(String property) throws Exception {
        Path path = Path.of(System.getProperty(property, ""));
        assertThat(Files.exists(path)).as("%s artifact %s", property, path.toAbsolutePath()).isTrue();
        Map<String, Object> raw = objectMapper.readValue(Files.readString(path),
            new TypeReference<Map<String, Object>>() {});
        @SuppressWarnings("unchecked")
        Map<String, String> answers = (Map<String, String>) raw.get("answers");
        return answers;
    }
}
