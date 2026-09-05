import { IImageProcessor } from '../../../domain/interfaces/providers/image_processor';

export class ImageProcessorMock implements IImageProcessor {
  async compress(base64: string): Promise<string> {
    return base64;
  }
}
