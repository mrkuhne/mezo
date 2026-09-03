package io.mrkuhne.mezo.feature.goal.engine.service;

import java.util.UUID;

/**
 * The goal engine's <b>consumer-owned port</b> for diet preferences (ADR 0012 — spec §6.2): the
 * goal slice needs the resolved diet split/protein-tier to prescribe segments, but the nutrition
 * slice must not become the one importing goal-engine types. Declaring the port here (goal owns
 * it, nutrition adapts to it) breaks the goal↔nutrition feature-slice cycle that a direct
 * {@code goal.engine.service → nutrition.service} import would otherwise create.
 */
public interface DietPreferencesPort {

    DietPreferences resolve(UUID userId);
}
