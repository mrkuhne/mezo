package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.PrescribedSet;
import java.util.List;

/** The engine output for one exercise: the ordered prescribed sets + a short HU rationale. */
public record Prescription(List<PrescribedSet> sets, String rationale) {}
