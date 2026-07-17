import { isNative } from './index';

export async function scanReceipt(): Promise<string | null> {
  if (!isNative()) return null;

  try {
    const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
    const { TextRecognition } = await import('@capacitor-mlkit/text-recognition');

    const photo = await Camera.getPhoto({
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
      quality: 80,
      saveToGallery: false,
    });

    const path = photo.path ?? photo.webPath;
    if (!path) return null;

    try {
      const result = await TextRecognition.processImage({ path });
      return result.text || null;
    } finally {
      // The photo file is written to the app cache by Camera.getPhoto and is not
      // cleaned up automatically — delete it explicitly so it never lingers on disk.
      try {
        const { Filesystem } = await import('@capacitor/filesystem');
        await Filesystem.deleteFile({ path });
      } catch {
        // Best-effort cleanup — path may already be gone or use a scheme Filesystem can't address.
      }
    }
  } catch {
    return null;
  }
}
