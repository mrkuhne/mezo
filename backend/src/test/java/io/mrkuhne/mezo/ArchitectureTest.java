package io.mrkuhne.mezo;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.library.GeneralCodingRules.NO_CLASSES_SHOULD_USE_FIELD_INJECTION;

import com.tngtech.archunit.base.DescribedPredicate;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaConstructorCall;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.core.importer.Location;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;
import com.tngtech.archunit.library.dependencies.SlicesRuleDefinition;
import com.tngtech.archunit.library.freeze.FreezingArchRule;
import java.util.Set;

/**
 * Machine-enforced house rules (mezo-ah18.7 / ADR 0007) — the executable half of
 * docs/references/{java_package_structure,spring_patterns,error_handling,
 * configuration_conventions,api_contract_conventions}.md. Runs inside the normal
 * {@code ./mvnw test} (Surefire {@code *Test} include), no Spring context needed.
 *
 * <p>Generated OpenAPI sources ({@code io.mrkuhne.mezo.api..}) are excluded from the import —
 * we do not lint generated code. Startup catalog loaders keep their fail-fast
 * {@code IllegalStateException} by design (documented exception in error_handling.md).
 */
@AnalyzeClasses(
    packages = "io.mrkuhne.mezo",
    importOptions = {ImportOption.DoNotIncludeTests.class, ArchitectureTest.ExcludeGeneratedApi.class})
class ArchitectureTest {

    /** Generated contract sources are not ours to lint. */
    static class ExcludeGeneratedApi implements ImportOption {
        @Override
        public boolean includes(Location location) {
            return !location.contains("/io/mrkuhne/mezo/api/");
        }
    }

    // ── java_package_structure.md — placement by stereotype ─────────────────────

    @ArchTest
    static final ArchRule controllers_live_in_controller_packages =
        classes().that().areAnnotatedWith("org.springframework.web.bind.annotation.RestController")
            .should().resideInAPackage("..controller..");

    @ArchTest
    static final ArchRule services_live_in_service_packages =
        classes().that().areAnnotatedWith("org.springframework.stereotype.Service")
            .should().resideInAPackage("..service..");

    @ArchTest
    static final ArchRule entities_live_in_entity_packages =
        classes().that().areAnnotatedWith("jakarta.persistence.Entity")
            .should().resideInAPackage("..entity..");

    @ArchTest
    static final ArchRule repositories_live_in_repository_packages =
        classes().that().areAssignableTo("org.springframework.data.repository.Repository")
            .and().resideOutsideOfPackage("..techcore..")
            .should().resideInAPackage("..repository..");

    /**
     * The seam mezo-ah18.12 restored: feature packages must stay cycle-free. FROZEN: two
     * pre-existing cycles (biometrics↔goal — mezo-ah18.15, meal↔recipe — mezo-ah18.16) are
     * recorded in {@code src/test/resources/archunit-store} and tolerated; any NEW cycle (or
     * widening of a frozen one) fails. Resolving a frozen cycle shrinks the store — commit it.
     */
    @ArchTest
    static final ArchRule feature_slices_are_cycle_free =
        FreezingArchRule.freeze(
            SlicesRuleDefinition.slices().matching("io.mrkuhne.mezo.feature.(*)..").should().beFreeOfCycles());

    // ── spring_patterns.md — DI + transactions ───────────────────────────────────

    @ArchTest
    static final ArchRule no_field_injection = NO_CLASSES_SHOULD_USE_FIELD_INJECTION;

    @ArchTest
    static final ArchRule no_class_level_transactional =
        noClasses().should().beAnnotatedWith("org.springframework.transaction.annotation.Transactional")
            .orShould().beAnnotatedWith("jakarta.transaction.Transactional")
            .because("spring_patterns.md: @Transactional is method-level ONLY, never class-level");

    // ── configuration_conventions.md — no Spring @Value anywhere ────────────────

    @ArchTest
    static final ArchRule no_spring_value_annotation =
        noClasses().should(new ArchCondition<>("declare a member annotated with Spring @Value") {
            @Override
            public void check(JavaClass clazz, ConditionEvents events) {
                clazz.getMembers().stream()
                    .filter(m -> m.isAnnotatedWith("org.springframework.beans.factory.annotation.Value"))
                    .forEach(m -> events.add(SimpleConditionEvent.violated(
                        clazz, clazz.getName() + "." + m.getName()
                            + " uses Spring @Value — use a @Validated *Properties record instead")));
            }
        }).because("configuration_conventions.md bans @Value(\"${...}\") in favour of *Properties records");

