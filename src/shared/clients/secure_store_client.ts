import * as SecureStore from 'expo-secure-store';

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export const SecureStoreClient = {
  async getItem(key: string): Promise<string | null> {
    return SecureStore.getItemAsync(key, OPTIONS);
  },
  async setItem(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(key, value, OPTIONS);
  },
  async deleteItem(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key, OPTIONS);
  },
};
