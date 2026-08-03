package io.mrkuhne.mezo.feature.fuel;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.ProtocolItemCreateRequest;
import io.mrkuhne.mezo.api.dto.ProtocolItemPatchRequest;
import io.mrkuhne.mezo.api.dto.ProtocolItemResponse;
import io.mrkuhne.mezo.api.dto.ProtocolResponse;
import io.mrkuhne.mezo.api.dto.ProtocolViewResponse;
import io.mrkuhne.mezo.feature.fuel.service.ProtocolService;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class ProtocolServiceIT extends AbstractIntegrationTest {

    @Autowired ProtocolService service;
    @Autowired PantryItemPopulator pantryPop;
    @Autowired DatabasePopulator databasePopulator;

    UUID owner;
    UUID other;

    @BeforeEach
    void setUp() {
        owner = databasePopulator.populateUser("a@test.local");
        other = databasePopulator.populateUser("b@test.local");
    }

    @Test
    void testGetView_shouldReturnEmptyActive_whenNoProtocol() {
        ProtocolViewResponse view = service.getView(owner);

        assertThat(view.getActive()).isNull();
        assertThat(view.getHistory()).isEmpty();
    }

    @Test
    void testTouch_shouldBumpProtocolVersionAndBuiltAt_whenItemAddedPatchedAndDeleted() {
        assertThat(service.getView(owner).getActive()).isNull(); // nothing yet
        PantryItemEntity s1 = pantryPop.createSupplement(owner, "Kreatin monohidrát");

        // addItem lazily creates the living protocol (ensureActive) AND touches it once more for
        // the write itself — the exact starting number is an ensureActive/touch implementation
        // detail; what matters (and is asserted below) is that patch/delete each bump by exactly 1.
        ProtocolItemResponse added = service.addItem(owner, new ProtocolItemCreateRequest().pantryItemId(s1.getId()));
        ProtocolResponse afterAdd = service.getView(owner).getActive();
        assertThat(afterAdd.getVersion()).isGreaterThanOrEqualTo(1);

        ProtocolItemResponse patched = service.patchItem(owner, added.getId(),
            new ProtocolItemPatchRequest().dose("3g"));
        ProtocolResponse afterPatch = service.getView(owner).getActive();
        assertThat(afterPatch.getVersion()).isEqualTo(afterAdd.getVersion() + 1);
        assertThat(afterPatch.getBuiltAt()).isAfterOrEqualTo(afterAdd.getBuiltAt());

        service.deleteItem(owner, patched.getId());
        ProtocolResponse afterDelete = service.getView(owner).getActive();
        assertThat(afterDelete.getVersion()).isEqualTo(afterPatch.getVersion() + 1);
        assertThat(afterDelete.getBuiltAt()).isAfterOrEqualTo(afterPatch.getBuiltAt());
    }

    @Test
    void testPatchItem_shouldPreserveSlotKeyPinnedAndSource_whenOnlyDosePatched() {
        PantryItemEntity s1 = pantryPop.createSupplement(owner, "Kreatin monohidrát");
        ProtocolItemResponse added = service.addItem(owner,
            new ProtocolItemCreateRequest().pantryItemId(s1.getId()).slotKey("evening"));

        ProtocolItemResponse patched = service.patchItem(owner, added.getId(),
            new ProtocolItemPatchRequest().dose("3g"));

        assertThat(patched.getDose()).isEqualTo("3g");
        assertThat(patched.getSlotKey()).isEqualTo("evening");
        assertThat(patched.getPinned()).isTrue();
        assertThat(patched.getPlacementSource()).isEqualTo(ProtocolItemResponse.PlacementSourceEnum.USER);
    }

    @Test
    void testPatchItem_shouldReject_whenPinnedFalseWithSlotKeyGiven() {
        PantryItemEntity s1 = pantryPop.createSupplement(owner, "Kreatin monohidrát");
        ProtocolItemResponse added = service.addItem(owner, new ProtocolItemCreateRequest().pantryItemId(s1.getId()));

        assertThatThrownBy(() -> service.patchItem(owner, added.getId(),
            new ProtocolItemPatchRequest().slotKey("lunch").pinned(false)))
            .isInstanceOfSatisfying(SystemRuntimeErrorException.class, ex -> {
                assertThat(ex.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                assertThat(ex.getMessages()).singleElement().satisfies(m -> {
                    assertThat(m.getCode()).isEqualTo("VALIDATION_INVALID_VALUE");
                    assertThat(m.getFieldName()).isEqualTo("pinned");
                });
            });
    }

    @Test
    void testPatchItem_shouldReject_whenItemBelongsToAnotherProtocol() {
        PantryItemEntity mine = pantryPop.createSupplement(owner, "Kreatin monohidrát");
        service.addItem(owner, new ProtocolItemCreateRequest().pantryItemId(mine.getId()));
        PantryItemEntity theirs = pantryPop.createSupplement(other, "Magnezium");
        ProtocolItemResponse foreignItem = service.addItem(other, new ProtocolItemCreateRequest().pantryItemId(theirs.getId()));

        assertThatThrownBy(() -> service.patchItem(owner, foreignItem.getId(), new ProtocolItemPatchRequest().dose("1g")))
            .isInstanceOfSatisfying(SystemRuntimeErrorException.class, ex -> {
                assertThat(ex.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
                assertThat(ex.getMessages()).singleElement().satisfies(m ->
                    assertThat(m.getCode()).isEqualTo("RESOURCE_NOT_FOUND"));
            });
    }

    @Test
    void testDeleteItem_shouldReject_whenItemBelongsToAnotherProtocol() {
        PantryItemEntity mine = pantryPop.createSupplement(owner, "Kreatin monohidrát");
        service.addItem(owner, new ProtocolItemCreateRequest().pantryItemId(mine.getId()));
        PantryItemEntity theirs = pantryPop.createSupplement(other, "Magnezium");
        ProtocolItemResponse foreignItem = service.addItem(other, new ProtocolItemCreateRequest().pantryItemId(theirs.getId()));

        assertThatThrownBy(() -> service.deleteItem(owner, foreignItem.getId()))
            .isInstanceOfSatisfying(SystemRuntimeErrorException.class, ex -> {
                assertThat(ex.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
                assertThat(ex.getMessages()).singleElement().satisfies(m ->
                    assertThat(m.getCode()).isEqualTo("RESOURCE_NOT_FOUND"));
            });
    }

    @Test
    void testAddItem_shouldReject_whenItemIsFoodKind() {
        PantryItemEntity food = pantryPop.createFood(owner, "Csirkemell", LocalDate.now().plusDays(3));

        assertThatThrownBy(() -> service.addItem(owner, new ProtocolItemCreateRequest().pantryItemId(food.getId())))
            .isInstanceOfSatisfying(SystemRuntimeErrorException.class, ex -> {
                assertThat(ex.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                assertThat(ex.getMessages()).singleElement().satisfies(m -> {
                    assertThat(m.getCode()).isEqualTo("VALIDATION_INVALID_VALUE");
                    assertThat(m.getFieldName()).isEqualTo("pantryItemId");
                });
            });
    }

    // mezo-vx9v Task 10: the retired whole-selection `activate` had its own inline foreign/missing
    // check; `addItem`'s equivalent (`requireOwnedSupplement`) had no dedicated test of its own —
    // this closes that gap now that `activate` is gone.
    @Test
    void testAddItem_shouldReject_whenItemForeignOrMissing() {
        PantryItemEntity foreign = pantryPop.createSupplement(other, "Magnezium");

        assertThatThrownBy(() -> service.addItem(owner, new ProtocolItemCreateRequest().pantryItemId(foreign.getId())))
            .isInstanceOfSatisfying(SystemRuntimeErrorException.class, ex -> {
                assertThat(ex.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
                assertThat(ex.getMessages()).singleElement().satisfies(m ->
                    assertThat(m.getCode()).isEqualTo("RESOURCE_NOT_FOUND"));
            });
    }
}
