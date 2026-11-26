package io.mrkuhne.mezo.feature.capacity.port;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Capacity's write seam into train's planned-skip path (Boop B7 K3, mezo-r36n9.17; consumer-owned port, the adapter
 * calls train's service — train never imports capacity). An accepted {@code SKIP_SESSION} step becomes an ordinary
 * planned gym skip with reason {@code KAPACITAS}, so every train reader already honours it.
 */
public interface CapacitySkipPort {

    /** The gym day already carries a skip of any reason. */
    boolean gymSkipped(UUID owner, LocalDate date);

    /** Files a gym skip with reason {@code KAPACITAS} on {@code date} (inside the caller's transaction); its id. */
    UUID skipGym(UUID owner, LocalDate date);

    /** Removes that skip again (undo); a skip already gone is not an error. */
    void undoSkip(UUID owner, UUID skipId);
}
