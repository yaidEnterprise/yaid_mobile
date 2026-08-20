export interface IDocumentCapture {
  /**
   * Returns the captured image as a base64 string without a `data:` prefix.
   * Throws if the camera is unavailable.
   */
  capture(): Promise<string>;
}
