package io.mrkuhne.mezo.feature.admin.service;

import java.util.List;
import org.springframework.stereotype.Service;

/** The v1 convenience views: named entry points into the row browser (mezo-d5iy). */
@Service
public class AdminConvenienceViews {

    private static final List<View> VIEWS = List.of(
            new View("mezociklusok", "Mezociklusok", "mesocycle", "start_date", "desc"),
            new View("edzesek", "Edzések", "workout_session", "started_at", "desc"),
            new View("gyakorlatok", "Gyakorlatok", "exercise_set", "done_at", "desc"),
            new View("mintak", "Minták", "pattern", "last_detected_at", "desc"),
            new View("llm-history", "LLM-history", "llm_log_history", "created_at", "desc"),
            new View("memoria-elemek", "Memória-elemek", "memory_item", "occurred_on", "desc"));

    public List<View> views() {
        return VIEWS;
    }

    /** A named table + default ordering. */
    public record View(String id, String label, String table, String defaultSort, String defaultDir) {}
}
