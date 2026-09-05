import * as FileSystem from 'expo-file-system/legacy';

export const FileSystemClient = {
  documentDirectory(): string {
    return FileSystem.documentDirectory ?? '';
  },
  async readAsString(fileUri: string): Promise<string> {
    return FileSystem.readAsStringAsync(fileUri);
  },
  async writeAsString(fileUri: string, contents: string): Promise<void> {
    await FileSystem.writeAsStringAsync(fileUri, contents);
  },
  async delete(fileUri: string): Promise<void> {
    await FileSystem.deleteAsync(fileUri, { idempotent: true });
  },
  async exists(fileUri: string): Promise<boolean> {
    const info = await FileSystem.getInfoAsync(fileUri);
    return info.exists;
  },
};
