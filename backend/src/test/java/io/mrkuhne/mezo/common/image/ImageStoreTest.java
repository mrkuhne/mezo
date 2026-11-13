package io.mrkuhne.mezo.common.image;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.mrkuhne.mezo.common.image.entity.StoredImageEntity;
import io.mrkuhne.mezo.common.image.repository.StoredImageRepository;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.Optional;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

/** Pure unit test (no Spring): the repository is a stub, validation + round trip are the subject. */
class ImageStoreTest {

    private final UUID owner = UUID.randomUUID();
    private final StoredImageRepository repository = mock(StoredImageRepository.class);
    private final ImageStore store = new ImageStore(repository);

    private static byte[] image(String format, int w, int h) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB), format, out);
        return out.toByteArray();
    }

    @Test
    void rejectsNonImageContentType() throws Exception {
        byte[] png = image("png", 4, 4);
        assertThatThrownBy(() -> store.put(owner, png, "application/pdf"))
            .isInstanceOfSatisfying(SystemRuntimeErrorException.class,
                e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void rejectsBytesThatAreNotTheDeclaredImage() {
        byte[] notAnImage = "<html>definitely not a picture</html>".getBytes();
        assertThatThrownBy(() -> store.put(owner, notAnImage, "image/jpeg"))
            .isInstanceOfSatisfying(SystemRuntimeErrorException.class,
                e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void rejectsOverTheCap() {
        byte[] huge = new byte[ImageStore.MAX_BYTES + 1];
        assertThatThrownBy(() -> store.put(owner, huge, "image/jpeg"))
            .isInstanceOfSatisfying(SystemRuntimeErrorException.class,
                e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void roundTripsBytes() throws Exception {
        byte[] jpeg = image("jpg", 32, 16);
        UUID id = UUID.randomUUID();
        StoredImageEntity[] saved = new StoredImageEntity[1];
        when(repository.save(any())).thenAnswer(inv -> {
            StoredImageEntity e = inv.getArgument(0);
            e.setId(id);
            saved[0] = e;
            return e;
        });
        when(repository.findByIdAndCreatedBy(id, owner)).thenAnswer(inv -> Optional.ofNullable(saved[0]));

        StoredImage put = store.put(owner, jpeg, "image/jpeg");
        assertThat(put.id()).isEqualTo(id);
        assertThat(put.width()).isEqualTo(32);
        assertThat(put.height()).isEqualTo(16);

        StoredImage got = store.get(owner, id).orElseThrow();
        assertThat(got.bytes()).isEqualTo(jpeg);
        assertThat(got.contentType()).isEqualTo("image/jpeg");
        assertThat(store.get(UUID.randomUUID(), id)).isEmpty();
    }
}
