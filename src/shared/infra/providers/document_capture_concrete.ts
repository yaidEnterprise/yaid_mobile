import { IDocumentCapture } from '../../domain/interfaces/providers/document_capture';
import type { CameraView } from 'expo-camera';

export class DocumentCaptureConcrete implements IDocumentCapture {
  private cameraRef: CameraView | null = null;

  setCameraRef(ref: CameraView | null): void {
    this.cameraRef = ref;
  }

  async capture(): Promise<string> {
    if (this.cameraRef === null) {
      throw new Error('DocumentCaptureConcrete: camera is not ready');
    }
    const picture = await this.cameraRef.takePictureAsync({ base64: true });
    if (picture?.base64 === undefined) {
      throw new Error('DocumentCaptureConcrete: capture did not return base64 data');
    }
    return picture.base64;
  }
}
