import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Screen } from "../components/Screen";
import { Body, Button, Card, ErrorText, Field, Label, RecoveryState } from "../components/ui";
import {
  clearParentalSessionUnlock,
  getParentalScope,
  isParentalSessionUnlocked,
  loadParentalControls,
  markParentalSessionUnlocked,
  setParentalPin,
  verifyParentalPin,
} from "../lib/parentalControls";
import { useAuth } from "../lib/authContext";
import type { RootStackParamList } from "../navigation/types";
import { colors } from "../theme/tokens";

type Props = NativeStackScreenProps<RootStackParamList, "ParentalControls">;

type FlowMode = "unlock" | "manage";

function normalizePin(value: string) {
  return value.replace(/\D/g, "").slice(0, 4);
}

export function ParentalControlsScreen({ navigation, route }: Props) {
  const { session } = useAuth();
  const scope = useMemo(() => getParentalScope(session), [session]);
  const mode: FlowMode = route.params.mode;
  const target = route.params.target;
  const [hasPin, setHasPin] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isUnlockedForManage, setIsUnlockedForManage] = useState(false);

  const isSessionUnlocked = isParentalSessionUnlocked(scope);

  const loadState = useCallback(async () => {
    const status = await loadParentalControls(session);
    setHasPin(status.hasPin);
    setLockedUntil(status.lockedUntil);
    setFailedAttempts(status.failedAttempts);
    setIsUnlockedForManage(status.hasPin ? isSessionUnlocked : true);
  }, [isSessionUnlocked, session]);

  useEffect(() => {
    void (async () => {
      try {
        await loadState();
      } catch {
        setError("We couldn't load this right now.");
      }
    })();
  }, [loadState]);

  const showUnlockForm = mode === "unlock" && hasPin;
  const showManageActions = mode === "manage" && hasPin && isUnlockedForManage;
  const statusBody = hasPin
    ? `PIN is set. Failed attempts: ${failedAttempts}.`
    : "No PIN is set yet.";

  async function handleSubmit() {
    const pin = normalizePin(newPin);
    const confirm = normalizePin(confirmPin);
    const current = normalizePin(currentPin);

    if (showUnlockForm) {
      if (!current) {
        setError("Enter your current 4-digit PIN.");
        return;
      }

      setIsBusy(true);
      setError(null);
      setMessage(null);

      try {
        const result = await verifyParentalPin(session, current);

        if (!result.success) {
          if (result.status === "locked") {
            setError("Please try again later.");
          } else {
            setError("That PIN didn't work.");
          }
          setLockedUntil(result.lockedUntil);
          setFailedAttempts(result.failedAttempts);
          return;
        }

        if (!result.parentalSessionToken || !result.expiresAt) {
          setError("We couldn't verify this right now.");
          return;
        }

        markParentalSessionUnlocked(scope, {
          expiresAt: result.expiresAt,
          parentalSessionToken: result.parentalSessionToken,
        });

        if (target) {
          navigation.replace(target.screen, target.params as never);
          return;
        }

        navigation.goBack();
      } catch {
        setError("We couldn't verify this right now.");
      } finally {
        setIsBusy(false);
      }

      return;
    }

    if (!pin || !confirm || pin !== confirm) {
      setError("Enter the same 4-digit PIN twice.");
      return;
    }

    if (mode === "manage" && hasPin && !current && !session?.user?.last_sign_in_at) {
      setError("Sign in again or enter your current PIN.");
      return;
    }

    setIsBusy(true);
    setError(null);
    setMessage(null);

    try {
      const result = await setParentalPin(session, pin, currentPin || undefined);

      if (!result.success) {
        if (result.status === "reauth_required") {
          setError("Sign in again to reset your PIN.");
        } else if (result.status === "locked") {
          setError("Please try again later.");
        } else if (result.status === "wrong_pin") {
          setError("That PIN didn't work.");
        } else {
          setError("We couldn't save this right now.");
        }

        setLockedUntil(result.lockedUntil);
        setFailedAttempts(result.failedAttempts);
        return;
      }

      if (!result.parentalSessionToken || !result.expiresAt) {
        setError("We couldn't save this right now.");
        return;
      }

      markParentalSessionUnlocked(scope, {
        expiresAt: result.expiresAt,
        parentalSessionToken: result.parentalSessionToken,
      });
      setHasPin(true);
      setLockedUntil(null);
      setFailedAttempts(0);
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      setMessage(mode === "unlock" ? "PIN saved." : "PIN updated.");

      if (target) {
        navigation.replace(target.screen, target.params as never);
        return;
      }

      setIsUnlockedForManage(true);
    } catch {
      setError("We couldn't save this right now.");
    } finally {
      setIsBusy(false);
    }
  }

  function handleRelock() {
    clearParentalSessionUnlock(scope);
    setIsUnlockedForManage(false);
    setMessage("This app session is locked again.");
  }

  async function handleRefresh() {
    setError(null);
    setMessage(null);

    try {
      await loadState();
    } catch {
      setError("We couldn't load this right now.");
    }
  }

  if (mode === "unlock" && !hasPin) {
    return (
      <Screen>
        <RecoveryState
          body="Set up parental controls from Settings before using a content gate."
          onPrimaryAction={() => navigation.goBack()}
          primaryActionLabel="Back"
          title="Parental access unavailable"
        />
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.stack}>
            <Card>
              <Label>{mode === "unlock" ? "Parental access" : "Manage PIN"}</Label>
              <Body>This content requires parental access.</Body>
              <Body>{statusBody}</Body>
              {lockedUntil ? <Body>{`Locked until ${lockedUntil}`}</Body> : null}

              {showUnlockForm ? (
                <>
                  <Field
                    accessibilityLabel="Current parental PIN"
                    autoCapitalize="none"
                    keyboardType="number-pad"
                    maxLength={4}
                    onChangeText={(value) => setCurrentPin(normalizePin(value))}
                    placeholder="Enter PIN"
                    secureTextEntry
                    textContentType="oneTimeCode"
                    value={currentPin}
                  />
                  <Button accessibilityLabel="Verify PIN" disabled={isBusy} onPress={() => void handleSubmit()}>
                    {isBusy ? "Verifying" : "Verify"}
                  </Button>
                </>
              ) : (
                <>
                  <Field
                    accessibilityLabel="New parental PIN"
                    autoCapitalize="none"
                    keyboardType="number-pad"
                    maxLength={4}
                    onChangeText={(value) => setNewPin(normalizePin(value))}
                    placeholder="New PIN"
                    secureTextEntry
                    textContentType="oneTimeCode"
                    value={newPin}
                  />
                  <Field
                    accessibilityLabel="Confirm parental PIN"
                    autoCapitalize="none"
                    keyboardType="number-pad"
                    maxLength={4}
                    onChangeText={(value) => setConfirmPin(normalizePin(value))}
                    placeholder="Confirm PIN"
                    secureTextEntry
                    textContentType="oneTimeCode"
                    value={confirmPin}
                  />
                  {mode === "manage" && hasPin ? (
                    <Field
                      accessibilityLabel="Current parental PIN"
                      autoCapitalize="none"
                      keyboardType="number-pad"
                      maxLength={4}
                      onChangeText={(value) => setCurrentPin(normalizePin(value))}
                      placeholder="Current PIN or sign in again"
                      secureTextEntry
                      textContentType="oneTimeCode"
                      value={currentPin}
                    />
                  ) : null}
                  <Button accessibilityLabel="Save PIN" disabled={isBusy} onPress={() => void handleSubmit()}>
                    {isBusy ? "Saving" : hasPin ? "Change PIN" : "Set PIN"}
                  </Button>
                </>
              )}

              {showManageActions ? (
                <>
                  <Button accessibilityLabel="Re-lock now" onPress={handleRelock}>
                    Re-lock now
                  </Button>
                  <Button accessibilityLabel="Refresh parental controls" onPress={() => void handleRefresh()}>
                    Refresh
                  </Button>
                </>
              ) : null}
              <Pressable
                accessibilityLabel="Cancel parental controls"
                accessibilityRole="button"
                onPress={() => navigation.goBack()}
                style={({ pressed }) => [styles.textAction, pressed && styles.textActionPressed]}
              >
                <Text style={styles.textActionText}>Cancel</Text>
              </Pressable>
            </Card>

            {message ? (
              <RecoveryState
                body={message}
                primaryActionLabel="OK"
                onPrimaryAction={() => setMessage(null)}
                title="Done"
              />
            ) : null}
            {error ? <ErrorText>{error}</ErrorText> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
  },
  flex: {
    flex: 1,
  },
  stack: {
    gap: 18,
  },
  textAction: {
    alignSelf: "flex-start",
    paddingVertical: 6,
  },
  textActionPressed: {
    opacity: 0.72,
  },
  textActionText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
  },
});
