package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.config.ConversationProperties;
import io.mrkuhne.mezo.feature.companion.config.PersonalRecordProperties;
import io.mrkuhne.mezo.feature.companion.repository.PersonalRecordQuery;
import io.mrkuhne.mezo.feature.companion.repository.PersonalRecordSource;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

/** Bounded transport over complete source records; every omitted byte has an explicit continuation. */
@Service
@RequiredArgsConstructor
public class PersonalRecordService {
    private final PersonalRecordQuery records;
    private final PersonalRecordProperties properties;
    private final CompanionProperties companion;
    private final ConversationProperties conversation;
    private final ObjectMapper json;

    public String sources(String domain, Integer offsetValue) {
        int offset = offsetValue == null ? 0 : offsetValue;
        if (offset < 0) return error("Az offset nem lehet negatív.");
        var all = PersonalRecordSource.ALL;
        List<?> values;
        String key;
        if (domain == null || domain.isBlank()) {
            key = "domains";
            values = all.stream().map(PersonalRecordSource::domain).distinct().toList();
        } else {
            var selected = all.stream().filter(s -> domain.equals("all") || s.domain().equals(domain)).toList();
            if (selected.isEmpty()) return error("Ismeretlen domain; kérd le paraméter nélkül a domaineket.");
            key = "sources";
            values = domain.equals("all") ? selected.stream().map(PersonalRecordSource::name).toList()
                    : selected.stream().map(s -> Map.of("source", s.name(), "dateField", s.dateColumn(),
                            "parentSource", s.parentSource(), "parentField", s.parentColumn())).toList();
        }
        int start = Math.min(offset, values.size());
        int count = values.size() - start;
        while (true) {
            var page = new LinkedHashMap<String, Object>();
            page.put(key, values.subList(start, start + count));
            page.put("offset", offset);
            page.put("nextOffset", start + count < values.size() ? start + count : null);
            page.put("total", values.size());
            String rendered = json.writeValueAsString(page);
            if (rendered.length() <= budget()) return rendered;
            if (count > 1) count--;
            else return error("A katalóguselem nem fér az eredménykeretbe.");
        }
    }

    public String read(UUID user, String sourceName, String idText, String parentText, String fromText,
            String toText, String query, Integer offsetValue, Integer contentOffsetValue) {
        var source = PersonalRecordSource.named(sourceName);
        if (source == null) return error("Ismeretlen forrás. list_personal_sources adja az engedélyezett neveket.");
        int offset = offsetValue == null ? 0 : offsetValue;
        int contentOffset = contentOffsetValue == null ? 0 : contentOffsetValue;
        if (offset < 0 || contentOffset < 0) return error("Az offset és contentOffset nem lehet negatív.");
        if (query != null && query.length() > properties.queryMaxChars()) return error("Túl hosszú keresőszöveg.");
        UUID id;
        UUID parent;
        LocalDate from;
        LocalDate to;
        try {
            id = blank(idText) ? null : UUID.fromString(idText);
            parent = blank(parentText) ? null : UUID.fromString(parentText);
            from = blank(fromText) ? null : LocalDate.parse(fromText);
            to = blank(toText) ? null : LocalDate.parse(toText);
        } catch (IllegalArgumentException | java.time.format.DateTimeParseException e) {
            return error("Érvénytelen UUID vagy ISO dátum (YYYY-MM-DD).");
        }
        if (from != null && to != null && from.isAfter(to)) return error("A kezdődátum nem lehet későbbi a végdátumnál.");
        if (parent != null && source.parentColumn().isEmpty()) return error("Ehhez a forráshoz nincs parentId szűrő.");
        if ((from != null || to != null) && source.dateColumn().isEmpty()) return error("Ehhez a katalógushoz nincs dátumszűrő.");
        if (contentOffset > 0 && id == null) return error("Szövegfolytatáshoz ugyanazt a rekord id-t add meg.");
        int budget = budget();
        int pageSize = id != null ? 1 : Math.min(properties.pageSize(), Math.max(1, (budget - 300) / 300));
        List<PersonalRecordQuery.Row> rows = records.read(user, source, id, parent, from, to, query, offset, pageSize + 1);
        int count = Math.min(pageSize, rows.size());
        if (count > 0 && contentOffset > rows.getFirst().content().length()) return error("A contentOffset a rekord vége után van.");
        int sliceSize = Math.max(1, (budget - 250 - count * 100) / Math.max(1, count * 2));
        while (true) {
            var output = page(sourceName, rows, count, offset, contentOffset, sliceSize);
            String rendered = json.writeValueAsString(output);
            if (rendered.length() <= budget) return rendered;
            if (count > 1) count--;
            else if (sliceSize > 1) sliceSize /= 2;
            else return error("A beállított eredménykeret túl kicsi a forrásolvasáshoz.");
        }
    }

    private Map<String, Object> page(String source, List<PersonalRecordQuery.Row> rows, int count,
            int offset, int start, int sliceSize) {
        var parts = new ArrayList<Map<String, Object>>();
        for (var row : rows.subList(0, count)) {
            String text = row.content();
            int end = Math.min(text.length(), start + sliceSize);
            if (end < text.length() && end > start && Character.isHighSurrogate(text.charAt(end - 1))) {
                end = end - 1 == start ? end + 1 : end - 1;
            }
            var part = new LinkedHashMap<String, Object>();
            part.put("id", row.id());
            part.put("contentOffset", start);
            part.put("nextContentOffset", end < text.length() ? end : null);
            part.put("content", text.substring(start, end));
            parts.add(part);
        }
        var page = new LinkedHashMap<String, Object>();
        page.put("source", source);
        page.put("offset", offset);
        page.put("nextOffset", rows.size() > count ? offset + count : null);
        page.put("hasMore", rows.size() > count);
        page.put("records", parts);
        page.put("continuation", "nextOffset: lista; nextContentOffset: id + contentOffset, offset=0; content: JSON-részlet.");
        return page;
    }

    private int budget() {
        return Math.min(conversation.resultMaxChars(), companion.turn().answerer().outcomeMaxCharsPerResult());
    }

    private boolean blank(String text) { return text == null || text.isBlank(); }
    private String error(String text) { return json.writeValueAsString(Map.of("error", text)); }
}
