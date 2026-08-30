package io.mrkuhne.mezo.feature.character.detector;

import java.util.List;

/** Pure-code signal detector (spec §5). Stateless; returns 0..n signals for the input day. */
public interface CharacterDetector {
    String key();
    List<DetectorSignal> detect(DetectorInput input);
}
