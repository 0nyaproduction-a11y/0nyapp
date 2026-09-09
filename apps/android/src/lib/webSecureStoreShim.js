const storage = new Map();

export async function getItemAsync(key) {
  return storage.get(key) ?? null;
}

export async function setItemAsync(key, value) {
  storage.set(key, value);
}

export async function deleteItemAsync(key) {
  storage.delete(key);
}

export function isAvailableAsync() {
  return Promise.resolve(false);
}
