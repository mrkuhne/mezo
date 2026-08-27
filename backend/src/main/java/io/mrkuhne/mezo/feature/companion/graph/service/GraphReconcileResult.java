package io.mrkuhne.mezo.feature.companion.graph.service;

/**
 * What one {@link GraphPromotionService#reconcile} sweep did (bd mezo-b3pp.31). Promotion used to
 * be one-way, so a plain upsert count was the whole story; now the sweep also walks the
 * COMPLEMENT sets — active nodes whose source row stopped qualifying — and archives them, and
 * those two numbers must not be summed into one meaningless total.
 *
 * @param upserted  nodes created or refreshed from a source row that still qualifies
 * @param retracted active nodes archived because their source row no longer qualifies
 */
public record GraphReconcileResult(int upserted, int retracted) {
}
