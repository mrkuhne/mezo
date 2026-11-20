package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.train.config.MesoPlanProperties;
import io.mrkuhne.mezo.feature.train.config.MesoPlanProperties.Split;
import io.mrkuhne.mezo.feature.train.config.VolumeProperties;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.boot.context.properties.source.ConfigurationPropertySources;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.core.io.ClassPathResource;

class SplitCatalogTest {

    private static final StandardEnvironment ENV = env();
    private static final MesoPlanProperties P =
        Binder.get(ENV).bind("mezo.meso-plan", MesoPlanProperties.class).get();
    private static final VolumeProperties V = Binder.get(ENV).bind("mezo.volume", VolumeProperties.class).get();

    private static StandardEnvironment env() {
        try {
            var env = new StandardEnvironment();
            var sources = new YamlPropertySourceLoader().load("application", new ClassPathResource("application.yml"));
            sources.forEach(s -> env.getPropertySources().addLast(s));
            ConfigurationPropertySources.attach(env);
            return env;
        } catch (java.io.IOException e) {
            throw new IllegalStateException(e);
        }
    }

    @Test
    void everyEntryKeepsSkeletonInvariants() {
        for (int n = 2; n <= 6; n++) {
            for (Split sp : SplitCatalog.forDays(P, n)) {
                var s = MesoPlanSkeleton.build(MesoPlanSkeleton.DAY_ORDER.subList(0, n), 6, Map.of(),
                    V.baselines(), V.bands(), sp.types(), sp.label());
                for (String g : V.baselines().keySet()) {
                    assertThat(MesoPlanSkeleton.frequencyOf(s, g)).as("%s %s freq", sp.key(), g).isGreaterThanOrEqualTo(2);
                }
                s.days().forEach(d -> d.muscles().forEach(m ->
                    assertThat(m.sets()).as("%s %s %s", sp.key(), d.day(), m.group())
                        .isBetween(1, V.bands().sessionCap())));
            }
        }
    }

    @Test
    void firstEntryIsTodaysDefault() {
        for (int n = 2; n <= 6; n++) {
            assertThat(SplitCatalog.forDays(P, n).get(0).types()).isEqualTo(MesoPlanSkeleton.SPLIT_DAYS.get(n));
        }
    }

    @Test
    void findLooksUpByKey() {
        assertThat(SplitCatalog.find(P, 4, "full4")).isPresent();
        assertThat(SplitCatalog.find(P, 4, "nope")).isEmpty();
    }

    @Test
    void validationRejectsUnknownTypeAndWrongLength() {
        try (var f = jakarta.validation.Validation.buildDefaultValidatorFactory()) {
            var v = f.getValidator();
            assertThat(v.validate(new Split("x", "X", List.of("Full", "Arms")))).isNotEmpty();
            assertThat(v.validate(new Split("x", "X", List.of("Full", "Full")))).isEmpty();
            var bad = new MesoPlanProperties(2, 8, 10, 12, 15, 1, 2, 1, null,
                Map.of(3, List.of(new Split("x", "X", List.of("Full", "Full")))));
            assertThat(v.validate(bad)).isNotEmpty();
            var badType = new MesoPlanProperties(2, 8, 10, 12, 15, 1, 2, 1, null,
                Map.of(2, List.of(new Split("x", "X", List.of("Full", "Arms")))));
            assertThat(v.validate(badType)).isNotEmpty();
            assertThat(v.validate(P)).isEmpty();
        }
    }
}
