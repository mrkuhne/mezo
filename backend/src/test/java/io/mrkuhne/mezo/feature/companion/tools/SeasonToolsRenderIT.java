package io.mrkuhne.mezo.feature.companion.tools;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.season.SeasonFixture;
import io.mrkuhne.mezo.feature.season.service.SeasonService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import jakarta.persistence.EntityManager;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/** Boop B6 Évad S2 (mezo-r36n9.16): get_season — deterministic render, the CompanionToolsRenderIT idiom. */
@Transactional
@ActiveProfiles("companion-fake")
@Import(SeasonFixture.class)
class SeasonToolsRenderIT extends AbstractIntegrationTest {

    @Autowired private SeasonTools seasonTools;
    @Autowired private SeasonService seasonService;
    @Autowired private SeasonFixture fixture;
    @Autowired private EntityManager em;

    private ToolCallAudit audit;

    private ToolContext ctx(UUID userId) {
        audit = new ToolCallAudit(6, 10);
        return new ToolContext(Map.of(ToolContexts.USER_ID, userId, ToolContexts.AUDIT, audit));
    }

    @Test
    void noSeasonSaysSo() {
        UUID owner = fixture.owner("tool-season-none@test.local");

        assertThat(seasonTools.getSeason(null, ctx(owner))).isEqualTo("Évad: nincs aktív évad");
        assertThat(audit.toRefsEnvelope()).isNull();
    }

    @Test
    void rulesScopeCarriesTheRulesAndOverviewIsTheDefault() {
        UUID owner = fixture.owner("tool-season-rules@test.local");
        seasonService.activate(owner, seasonService.create(owner, SeasonFixture.draft()).getId());
        em.flush();

        String rules = seasonTools.getSeason("rules", ctx(owner));
        assertThat(rules).contains("[Évad] Őszi évad · 1. hét / 12").contains("NOVA ≤ 2").contains("Alvásigény");
        assertThat(audit.toRefsEnvelope().refs()).isNotEmpty();

        String overview = seasonTools.getSeason("bogus", ctx(owner));
        assertThat(overview).contains("Az elmúlt 7 nap").doesNotContain("NOVA");
        assertThat(seasonTools.getSeason(null, ctx(owner))).isEqualTo(overview);
    }
}
