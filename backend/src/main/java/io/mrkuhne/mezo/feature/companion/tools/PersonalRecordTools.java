package io.mrkuhne.mezo.feature.companion.tools;

import io.mrkuhne.mezo.feature.companion.service.PersonalRecordService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Discovery and complete read-only evidence; identity never comes from model arguments. */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class PersonalRecordTools {
    private final PersonalRecordService records;

    @Tool(name = "list_personal_sources", description = "A részletes személyes adatforrások katalógusa. "
            + "domain nélkül a domainek; domain=all minden forrás neve; konkrét domain a forrásokat, "
            + "dátummezőt és szülőkapcsolatokat adja. offset=0; nextOffset folytatja a katalógust. Domainek: activity, biometrics, character, companion, "
            + "fuel, gamification, goal, habit, intention, journal, lifegoal, meal, medication, needs, "
            + "nutrition, pantry, people, proactive, progression, quest, recipe, ritual, train. "
            + "Használd, amikor részletes vagy régi adat kell, és a forrás nevét/kapcsolatait keresed. "
            + "A domain-összefoglalókban nem szereplő adatokhoz is innen indulj.")
    public String sources(@ToolParam(required = false, description = "all vagy a leírásban felsorolt domain; üres: domainek") String domain,
            @ToolParam(required = false, description = "0 vagy a kapott nextOffset") Integer offset) {
        return records.sources(domain, offset);
    }

    @Tool(name = "read_personal_records", description = "Teljes tárolt személyes rekordok lapozható olvasása. "
            + "source: a list_personal_sources által felsorolt név, pl. biometric_profile, goal, diet_settings, "
            + "meal, meal_item, pantry_catalog, recipe_ingredient, workout_session, exercise_set, exercise_feedback, "
            + "journal_entry, decision_entry, gratitude_entry, ritual_day, needs_day, person, mention, "
            + "prediction, experiment, memory_item. id: egy rekord; parentId: katalógus szerinti szülő; "
            + "from/to: tetszőleges régi ISO dátumhatár, nincs 30 napos korlát; query: szó szerinti szövegrészlet. "
            + "offset=0 alapértelmezés, nextOffset folytatja a rekordlistát. contentOffset=0 alapértelmezés; "
            + "nextContentOffset esetén ugyanazt az id-t olvasd tovább (offset=0). A content JSON-szöveg, "
            + "hosszú rekordnál folytatható részlet; a NULL nem nulla. Használd, amikor az összefoglaló "
            + "kevés, pontos mennyiség/sorozat/beállítás, napló, emberek, régi adat vagy RAG-találat teljes "
            + "eredetije kell. Ételnél snapshot_* a snapshot_per szerinti tápérték; mennyiség/unit külön mező. "
            + "Ez csak olvasás, nem módosít és nem generál új adatot.")
    public String read(
            @ToolParam(description = "A list_personal_sources felsorolt forrásneve") String source,
            @ToolParam(required = false, description = "Rekord UUID; a memória forrás-ID-ja is használható") String id,
            @ToolParam(required = false, description = "Szülő UUID a katalógus parentField kapcsolata szerint") String parentId,
            @ToolParam(required = false, description = "Kezdő dátum YYYY-MM-DD, inkluzív") String from,
            @ToolParam(required = false, description = "Záró dátum YYYY-MM-DD, inkluzív") String to,
            @ToolParam(required = false, description = "Szó szerinti kis/nagybetű-független szövegrészlet; nem SQL") String query,
            @ToolParam(required = false, description = "0 vagy a kapott nextOffset") Integer offset,
            @ToolParam(required = false, description = "0 vagy a rekord nextContentOffset értéke; folytatáshoz id kötelező") Integer contentOffset,
            ToolContext context) {
        return records.read(ToolContexts.userId(context), source, id, parentId, from, to, query, offset, contentOffset);
    }
}
