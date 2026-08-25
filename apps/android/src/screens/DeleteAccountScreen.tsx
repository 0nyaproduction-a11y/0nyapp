import { useState } from "react";
import { CommonActions } from "@react-navigation/native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "../components/Screen";
import { Body, Card, ErrorText, Label, Title } from "../components/ui";
import { deleteAccount } from "../lib/api";
import { supabase } from "../lib/supabase";
import { borders, colors } from "../theme/tokens";
import { useAuth } from "../lib/authContext";
import type { ProfileStackScreenProps } from "../navigation/types";

type Props = ProfileStackScreenProps<"DeleteAccount">;

export function DeleteAccountScreen({ navigation }: Props) {
  const { session } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const token = session?.access_token ?? null;

  async function handleDelete() {
    if (!token || isDeleting) {
      return;
    }

    setError(null);
    setIsDeleting(true);

    try {
      await deleteAccount(token);
      await supabase.auth.signOut({ scope: "local" });
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: "Account" }],
        }),
      );
      navigation.getParent()?.navigate("Home");
    } catch {
      setError("We couldn't delete your account right now.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Screen>
      <Title>Delete your 0nya account?</Title>

      <Card>
        <Label>Destructive</Label>
        <Body>
          This will remove account access and associated 0nya data. Some transaction or payment
          records may be retained where required.
        </Body>
        <Body>Registered users only.</Body>
      </Card>

      <Card>
        <Label>Confirm</Label>
        <Body>
          Cancel is always safe. Deletion cannot be undone after the server confirms it.
        </Body>
        <View style={styles.actions}>
          <Pressable
            accessibilityLabel="Cancel delete account"
            accessibilityRole="button"
            disabled={isDeleting}
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.cancelButton, pressed && styles.cancelButtonPressed]}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Delete account permanently"
            accessibilityRole="button"
            disabled={isDeleting || !token}
            onPress={() => void handleDelete()}
            style={({ pressed }) => [
              styles.deleteButton,
              (isDeleting || !token) && styles.deleteButtonDisabled,
              pressed && styles.deleteButtonPressed,
            ]}
          >
            <Text style={styles.deleteButtonText}>
              {isDeleting ? "Deleting..." : "Delete Account"}
            </Text>
          </Pressable>
        </View>
      </Card>

      {error ? <ErrorText>{error}</ErrorText> : null}

      {!token ? <Body>Sign in again to delete your account.</Body> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 12,
  },
  cancelButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  cancelButtonPressed: {
    opacity: 0.82,
  },
  cancelButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  deleteButton: {
    alignItems: "center",
    backgroundColor: colors.backgroundSoft,
    borderColor: colors.error,
    borderWidth: borders.width,
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  deleteButtonDisabled: {
    opacity: 0.5,
  },
  deleteButtonPressed: {
    opacity: 0.82,
  },
  deleteButtonText: {
    color: colors.error,
    fontSize: 14,
    fontWeight: "800",
    textTransform: "uppercase",
  },
});
