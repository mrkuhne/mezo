package io.mrkuhne.mezo.techcore.exception;

import java.util.List;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class SystemMessage {
    private Level level;
    private String code;
    private List<String> params;
    private String message;        // resolved from messages.properties
    private String fieldName;
    private Type type;
    private String exceptionTraceId;

    public static SystemMessage.SystemMessageBuilder error(String code) {
        return SystemMessage.builder().level(Level.ERROR).code(code).type(Type.REQUEST);
    }

    public static SystemMessage field(String code, String fieldName) {
        return SystemMessage.builder()
            .level(Level.ERROR).code(code).fieldName(fieldName).type(Type.FIELD).build();
    }
}
