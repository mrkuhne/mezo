package io.mrkuhne.mezo.feature.train.service;

import java.util.UUID;

/**
 * A manual weekly review of a run that opts in to the technique planner was just built and waits (T4,
 * {@code mezo-r36n9.82}); {@link TechniqueAiRefiner} picks it up after the commit.
 */
public record TechniqueRefineRequested(UUID createdBy, UUID proposalId) {}
