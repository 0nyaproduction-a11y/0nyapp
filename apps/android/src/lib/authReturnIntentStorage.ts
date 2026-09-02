import * as SecureStore from "expo-secure-store";
import {
  AUTH_RETURN_INTENT_KEY,
  parseAuthReturnIntent,
  resolveReturnRoutes,
  serializeAuthReturnIntent,
  type AuthReturnIntent,
  type ReturnNavigationState,
  type ReturnRoute,
} from "./authReturnIntent";

export type { AuthReturnIntent, ReturnNavigationState, ReturnRoute };
export { AUTH_RETURN_INTENT_KEY, resolveReturnRoutes, serializeAuthReturnIntent, parseAuthReturnIntent };

async function setAuthReturnIntent(intent: AuthReturnIntent | null): Promise<void> {
  if (intent === null) {
    await SecureStore.deleteItemAsync(AUTH_RETURN_INTENT_KEY);
    return;
  }

  await SecureStore.setItemAsync(AUTH_RETURN_INTENT_KEY, serializeAuthReturnIntent(intent));
}

export async function getAuthReturnIntent(): Promise<AuthReturnIntent | null> {
  const raw = await SecureStore.getItemAsync(AUTH_RETURN_INTENT_KEY);
  return parseAuthReturnIntent(raw);
}

export async function clearAuthReturnIntent(): Promise<void> {
  await setAuthReturnIntent(null);
}

export async function consumeAuthReturnIntent(): Promise<AuthReturnIntent | null> {
  const intent = await getAuthReturnIntent();
  await clearAuthReturnIntent();
  return intent;
}

export async function navigateToSignIn(navigate: () => void, intent?: AuthReturnIntent): Promise<void> {
  await setAuthReturnIntent(intent ?? null);
  navigate();
}
