import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

export const ImageManipulatorClient = {
  /**
   * Resizes to `longSide` on the long edge and re-encodes as JPEG at `quality`,
   * returning the base64 (no `data:` prefix).
   */
  async resizeAndCompress(base64: string, longSide: number, quality: number): Promise<string> {
    const uri = `data:image/jpeg;base64,${base64}`;
    const result = await manipulateAsync(uri, [{ resize: { width: longSide } }], {
      base64: true,
      compress: quality,
      format: SaveFormat.JPEG,
    });
    if (result.base64 === undefined) {
      throw new Error('ImageManipulatorClient: manipulation did not return base64 data');
    }
    return result.base64;
  },
};
