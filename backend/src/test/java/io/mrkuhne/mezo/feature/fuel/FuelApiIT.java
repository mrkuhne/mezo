package io.mrkuhne.mezo.feature.fuel;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.IntakeListResponse;
import io.mrkuhne.mezo.api.dto.IntakeRequest;
import io.mrkuhne.mezo.api.dto.IntakeResponse;
import io.mrkuhne.mezo.api.dto.ProtocolActivateRequest;
import io.mrkuhne.mezo.api.dto.ProtocolItemCreateRequest;
import io.mrkuhne.mezo.api.dto.ProtocolItemPatchRequest;
import io.mrkuhne.mezo.api.dto.ProtocolItemResponse;
import io.mrkuhne.mezo.api.dto.ProtocolViewResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.fuel.entity.ProtocolItemEntity;
import io.mrkuhne.mezo.feature.fuel.repository.ProtocolItemRepository;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import io.mrkuhne.mezo.support.populator.ProtocolPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

/**
 * HTTP-level contract IT for the Fuel "Stack/Protocol" slice — drives the generated {@code FuelApi}
 * over the real stack. Proves the protocol round-trip (activate → read → re-activate bumps the
 * version), the intake ledger round-trip (log → per-day read → soft-delete), and the two error
 * contracts (unauthenticated → 401, empty selection → 400).
 */
class FuelApiIT extends ApiIntegrationTest {

    @Autowired private PantryItemPopulator pantryPop;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private ProtocolPopulator protocolPopulator;
    @Autowired private ProtocolItemRepository protocolItemRepository;

    /** Find-or-create yields the demodata-seeded owner's id — the principal behind ownerAuthHeaders(). */
    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void testProtocol_shouldRoundTripAndBumpVersion_whenActivatedTwice() {
        UUID owner = ownerId();
        PantryItemEntity s1 = pantryPop.createSupplement(owner, "Kreatin");

        // POST activates v1 from the supplement selection -> 201 + active.version == 1
        ProtocolViewResponse created = postForBody("/api/fuel/protocol",
            new ProtocolActivateRequest().selectedPantryItemIds(List.of(s1.getId())),
            ownerAuthHeaders(), HttpStatus.CREATED, ProtocolViewResponse.class);
        assertThat(created.getActive()).isNotNull();
        assertThat(created.getActive().getVersion()).isEqualTo(1);
        assertThat(created.getActive().getSelectedPantryItemIds()).containsExactly(s1.getId());

        // GET returns the same active v1
        ProtocolViewResponse fetched = getForBody("/api/fuel/protocol",
            ownerAuthHeaders(), HttpStatus.OK, ProtocolViewResponse.class);
        assertThat(fetched.getActive()).isNotNull();
        assertThat(fetched.getActive().getVersion()).isEqualTo(1);
        assertThat(fetched.getActive().getSelectedPantryItemIds()).containsExactly(s1.getId());

        // Second POST supersedes v1 and bumps to version 2
        PantryItemEntity s2 = pantryPop.createSupplement(owner, "Omega-3");
        ProtocolViewResponse reactivated = postForBody("/api/fuel/protocol",
            new ProtocolActivateRequest().selectedPantryItemIds(List.of(s1.getId(), s2.getId())),
            ownerAuthHeaders(), HttpStatus.CREATED, ProtocolViewResponse.class);
        assertThat(reactivated.getActive().getVersion()).isEqualTo(2);
        assertThat(reactivated.getActive().getSelectedPantryItemIds()).containsExactly(s1.getId(), s2.getId());
    }

    @Test
    void testIntake_shouldRoundTripLogListAndDelete_whenLoggedForToday() {
        UUID owner = ownerId();
        PantryItemEntity supp = pantryPop.createSupplement(owner, "Kreatin"); // dose "5g"
        LocalDate today = LocalDate.now();

        // POST logs one intake -> 201, dose snapshotted from the pantry item
        // FE-faithful request: the FE always sends an offset-bearing takenAt (nowOffsetIso),
        // which keeps the row on the LOCAL "today" this test lists (window-safe at 00-02h).
        IntakeResponse logged = postForBody("/api/fuel/intake",
            new IntakeRequest().pantryItemId(supp.getId()).takenAt(java.time.OffsetDateTime.now()),
            ownerAuthHeaders(), HttpStatus.CREATED, IntakeResponse.class);
        assertThat(logged.getId()).isNotNull();
        assertThat(logged.getPantryItemId()).isEqualTo(supp.getId());
        assertThat(logged.getDose()).isEqualTo("5g");

        // GET today's ledger -> exactly the one row
        IntakeListResponse list = getForBody("/api/fuel/intake/" + today,
            ownerAuthHeaders(), HttpStatus.OK, IntakeListResponse.class);
        assertThat(list.getIntakes()).hasSize(1);
        assertThat(list.getIntakes().get(0).getId()).isEqualTo(logged.getId());

        // DELETE soft-deletes the entry -> 204
        deleteAndExpect("/api/fuel/intake/entry/" + logged.getId(),
            ownerAuthHeaders(), HttpStatus.NO_CONTENT);

        // GET again -> ledger is empty
        IntakeListResponse afterDelete = getForBody("/api/fuel/intake/" + today,
            ownerAuthHeaders(), HttpStatus.OK, IntakeListResponse.class);
        assertThat(afterDelete.getIntakes()).isEmpty();
    }