    // ── companion spec §6 — IDENT-2 internal-sphere-only tool registry ──────────

    /** IDENT-2 (spec §6): the tool registry NEVER contains an outward-acting tool — structural, not prompt-level. */
    @ArchTest
    static final ArchRule companion_tools_are_internal_sphere_only =
        noClasses().that().resideInAPackage("..feature.companion.tools..")
            .should().dependOnClassesThat().resideInAnyPackage(
                "org.springframework.web.client..",
                "org.springframework.web.reactive.function.client..",
                "java.net.http..",
                "jakarta.mail..",
                "org.apache.hc..",
                "okhttp3..")
            .because("IDENT-2: companion tools are internal-sphere reads only (no HTTP/mail/outward action)");

    // ── api_contract_conventions.md — contract-first controllers ────────────────

    /**
     * The ONE documented exception (V0.4 SSE precedent, _platform-api-backend.md §9): the
     * stream operation IS in the contract (tag CompanionStream), but the generated interface
     * cannot express Flux&lt;ServerSentEvent&gt;, so the controller is hand-written.
     */
    private static final Set<String> HAND_WRITTEN_CONTROLLER_ALLOWLIST = Set.of(
        "io.mrkuhne.mezo.feature.companion.controller.CompanionStreamController");

    @ArchTest
    static final ArchRule controllers_implement_generated_api =
        classes().that().areAnnotatedWith("org.springframework.web.bind.annotation.RestController")
            .should(new ArchCondition<>("implement a generated io.mrkuhne.mezo.api.controller.*Api interface") {
                @Override
                public void check(JavaClass clazz, ConditionEvents events) {
                    if (HAND_WRITTEN_CONTROLLER_ALLOWLIST.contains(clazz.getName())) {
                        return;
                    }
                    boolean ok = clazz.getAllRawInterfaces().stream()
                        .anyMatch(i -> i.getPackageName().equals("io.mrkuhne.mezo.api.controller"));
                    if (!ok) {
                        events.add(SimpleConditionEvent.violated(clazz,
                            clazz.getName() + " does not implement a generated <Tag>Api interface"));
                    }
                }
            }).because("api_contract_conventions.md: endpoints are contract-first");

    // ── error_handling.md — no raw generic exceptions on app paths ───────────────

    /**
     * Documented exceptions: startup fail-fast catalog loaders, plus the profile-gated LLM
     * test fake whose failure sentinels deliberately simulate an ARBITRARY provider exception
     * (a SystemRuntimeErrorException there would fake app-level error semantics the real
     * Gemini adapter never has).
     */
    private static final Set<String> RAW_EXCEPTION_ALLOWLIST = Set.of(
        "io.mrkuhne.mezo.feature.pantry.PantryCatalogLoader",
        "io.mrkuhne.mezo.feature.train.ExerciseCatalogLoader",
        "io.mrkuhne.mezo.feature.progression.PerkCatalog",
        "io.mrkuhne.mezo.feature.quest.QuestCatalog",
        "io.mrkuhne.mezo.feature.habit.HabitCatalog",
        "io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm");

    private static final Set<String> RAW_EXCEPTION_TYPES = Set.of(
        "java.lang.RuntimeException", "java.lang.IllegalStateException", "java.lang.IllegalArgumentException");

    @ArchTest
    static final ArchRule no_raw_generic_exceptions_outside_techcore =
        noClasses().that().resideOutsideOfPackage("io.mrkuhne.mezo.techcore..")
            .and(new DescribedPredicate<>("are not startup catalog loaders") {
                @Override
                public boolean test(JavaClass clazz) {
                    return !RAW_EXCEPTION_ALLOWLIST.contains(clazz.getName());
                }
            })
            .should(new ArchCondition<>("construct raw RuntimeException/IllegalStateException/IllegalArgumentException") {
                @Override
                public void check(JavaClass clazz, ConditionEvents events) {
                    for (JavaConstructorCall call : clazz.getConstructorCallsFromSelf()) {
                        if (RAW_EXCEPTION_TYPES.contains(call.getTargetOwner().getName())) {
                            events.add(SimpleConditionEvent.satisfied(clazz,
                                call.getDescription() + " — use SystemRuntimeErrorException + SystemMessage"));
                        }
                    }
                }
            }).because("error_handling.md: all app-path errors go through SystemRuntimeErrorException");
}
