package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.LogWeightRequest;
import io.mrkuhne.mezo.api.dto.WeightLogResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.character.service.chat.TeamChatEventListener;
import io.mrkuhne.mezo.feature.character.service.chat.TeamChatExpiryJob;
import io.mrkuhne.mezo.feature.character.service.chat.TeamChatReplyListener;
import io.mrkuhne.mezo.feature.character.service.chat.TeamChatReplyVoiceWriter;
import io.mrkuhne.mezo.feature.character.service.chat.TeamChatService;
import io.mrkuhne.mezo.feature.character.service.chat.TeamChatVoiceWriter;
import io.mrkuhne.mezo.feature.character.service.edition.EditionVoiceWriter;
import io.mrkuhne.mezo.feature.character.service.edition.TeamEditionService;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import io.mrkuhne.mezo.feature.proactive.service.ChallengeJob;
import io.mrkuhne.mezo.feature.proactive.service.CompanionMessageEventListener;
import io.mrkuhne.mezo.feature.proactive.service.CompanionMessageJob;
import io.mrkuhne.mezo.feature.proactive.service.SetupCheckJob;
import io.mrkuhne.mezo.feature.proactive.service.WeeklySuggestionJob;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.lang.reflect.Method;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.config.ConfigurableListableBeanFactory;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.core.env.PropertySource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.scheduling.config.ScheduledTaskHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.util.ClassUtils;

/**
 * Web retirement step 8 (mezo-r36n9.97.8, spec 2026-11-19-web-retirement-design §4.3): the AI generators
 * whose output was shown ONLY on the web (the contextual feed, its sleep/weight reactions, workout
 * challenges, the weekly suggestion, the setup-check advice cards, the team chat and the evening team
 * edition) are switched off by configuration — their code stays for slice B8.
 *
 * <p><b>Production-equivalent config.</b> The test profile switches most jobs off anyway
 * ({@code src/test/resources/application.properties}), which would make a bean-absence check pass
 * vacuously. So {@link #productionSwitches} re-applies, for every switch below, the value the main
 * {@code application.yml} declares — this test never states a flag value itself. A switch flipped back on
 * in {@code application.yml} brings its beans back here and fails the test.
 *
 * <p>The test profile runs without a scheduler (mezo-peh4), so besides {@link ScheduledTaskHolder} it
 * also looks for the {@code @Scheduled} methods a production scheduler WOULD arm (the
 * {@code RetiredAreasGoneIT} approach).
 */
@ActiveProfiles("companion-fake")
class WebOnlyGeneratorsOffIT extends ApiIntegrationTest {

    /** The switches that turn the web-only generators off (llm_log features in brackets). */
    static final List<String> OFF_SWITCHES = List.of(
        FeaturesConfiguration.FEED_JOB_SWITCH,              // proactive_feed (morning/midday/evening/hydration/people)
        FeaturesConfiguration.FEED_REACTIONS_SWITCH,        // proactive_feed (sleep/weight)
        FeaturesConfiguration.CHALLENGE_JOB_SWITCH,         // proactive_challenge
        FeaturesConfiguration.WEEKLY_SUGGESTION_JOB_SWITCH, // proactive_weekly
        FeaturesConfiguration.SETUP_CHECK_JOB_SWITCH,       // proactive_advice
        FeaturesConfiguration.TEAM_CHAT_SWITCH,             // team_chat
        FeaturesConfiguration.TEAM_EDITION_SWITCH);         // character_edition

    /** The generator beans (jobs, listeners, LLM writers) those switches remove. */
    static final List<Class<?>> OFF_BEANS = List.of(
        CompanionMessageJob.class,
        CompanionMessageEventListener.class,
        ChallengeJob.class,
        WeeklySuggestionJob.class,
        SetupCheckJob.class,
        TeamChatService.class,
        TeamChatEventListener.class,
        TeamChatExpiryJob.class,
        TeamChatVoiceWriter.class,
        TeamChatReplyListener.class,
        TeamChatReplyVoiceWriter.class,
        TeamEditionService.class,
        EditionVoiceWriter.class);

    @DynamicPropertySource
    static void productionSwitches(DynamicPropertyRegistry registry) {
        PropertySource<?> production = productionYaml();
        for (String key : OFF_SWITCHES) {
            Object value = production.getProperty(key);
            // An undeclared switch is off in production (no matchIfMissing anywhere on these beans).
            String resolved = value == null ? "false" : value.toString();
            registry.add(key, () -> resolved);
        }
    }

    @Autowired private ConfigurableApplicationContext context;
    @Autowired private CompanionMessageRepository companionMessageRepository;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private FakeCompanionLlm fake;

