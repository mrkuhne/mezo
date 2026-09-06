package io.mrkuhne.mezo.feature.lifegoal.service;

import io.mrkuhne.mezo.feature.companion.LifeGoalProposePort.PillarProposal;
import io.mrkuhne.mezo.feature.companion.LifeGoalProposePort.PlanProposal;
import io.mrkuhne.mezo.feature.companion.LifeGoalProposePort.Proposal;
import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;
import org.springframework.stereotype.Component;

/**
 * Rule-based fallback for the AI proposer (spec §7): picks a dimension from title/why keywords and
 * hands back that dimension's stock pillar set. Deterministic, never empty — the wizard always has
 * something to edit even with the LLM off. Not a @Service: it is pure and stateless.
 */
@Component
public class LifeGoalTemplateProposer {

    private static PillarProposal avg(String id, String label, String skill, String threshold) {
        return new PillarProposal(id, label, "average", skill, 1, new BigDecimal(threshold), "gte", null, null, null);
    }

    // threshold/comparator: LifeGoalPillarService.requireRuleShape needs both for kind=habit too
    // (not just daysPerWeek) — the same honest-placeholder default the FE catalog sheet's
    // defaultRule() ships for a habit pick (pillarFromCatalog.ts), since the template has no
    // per-signal numeric default to draw on either. Without this, LifeGoalProposeService's
    // habit/average drop-filter (mezo-iwoc) would strip every template habit pillar as unsavable.
    private static PillarProposal habit(String id, String label, String skill, int days) {
        return new PillarProposal(id, label, "habit", skill, 1, BigDecimal.ONE, "gte", days, null, null);
    }

    private static PillarProposal base(String id, String label, String skill) {
        return new PillarProposal(id, label, "baseline", skill, 1, null, null, null, null, null);
    }

    public Proposal propose(String title, String whyText) {
        String t = ((title == null ? "" : title) + " " + (whyText == null ? "" : whyText)).toLowerCase(Locale.ROOT);
        String dim = dimensionOf(t);
        boolean extrinsic = t.contains("nézzek ki") || t.contains("kinéz") || t.contains("strand")
            || t.contains("pénz") || t.contains("státusz");
        List<PillarProposal> pillars = switch (dim) {
            case "health" -> List.of(avg("sleep_duration", "Alvás", "recovery", "7.0"), avg("protein", "Fehérje", "cooking", "160"),
                habit("gym_volume", "Edzés", "max_strength", 4), habit("ritual_closed", "Fegyelem · napzárás", "mindset", 6));
            case "accomplishment" -> List.of(base("activity_productivity", "Fejlesztés", "productivity"),
                habit("activity_learning", "Tanulás", "learning", 2), habit("ritual_closed", "Napzárás", "mindset", 5));
            case "relationships" -> List.of(base("social_mentions", "Társas élet", "connection"),
                habit("activity_connection", "Tudatos találkozó", "connection", 1), avg("ring_mozgas", "Mozgás-gyűrű", "recovery", "60"));
            case "engagement" -> List.of(base("activity_learning", "Elmélyülés", "learning"), habit("ritual_closed", "Napzárás", "mindset", 5));
            case "positive_emotion" -> List.of(avg("checkin_mental", "Hangulat", "mindfulness", "7"), avg("sleep_duration", "Alvás", "recovery", "7.0"));
            default -> List.of(habit("ritual_closed", "Napzárás", "mindset", 5), avg("checkin_mental", "Hangulat", "mindfulness", "7"));
        };
        return new Proposal(dim, null, extrinsic ? "extrinsic" : "intrinsic",
            extrinsic ? "Ez külső keret — a belső (egészség, képesség) tartósabb motiváció." : "Belső keret — ez tartós motiváció.",
            extrinsic ? "Erősebb, egészségesebb leszek — a kinézet ennek a jele, nem a célja." : null,
            pillars, List.of("Fáradt esték, kimaradó napzárás"),
            List.of(new PlanProposal("kimarad a napzárás", "másnap reggel 2 percben pótolom", "ritual_missed", null, 10)));
    }

    static String dimensionOf(String t) {
        if (t.contains("kockahas") || t.contains("fogy") || t.contains("egészség") || t.contains("maraton") || t.contains("alv")) {
            return "health";
        }
        if (t.contains("barát") || t.contains("kapcsolat") || t.contains("társ") || t.contains("család")) {
            return "relationships";
        }
        if (t.contains("hustle") || t.contains("bevétel") || t.contains("karrier") || t.contains("projekt") || t.contains("app")) {
            return "accomplishment";
        }
        if (t.contains("tanul") || t.contains("zene") || t.contains("flow") || t.contains("olvas")) {
            return "engagement";
        }
        if (t.contains("hangulat") || t.contains("nyugodt") || t.contains("öröm")) {
            return "positive_emotion";
        }
        return "meaning";
    }
}