    @Test
    void testGetProtocol_shouldReturn401_whenUnauthenticated() {
        // Security-layer 401s are produced by Spring Security's BearerTokenAuthenticationEntryPoint
        // BEFORE the dispatcher, so they carry no SystemMessage body by design — status-only is correct.
        ResponseEntity<String> res = exchangeForResponse(
            HttpMethod.GET, "/api/fuel/protocol", null, new HttpHeaders());
        assertThat(res.getStatusCode().value()).isEqualTo(401);
    }

    @Test
    void testActivateProtocol_shouldReturn400_whenSelectionEmpty() {
        ownerId();
        // Empty selection fails the contract's @Size(min=1) bean validation on the request body
        // (intercepted before the service), surfacing the FIELD SystemMessage contract as a 400.
        ResponseEntity<String> res = exchangeForResponse(HttpMethod.POST, "/api/fuel/protocol",
            new ProtocolActivateRequest().selectedPantryItemIds(List.of()), ownerAuthHeaders());
        assertThat(res.getStatusCode().value()).isEqualTo(400);
        assertHasFieldError(res.getBody(), "selectedPantryItemIds", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testAddProtocolItem_shouldEnginePlaceAndPersist_whenSlotKeyOmitted() {
        UUID owner = ownerId();
        var kreatin = pantryPop.createSupplement(owner, "Kreatin monohidrát");
        HttpHeaders auth = ownerAuthHeaders();
        ProtocolItemResponse created = postForBody("/api/fuel/protocol/items",
            new ProtocolItemCreateRequest().pantryItemId(kreatin.getId()),
            auth, HttpStatus.CREATED, ProtocolItemResponse.class);
        assertThat(created.getSlotKey()).isEqualTo("wake");
        assertThat(created.getPinned()).isFalse();
        assertThat(created.getPlacementSource()).hasToString("rule");
        assertThat(created.getDailyTotalHint()).contains("15–20g");
        ProtocolViewResponse view = getForBody("/api/fuel/protocol", auth, HttpStatus.OK, ProtocolViewResponse.class);
        assertThat(view.getActive().getItems()).hasSize(1);
    }

    @Test
    void testAddProtocolItem_shouldPinUserPlacement_whenSlotKeyGiven() {
        UUID owner = ownerId();
        var kreatin = pantryPop.createSupplement(owner, "Kreatin monohidrát");
        HttpHeaders auth = ownerAuthHeaders();
        ProtocolItemResponse created = postForBody("/api/fuel/protocol/items",
            new ProtocolItemCreateRequest().pantryItemId(kreatin.getId()).slotKey("evening"),
            auth, HttpStatus.CREATED, ProtocolItemResponse.class);
        assertThat(created.getSlotKey()).isEqualTo("evening");
        assertThat(created.getPinned()).isTrue();
        assertThat(created.getPlacementSource()).hasToString("user");
        assertThat(created.getPlacementReason()).isNotBlank();
    }

    @Test
    void testAddProtocolItem_shouldReturn409_whenDuplicateZoneOccurrence() {
        UUID owner = ownerId();
        var kreatin = pantryPop.createSupplement(owner, "Kreatin monohidrát");
        HttpHeaders auth = ownerAuthHeaders();
        // First add lands on 'wake' via the rule table (no slotKey given).
        postForBody("/api/fuel/protocol/items", new ProtocolItemCreateRequest().pantryItemId(kreatin.getId()),
            auth, HttpStatus.CREATED, ProtocolItemResponse.class);
        // Second add for the SAME item, again engine-placed -> lands on 'wake' again -> 409.
        ResponseEntity<String> res = exchangeForResponse(HttpMethod.POST, "/api/fuel/protocol/items",
            new ProtocolItemCreateRequest().pantryItemId(kreatin.getId()), auth);
        assertThat(res.getStatusCode().value()).isEqualTo(409);
        assertHasRequestError(res.getBody(), "FUEL_PROTOCOL_ITEM_DUPLICATE");
    }

    @Test
    void testPatchProtocolItem_shouldMoveAndPin_whenSlotKeyPatched() {
        UUID owner = ownerId();
        var kreatin = pantryPop.createSupplement(owner, "Kreatin monohidrát");
        HttpHeaders auth = ownerAuthHeaders();
        ProtocolItemResponse created = postForBody("/api/fuel/protocol/items",
            new ProtocolItemCreateRequest().pantryItemId(kreatin.getId()),
            auth, HttpStatus.CREATED, ProtocolItemResponse.class);
        ProtocolItemResponse patched = patchForBody("/api/fuel/protocol/items/" + created.getId(),
            new ProtocolItemPatchRequest().slotKey("lunch"),
            auth, HttpStatus.OK, ProtocolItemResponse.class);
        assertThat(patched.getSlotKey()).isEqualTo("lunch");
        assertThat(patched.getPinned()).isTrue();
        assertThat(patched.getPlacementSource()).hasToString("user");
    }

    @Test
    void testPatchProtocolItem_shouldReplaceViaEngine_whenUnpinned() {
        UUID owner = ownerId();
        var kreatin = pantryPop.createSupplement(owner, "Kreatin monohidrát");
        HttpHeaders auth = ownerAuthHeaders();
        // Pin it away from its rule-table home ('wake') first.
        ProtocolItemResponse created = postForBody("/api/fuel/protocol/items",
            new ProtocolItemCreateRequest().pantryItemId(kreatin.getId()).slotKey("lunch"),
            auth, HttpStatus.CREATED, ProtocolItemResponse.class);
        assertThat(created.getPinned()).isTrue();
        ProtocolItemResponse patched = patchForBody("/api/fuel/protocol/items/" + created.getId(),
            new ProtocolItemPatchRequest().pinned(false),
            auth, HttpStatus.OK, ProtocolItemResponse.class);
        assertThat(patched.getSlotKey()).isEqualTo("wake");
        assertThat(patched.getPinned()).isFalse();
        assertThat(patched.getPlacementSource()).hasToString("rule");
    }

    @Test
    void testDeleteProtocolItem_shouldSoftDelete_whenOwned() {
        UUID owner = ownerId();
        var kreatin = pantryPop.createSupplement(owner, "Kreatin monohidrát");
        HttpHeaders auth = ownerAuthHeaders();
        ProtocolItemResponse created = postForBody("/api/fuel/protocol/items",
            new ProtocolItemCreateRequest().pantryItemId(kreatin.getId()),
            auth, HttpStatus.CREATED, ProtocolItemResponse.class);
        deleteAndExpect("/api/fuel/protocol/items/" + created.getId(), auth, HttpStatus.NO_CONTENT);
        ProtocolViewResponse view = getForBody("/api/fuel/protocol", auth, HttpStatus.OK, ProtocolViewResponse.class);
        assertThat(view.getActive().getItems()).isEmpty();
    }

    @Test
    void testGetProtocol_shouldBackfillLegacyItems_whenSlotKeyNull() {
        UUID owner = ownerId();
        var kreatin = pantryPop.createSupplement(owner, "Kreatin monohidrát");
        // Legacy shape: a protocol_item row with no slot_key (pre-mezo-vx9v).
        var protocol = protocolPopulator.createProtocol(owner, 1, "active", List.of(kreatin.getId()));
        HttpHeaders auth = ownerAuthHeaders();

        ProtocolViewResponse first = getForBody("/api/fuel/protocol", auth, HttpStatus.OK, ProtocolViewResponse.class);
        assertThat(first.getActive().getItems()).hasSize(1);
        assertThat(first.getActive().getItems().get(0).getSlotKey()).isEqualTo("wake");
        assertThat(first.getActive().getItems().get(0).getPlacementSource()).hasToString("rule");

        // Persisted, not just re-derived on read: the DB row itself now carries the backfilled zone.
        List<ProtocolItemEntity> persisted =
            protocolItemRepository.findByProtocolIdAndDeletedFalseOrderByItemOrderAsc(protocol.getId());
        assertThat(persisted).singleElement().satisfies(item -> {
            assertThat(item.getSlotKey()).isEqualTo("wake");
            assertThat(item.getPlacementSource()).isEqualTo("rule");
        });

        // Second GET returns the same result (would still match if re-derived, since the engine is
        // deterministic — the DB assertion above is what actually proves persistence-not-rederivation).
        ProtocolViewResponse second = getForBody("/api/fuel/protocol", auth, HttpStatus.OK, ProtocolViewResponse.class);
        assertThat(second.getActive().getItems().get(0).getSlotKey()).isEqualTo("wake");
    }
}
