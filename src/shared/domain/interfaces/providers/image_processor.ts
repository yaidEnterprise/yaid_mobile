export interface IImageProcessor {
  /**
   * Returns a base64 JPEG string guaranteed to be <= 1_048_576 bytes,
   * resized to at most 1600px on the long side.
   */
  compress(base64: string): Promise<string>;
}
