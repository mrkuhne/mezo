package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.MemoryForgetVetoEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.reflection.entity.EffectMuteEntity;
import io.mrkuhne.mezo.feature.companion.reflection.repository.EffectMuteRepository;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.MemoryForgetVetoRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.KnowledgeFactPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.util.UUID;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ClassPathResource;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.datasource.init.ScriptUtils;

/** S6 (mezo-d6ivw.6) Task A1: the forget/mute schema round-trips, its constraints bite, and the
 *  mute-reason backfill is idempotent (the backfill script is re-run here on seeded rows). */
class MemoryForgetSchemaIT extends AbstractIntegrationTest {

    @Autowired private KnowledgeFactRepository facts;
    @Autowired private PatternRepository patterns;
    @Autowired private MemoryForgetVetoRepository vetoes;
    @Autowired private EffectMuteRepository mutes;
    @Autowired private KnowledgeFactPopulator factPopulator;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private DataSource dataSource;

    @Test
    void knowledgeFact_shouldPersistMuteReasonAndTimestamp() {
        UUID owner = userPopulator.createUser().getId();
        KnowledgeFactEntity fact = factPopulator.fact(owner, "Kávé 14 előtt", "fuel", 1);
        Instant at = Instant.parse("2026-09-27T08:00:00Z");
        fact.mute(KnowledgeFactEntity.MUTED_USER, at);
        facts.saveAndFlush(fact);

        KnowledgeFactEntity reread = facts.findById(fact.getId()).orElseThrow();
        assertThat(reread.isIncludeInPrompt()).isFalse();
        assertThat(reread.getMutedReason()).isEqualTo("user");
        assertThat(reread.getMutedAt()).isEqualTo(at);

        reread.unmute();
        facts.saveAndFlush(reread);
        KnowledgeFactEntity back = facts.findById(fact.getId()).orElseThrow();
        assertThat(back.isIncludeInPrompt()).isTrue();
        assertThat(back.getMutedReason()).isNull();
        assertThat(back.getMutedAt()).isNull();
    }

    @Test
    void pattern_shouldAcceptForgottenStatusAndRecheckedAt() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = patternPopulator.reflectionNoPlan(owner, PatternEntity.STATUS_CONFIRMED);
        row.setStatus(PatternEntity.STATUS_FORGOTTEN);
        row.setRecheckedAt(Instant.parse("2026-09-20T09:20:00Z"));
        patternPopulator.save(row);

        PatternEntity reread = patterns.findById(row.getId()).orElseThrow();
        assertThat(reread.isForgotten()).isTrue();
        assertThat(reread.getRecheckedAt()).isEqualTo(Instant.parse("2026-09-20T09:20:00Z"));
    }

    @Test
    void veto_shouldBeUniquePerUserDomainAndKey() {
        UUID owner = userPopulator.createUser().getId();
        vetoes.saveAndFlush(veto(owner, MemoryForgetVetoEntity.DOMAIN_FACT_TEXT, "kávé 14 előtt"));
        assertThat(vetoes.existsByCreatedByAndDomainAndVetoKeyAndDeletedFalse(
                owner, MemoryForgetVetoEntity.DOMAIN_FACT_TEXT, "kávé 14 előtt")).isTrue();
        assertThatThrownBy(() -> vetoes.saveAndFlush(
                veto(owner, MemoryForgetVetoEntity.DOMAIN_FACT_TEXT, "kávé 14 előtt")))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void effectMute_shouldBeUniquePerSubject() {
        UUID owner = userPopulator.createUser().getId();
        mutes.saveAndFlush(mute(owner, "event", "munka", EffectMuteEntity.MODE_MUTED));
        assertThatThrownBy(() -> mutes.saveAndFlush(mute(owner, "event", "munka", EffectMuteEntity.MODE_FORGOTTEN)))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void backfill_shouldMarkOldMutesUserOrRefuted_andBeIdempotent() throws Exception {
        UUID owner = userPopulator.createUser().getId();
        KnowledgeFactEntity plainOff = factPopulator.fact(owner, "Régi kikapcsolt", "life", 0, false,
                KnowledgeFactEntity.SOURCE_CHAT);
        KnowledgeFactEntity refutedOff = factPopulator.fact(owner, "Cáfolt minta ténye", "health", 0, false,
                KnowledgeFactEntity.SOURCE_PATTERN);
        PatternEntity refuted = patternPopulator.reflectionNoPlan(owner, PatternEntity.STATUS_REFUTED);
        refuted.setPromotedFactId(refutedOff.getId());
        patternPopulator.save(refuted);
        KnowledgeFactEntity on = factPopulator.fact(owner, "Bekapcsolt", "life", 0);

        runBackfill();
        runBackfill(); // idempotent: the second pass changes nothing

        assertThat(facts.findById(plainOff.getId()).orElseThrow().getMutedReason()).isEqualTo("user");
        assertThat(facts.findById(refutedOff.getId()).orElseThrow().getMutedReason()).isEqualTo("refuted");
        assertThat(facts.findById(on.getId()).orElseThrow().getMutedReason()).isNull();
        assertThat(facts.findById(plainOff.getId()).orElseThrow().getMutedAt()).isNull();
    }

    private void runBackfill() throws Exception {
        try (var connection = dataSource.getConnection()) {
            ScriptUtils.executeSqlScript(connection, new ClassPathResource(
                    "db/changelog/1.1.0/script/202609271201_mezo-d6ivw.6_fact_mute_reason_backfill.sql"));
        }
    }

    private static MemoryForgetVetoEntity veto(UUID owner, String domain, String key) {
        MemoryForgetVetoEntity v = new MemoryForgetVetoEntity();
        v.setCreatedBy(owner);
        v.setDomain(domain);
        v.setVetoKey(key);
        return v;
    }

    private static EffectMuteEntity mute(UUID owner, String kind, String key, String mode) {
        EffectMuteEntity m = new EffectMuteEntity();
        m.setCreatedBy(owner);
        m.setSubjectKind(kind);
        m.setSubjectKey(key);
        m.setMode(mode);
        return m;
    }
}
