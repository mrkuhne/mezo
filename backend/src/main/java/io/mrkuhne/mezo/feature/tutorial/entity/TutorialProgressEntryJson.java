package io.mrkuhne.mezo.feature.tutorial.entity;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** One guide's seen-record inside the jsonb map — ISO-8601 strings, the service converts. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class TutorialProgressEntryJson {
    private Integer version;
    private String seenAt;
    private String completedAt;
    private Integer dismissedAtStep;
}
