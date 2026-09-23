package io.mrkuhne.mezo.feature.companion.tools;

import io.mrkuhne.mezo.feature.companion.service.PersonalMemorySearchService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class FeedContextTools {
    public static final String AS_OF_DATE = "feedAsOfDate";
    public static final String OPERATION = "feedOperation";
    private final PersonalMemorySearchService memory;

    @Tool(name = "search_personal_memory", description = "Kapcsolódó személyes emlékek és korábbi beszélgetések keresése. "
            + "query: kötelező önálló témaleírás. Használd, amikor az esemény korábbi megbeszéléshez, "
            + "élethelyzethez vagy más területhez kapcsolódhat. Dátumozott kivonat és forrásazonosító, "
            + "nem friss mérés vagy bizonyított ok; eredeti forrás: read_personal_records(source,id).")
    public String searchMemory(@ToolParam(description = "Önállóan érthető keresőkérdés") String query, ToolContext ctx) {
        if (query == null || query.isBlank()) return "Adj meg keresőkérdést.";
        var date = (LocalDate) ctx.getContext().getOrDefault(AS_OF_DATE, LocalDate.now());
        var operation = (String) ctx.getContext().getOrDefault(OPERATION, "feed");
        var result = memory.search(ToolContexts.userId(ctx), null, query, List.of(), date,
                "proactive_feed", operation + "_memory_read");
        var audit = ToolContexts.audit(ctx);
        result.refs().forEach(r -> audit.addRef(r.kind(), r.id(), r.label()));
        audit.addRecalled(result.recalled());
        String text = result.memoriesBlock() + result.graphBlock();
        // Legacy facts have no dates: leave them for explicit source reads instead of presenting them as current.
        return text.isBlank() ? ToolText.NO_DATA : text;
    }
}
