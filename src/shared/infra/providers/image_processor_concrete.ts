import { IImageProcessor } from '../../domain/interfaces/providers/image_processor';
import { ImageManipulatorClient } from '../../clients/image_manipulator_client';

const LONG_SIDE = 1600;
const MAX_BYTES = 1_048_576;
const QUALITY_START = 0.85;
const QUALITY_STEP = 0.1;
const QUALITY_FLOOR = 0.3;

function base64ByteLength(base64: string): number {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return (base64.length * 3) / 4 - padding;
}

export class ImageProcessorConcrete implements IImageProcessor {
  async compress(base64: string): Promise<string> {
    let quality = QUALITY_START;
    let result = await ImageManipulatorClient.resizeAndCompress(base64, LONG_SIDE, quality);

    while (base64ByteLength(result) > MAX_BYTES && quality > QUALITY_FLOOR) {
      quality = Math.max(QUALITY_FLOOR, quality - QUALITY_STEP);
      result = await ImageManipulatorClient.resizeAndCompress(base64, LONG_SIDE, quality);
    }

    return result;
  }
}
