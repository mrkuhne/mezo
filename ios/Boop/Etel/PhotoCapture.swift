import PhotosUI
import SwiftUI
import UIKit

/// Where a meal's photo can come from. The library picker runs out of process and needs no permission; the camera
/// needs the app's camera usage text, so it is offered only when the build carries it (and the device has a camera).
enum PhotoCapture {
    static var cameraAvailable: Bool {
        UIImagePickerController.isSourceTypeAvailable(.camera)
            && Bundle.main.object(forInfoDictionaryKey: "NSCameraUsageDescription") != nil
    }
}

/// The system camera, one shot. The picture comes back as encoded bytes; the caller shrinks it.
struct CameraPicker: UIViewControllerRepresentable {
    let onPick: (Data) -> Void
    let onCancel: () -> Void

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.delegate = context.coordinator
        return picker
    }
    func updateUIViewController(_ controller: UIImagePickerController, context: Context) {}
    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: CameraPicker
        init(_ parent: CameraPicker) { self.parent = parent }
        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            if let image = info[.originalImage] as? UIImage, let data = image.jpegData(compressionQuality: 0.9) { parent.onPick(data) }
            else { parent.onCancel() }
        }
        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) { parent.onCancel() }
    }
}

extension View {
    /// The photo library as a sheet; `onPick` gets the chosen picture's bytes (nil when it could not be read).
    func mealPhotoLibrary(isPresented: Binding<Bool>, onPick: @escaping (Data?) -> Void) -> some View {
        modifier(MealPhotoLibrary(isPresented: isPresented, onPick: onPick))
    }
}

private struct MealPhotoLibrary: ViewModifier {
    @Binding var isPresented: Bool
    let onPick: (Data?) -> Void
    @State private var item: PhotosPickerItem?

    func body(content: Content) -> some View {
        content
            .photosPicker(isPresented: $isPresented, selection: $item, matching: .images)
            .onChange(of: item) { _, chosen in
                guard let chosen else { return }
                item = nil
                Task { onPick(try? await chosen.loadTransferable(type: Data.self)) }
            }
    }
}
