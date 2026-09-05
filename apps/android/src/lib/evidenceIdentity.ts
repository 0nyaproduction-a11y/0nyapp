export function createEvidenceUuid() {
  return globalThis.crypto?.randomUUID?.() ?? "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    return (character === "x" ? random : (random & 0x3) | 0x8).toString(16);
  });
}

const discoverySessionId = createEvidenceUuid();

export function getEvidenceSessionId() {
  return discoverySessionId;
}
