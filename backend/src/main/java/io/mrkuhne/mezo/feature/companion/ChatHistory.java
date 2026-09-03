package io.mrkuhne.mezo.feature.companion;

import io.mrkuhne.mezo.feature.auth.service.PromptPersona;
import io.mrkuhne.mezo.feature.companion.CompanionLlm.Role;
import io.mrkuhne.mezo.feature.companion.CompanionLlm.Turn;

import java.util.List;

/**
 * A beszélgetés-előzmény SZÖVEGES alakja (mezo-q71s). A modell a history-t valódi üzenetlistaként
 * kapja ({@code ChatClient.messages(..)}), ez a renderelés kizárólag a három NEM-modell fogyasztónak
 * szól, ahol egy string kell: a verdict-bíráló payloadja, a fake LLM echója és az llm-audit
 * {@code conversation_history} oszlopa. Ez a formátum korábban a system promptba került — ha valaha
 * újra ott landol, a {@code ChatServiceIT} history-szeparációs tesztje elbukik.
 */
public final class ChatHistory {

    public static final String HEADER = "\n\nEddigi beszélgetés (legrégebbitől a legújabbig):\n";

    private ChatHistory() {}

    public static String render(List<Turn> history) {
        if (history.isEmpty()) {
            return "";
        }
        StringBuilder rendered = new StringBuilder(HEADER);
        for (Turn turn : history) {
            rendered.append(turn.role() == Role.USER ? PromptPersona.USER_TURN_LABEL : "Mezo: ")
                    .append(turn.content())
                    .append('\n');
        }
        return rendered.toString();
    }
}