    @Test
    void testGeneratorBeans_shouldBeAbsent_whenSwitchedOffInProduction() {
        List<String> present = OFF_BEANS.stream()
            .filter(type -> context.getBeanNamesForType(type).length > 0)
            .map(Class::getSimpleName)
            .toList();
        assertThat(present)
            .as("no web-only generator bean may exist with the production switches (spec 2026-11-19 §4.3)")
            .isEmpty();
    }

    @Test
    void testJobs_shouldNotBeRegistered_whenSwitchedOffInProduction() {
        List<String> armed = new ArrayList<>(context.getBeanProvider(ScheduledTaskHolder.class).stream()
            .flatMap(holder -> holder.getScheduledTasks().stream())
            .map(task -> task.getTask().getRunnable().toString())
            .filter(WebOnlyGeneratorsOffIT::isOffGenerator)
            .toList());
        armed.addAll(scheduledMethodsOfOffGenerators());
        assertThat(armed).as("no scheduled job of a web-only generator may be registered").isEmpty();
    }

    @Test
    void testWeightLog_shouldMakeNoFeedReaction_whenReactionsSwitchedOff() throws InterruptedException {
        UUID owner = appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
        checkInPopulator.createCheckIn(owner, LocalDate.now(), "06:30", 4, 2,
            "[fake-feed-weight:{\"eyebrow\":\"Mérés kész\",\"body\":[\"Stabil úton vagy.\"],\"refIndexes\":[]}]");
        int feedSmartCallsBefore = fake.feedSmartCallCount();
        // This class boots its own context (its property set is unique), so the fake is ours alone.

        // logWeight is an iPhone operation — the write that used to trigger a reaction LLM call.
        postForBody("/api/biometrics/weight",
            LogWeightRequest.builder().date(LocalDate.now()).weightKg(new BigDecimal("82.40")).build(),
            ownerAuthHeaders(), HttpStatus.CREATED, WeightLogResponse.class);

        Thread.sleep(1500); // grace period for an async listener to (not) fire
        assertThat(companionMessageRepository.findByCreatedByAndMessageDateAndKind(
            owner, LocalDate.now(), CompanionMessageEntity.KIND_WEIGHT))
            .as("a weight log must not produce a web-only feed reaction card")
            .isEmpty();
        assertThat(fake.feedActor("weight")).as("no weight-reaction LLM call").isNull();
        assertThat(fake.feedSmartCallCount()).as("no contextual-feed LLM call").isEqualTo(feedSmartCallsBefore);
    }

    @Test
    void testDeployment_shouldNotOverride_offSwitches() throws IOException {
        Path deployment = Path.of("..", "k8s", "backend", "deployment.yaml");
        assertThat(deployment).as("k8s backend deployment manifest").exists();
        Matcher names = Pattern.compile("-\\s*name:\\s*(MEZO_[A-Z0-9_]+)").matcher(Files.readString(deployment));
        List<String> envNames = new ArrayList<>();
        while (names.find()) {
            envNames.add(names.group(1));
        }
        Map<String, String> overrides = OFF_SWITCHES.stream()
            .flatMap(key -> envForms(key).stream().map(env -> Map.entry(env, key)))
            .filter(entry -> envNames.contains(entry.getKey()))
            .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
        assertThat(overrides).as("no env var in the deployment may re-enable a web-only generator").isEmpty();
    }

    private List<String> scheduledMethodsOfOffGenerators() {
        ConfigurableListableBeanFactory factory = context.getBeanFactory();
        List<String> found = new ArrayList<>();
        for (String name : factory.getBeanDefinitionNames()) {
            Class<?> type = factory.getType(name, false);
            if (type == null) {
                continue;
            }
            Class<?> user = ClassUtils.getUserClass(type);
            if (!isOffGenerator(user.getName())) {
                continue;
            }
            for (Method method : user.getDeclaredMethods()) {
                if (AnnotatedElementUtils.hasAnnotation(method, Scheduled.class)) {
                    found.add(user.getName() + "#" + method.getName());
                }
            }
        }
        return found;
    }

    private static boolean isOffGenerator(String text) {
        return OFF_BEANS.stream().anyMatch(type -> text.contains(type.getName()));
    }

    /** Both spellings an env var could use for a dashed key (Spring relaxed binding drops the dash). */
    private static List<String> envForms(String key) {
        String upper = key.toUpperCase(Locale.ROOT).replace('.', '_');
        return List.of(upper.replace("-", ""), upper.replace('-', '_'));
    }

    private static PropertySource<?> productionYaml() {
        try {
            List<PropertySource<?>> sources =
                new YamlPropertySourceLoader().load("production-application-yml", new ClassPathResource("application.yml"));
            assertThat(sources).as("main application.yml on the test classpath").isNotEmpty();
            return sources.getFirst();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
