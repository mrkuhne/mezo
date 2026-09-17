package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.companion.tools.CompanionToolRegistry;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.ai.tool.definition.ToolDefinition;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Renders the planner's tool catalogue from the LIVE registry — never a hand-maintained list, so
 * it cannot drift the way the [Eszköz-útmutató] block once did (spec §6.2; tool-convention rule 4
 * is inherited automatically because the text IS the @Tool/@ToolParam descriptions).
 */
@Slf4j
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
@RequiredArgsConstructor
public class ToolCatalogue {

    private final CompanionToolRegistry toolRegistry;
    private final ObjectMapper objectMapper;

    public String render() {
        // Throwaway audit: the catalogue only reads definitions, no call is ever made through it.
        StringBuilder sb = new StringBuilder("[Eszköz-katalógus]\n");
        for (ToolCallback callback : toolRegistry.callbacks(toolRegistry.newTurnAudit())) {
            ToolDefinition def = callback.getToolDefinition();
            sb.append("- ").append(def.name()).append(": ").append(def.description()).append('\n');
            appendParams(sb, def.name(), def.inputSchema());
        }
        return sb.toString();
    }

    /** One indented line per schema property: name, type, and the @ToolParam description. */
    private void appendParams(StringBuilder sb, String toolName, String inputSchema) {
        try {
            JsonNode properties = objectMapper.readTree(inputSchema).path("properties");
            properties.properties().forEach(entry -> {
                if ("toolContext".equals(entry.getKey())) {
                    return;
                }
                JsonNode prop = entry.getValue();
                sb.append("    · ").append(entry.getKey())
                    .append(" (").append(prop.path("type").asString("?")).append(")");
                String description = prop.path("description").asString("");
                if (!description.isBlank()) {
                    sb.append(": ").append(description);
                }
                sb.append('\n');
            });
        } catch (Exception e) {
            // A generated schema failing to parse is a bug elsewhere; the catalogue stays useful
            // with name+description only, and the log points at the offending tool.
            log.warn("Tool schema unparseable for {}", toolName, e);
        }
    }
}
