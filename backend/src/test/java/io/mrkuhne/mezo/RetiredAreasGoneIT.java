package io.mrkuhne.mezo;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.config.ConfigurableListableBeanFactory;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.scheduling.config.ScheduledTaskHolder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.util.ClassUtils;

/**
 * Guard for the web retirement (decision #52, spec 2026-11-19-web-retirement-design §4.2): the server
 * areas only the web app used are GONE — no bean, no route, no job — while their tables and rows stay
 * untouched (no Liquibase change is part of any removal).
 *
 * <p>Each removal task APPENDS to {@link #RETIRED_PACKAGES}, {@link #RETIRED_ROUTES} and the
 * {@code @TestPropertySource} below (the area's former {@code mezo.*} keys, switches set ON). The
 * properties prove the anti-goal "a stale property re-enables a removed job": the context still starts
 * with every removed key present, and nothing of a retired package comes back.
 *
 * <p>Task 4 (mezo-r36n9.97.4): {@code tutorial}, {@code telemetry}, {@code admin}.
 */
@TestPropertySource(properties = {
    // tutorial (mezo-gb1s.1)
    "mezo.feature.tutorial.enabled=true",
    // telemetry (mezo-o5cz)
    "mezo.feature.screen-telemetry.enabled=true",
    "mezo.telemetry.retention-days=90",
    "mezo.telemetry.retention-cron=0 45 3 * * *",
    "mezo.telemetry.batch-max=50",
    "mezo.telemetry.rate-limit-per-minute=120",
    "mezo.telemetry.occurred-at-clamp-hours=24",
    // admin hub, data browser, RAG memory explorer (mezo-d5iy, mezo-4qyt, mezo-kjwa)
    "mezo.feature.admin-insights.enabled=true",
    "mezo.feature.admin-memory.enabled=true",
    "mezo.admin.report-zone=Europe/Budapest",
    "mezo.admin.statement-timeout=5s",
    "mezo.admin.browser.max-page-size=200",
    "mezo.admin.feature-map.train.table=workout_session",
    "mezo.admin.feature-map.train.timestamp-column=started_at",
    "mezo.admin.artifact-feature-map.chat_message=companion_chat",
    "mezo.admin.memory.pca-target-dims=50",
    "mezo.admin.memory.statement-timeout=PT5S",
    "mezo.admin.memory.replay-feature-label=admin_replay",
    "mezo.admin.alerts.cost-spike-factor=2.0",
})
class RetiredAreasGoneIT extends ApiIntegrationTest {

    /** Package prefixes of removed areas; no bean of any of them may exist. */
    static final List<String> RETIRED_PACKAGES = List.of(
        "io.mrkuhne.mezo.feature.tutorial.",
        "io.mrkuhne.mezo.feature.telemetry.",
        "io.mrkuhne.mezo.feature.admin.");

    /** One representative route per removed area (or contract fragment) — each must 404 for the owner. */
    record RetiredRoute(HttpMethod method, String path, String jsonBody) {
        static RetiredRoute get(String path) {
            return new RetiredRoute(HttpMethod.GET, path, null);
        }
    }

    static final List<RetiredRoute> RETIRED_ROUTES = List.of(
        RetiredRoute.get("/api/tutorial/progress"),
        // telemetry has no GET — its only operation was the ingest POST.
        new RetiredRoute(HttpMethod.POST, "/api/telemetry/screen-events",
            "{\"events\":[{\"screen\":\"/ma\",\"occurredAt\":\"2026-11-19T08:00:00Z\"}]}"),
        RetiredRoute.get("/api/admin/overview"),
        RetiredRoute.get("/api/admin/data/tables"),
        RetiredRoute.get("/api/admin/memory/health"));

    @Autowired private ConfigurableApplicationContext context;

    @Test
    void testBeans_shouldBeAbsent_whenAreaRetired() {
        assertThat(retiredBeans())
            .as("no bean of a retired area may exist (spec 2026-11-19 §4.2)")
            .isEmpty();
    }

    @Test
    void testRoutes_shouldReturn404_whenAreaRetired() {
        HttpHeaders headers = ownerAuthHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        List<String> notGone = new ArrayList<>();
        for (RetiredRoute route : RETIRED_ROUTES) {
            ResponseEntity<String> response =
                rest.exchange(route.path(), route.method(), new HttpEntity<>(route.jsonBody(), headers), String.class);
            if (response.getStatusCode() != HttpStatus.NOT_FOUND) {
                notGone.add(route.method() + " " + route.path() + " -> " + response.getStatusCode());
            }
        }
        assertThat(notGone).as("every retired route must 404 for the owner").isEmpty();
    }

    @Test
    void testContext_shouldStart_whenRetiredPropertiesStillSet() {
        // The context booted with every removed key above set (switches ON) — reaching here is half the proof.
        assertThat(context.isActive()).isTrue();
        List<String> armed = new ArrayList<>(context.getBeanProvider(ScheduledTaskHolder.class).stream()
            .flatMap(holder -> holder.getScheduledTasks().stream())
            .map(task -> task.getTask().getRunnable().toString())
            .filter(RetiredAreasGoneIT::isRetired)
            .toList());
        // The test profile runs without a scheduler (mezo-peh4), so also look for @Scheduled methods a
        // production scheduler WOULD arm: any bean declaring one in a retired package.
        armed.addAll(scheduledMethodsOfRetiredPackages());
        assertThat(armed).as("no scheduled job of a retired area may be registered").isEmpty();
    }

    private List<String> retiredBeans() {
        ConfigurableListableBeanFactory factory = context.getBeanFactory();
        return Arrays.stream(factory.getBeanDefinitionNames())
            .filter(name -> {
                Class<?> type = factory.getType(name, false);
                return type != null && isRetired(ClassUtils.getUserClass(type).getName());
            })
            .toList();
    }

    private List<String> scheduledMethodsOfRetiredPackages() {
        ConfigurableListableBeanFactory factory = context.getBeanFactory();
        List<String> found = new ArrayList<>();
        for (String name : factory.getBeanDefinitionNames()) {
            Class<?> type = factory.getType(name, false);
            if (type == null) {
                continue;
            }
            Class<?> user = ClassUtils.getUserClass(type);
            if (!isRetired(user.getName())) {
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

    private static boolean isRetired(String text) {
        return RETIRED_PACKAGES.stream().anyMatch(text::contains);
    }
}
