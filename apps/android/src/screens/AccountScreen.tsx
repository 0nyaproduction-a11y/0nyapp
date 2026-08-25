import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "../components/Screen";
import {
  Body,
  Button,
  Card,
  ErrorText,
  Label,
  LoadingState,
  RecoveryState,
} from "../components/ui";
import { getMe } from "../lib/api";
import { useAuth } from "../lib/authContext";
import type { ProfileStackScreenProps } from "../navigation/types";
import type { MeResponse } from "../types/api";
import { colors } from "../theme/tokens";

type Props = ProfileStackScreenProps<"Account">;

export function AccountScreen({ navigation }: Props) {
  const { session, signOut } = useAuth();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const token = session?.access_token;

  const loadAccount = useCallback(async () => {
    if (!token) {
      return null;
    }

    const meData = await getMe(token);
    return meData;
  }, [token]);

  const reloadAccount = useCallback(async () => {
    if (!token) {
      return;
    }

    setError(null);

    try {
      const data = await loadAccount();

      if (data) {
        setMe(data);
      }
    } catch {
      setError("We couldn't load this right now.");
    }
  }, [loadAccount, token]);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      if (!token) {
        setMe(null);
        setError(null);
        return () => {
          isMounted = false;
        };
      }

      void loadAccount()
        .then((data) => {
          if (isMounted && data) {
            setMe(data);
            setError(null);
          }
        })
        .catch(() => {
          if (isMounted) {
            setError("We couldn't load this right now.");
          }
        });

      return () => {
        isMounted = false;
      };
    }, [loadAccount, token]),
  );

  async function handleSignOut() {
    setSignOutError(null);
    setIsSigningOut(true);

    try {
      await signOut();
      navigation.navigate("Home");
    } catch {
      setSignOutError("We couldn't sign you out right now.");
    } finally {
      setIsSigningOut(false);
    }
  }

  if (!token) {
    return (
      <Screen>
        <Card>
          <Label>Guest</Label>
          <Body>Sign in to keep history and unlocks.</Body>
          <Button accessibilityLabel="Sign in" onPress={() => navigation.navigate("SignIn")}>
            Sign In
          </Button>
        </Card>
        <Card>
          <Label>Settings</Label>
          <Body>Playback, subtitles, notifications, and privacy controls are available here.</Body>
          <Button accessibilityLabel="Open settings" onPress={() => navigation.navigate("Settings")}>
            Settings
          </Button>
        </Card>
      </Screen>
    );
  }

  if (!me && !error) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  const isPlus = me?.subscription.status === "active";

  return (
    <Screen>
      {error ? (
        <RecoveryState body={error} onPrimaryAction={() => void reloadAccount()} primaryActionLabel="Retry" title="We couldn't load this right now." />
      ) : null}
      {me ? (
        <>
          <Card>
            <Text style={styles.identityLabel}>Signed in</Text>
            <Text style={styles.email}>{me.identifier}</Text>
            <Text style={styles.status}>{isPlus ? "0nya Plus" : "Free account"}</Text>
          </Card>

          <View style={styles.actionList}>
            <ActionRow label="Restore / Sync" onPress={() => navigation.navigate("RestoreSync")} />
            <ActionRow label="Settings" onPress={() => navigation.navigate("Settings")} />
          </View>

          {isPlus && me.subscription.endsAt ? (
            <Card>
              <Label>Current plan</Label>
              <Body>{me.subscription.label}</Body>
              <Body>
                {`Active until ${new Intl.DateTimeFormat("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                }).format(new Date(me.subscription.endsAt))}`}
              </Body>
            </Card>
          ) : null}

          <SecondaryAction
            accessibilityLabel="Delete account"
            onPress={() => navigation.navigate("DeleteAccount")}
            text="Delete Account"
            variant="destructive"
          />
        </>
      ) : null}
      {signOutError ? <ErrorText>{signOutError}</ErrorText> : null}
      <SecondaryAction
        accessibilityLabel="Sign out"
        disabled={isSigningOut}
        onPress={handleSignOut}
        text={isSigningOut ? "Signing out" : "Sign out"}
      />
    </Screen>
  );
}

type ActionRowProps = {
  detail?: string;
  label: string;
  onPress: () => void;
  value?: string;
};

function ActionRow({ detail, label, onPress, value }: ActionRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
    >
      <Text style={styles.actionLabel}>{label}</Text>
      <View style={styles.actionMeta}>
        {detail ? <Text style={styles.actionDetail}>{detail}</Text> : null}
        {value ? <Text style={styles.actionValue}>{value}</Text> : null}
        <Text style={styles.chevron}>›</Text>
      </View>
    </Pressable>
  );
}

type SecondaryActionProps = {
  accessibilityLabel: string;
  disabled?: boolean;
  onPress: () => void;
  text: string;
  variant?: "default" | "destructive";
};

function SecondaryAction({ accessibilityLabel, disabled, onPress, text, variant = "default" }: SecondaryActionProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryAction,
        variant === "destructive" && styles.secondaryActionDestructive,
        disabled && styles.secondaryActionDisabled,
        pressed && styles.secondaryActionPressed,
      ]}
    >
      <Text
        style={[
          styles.secondaryActionText,
          variant === "destructive" && styles.secondaryActionTextDestructive,
        ]}
      >
        {text}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actionList: {
    gap: 8,
  },
  actionRow: {
    alignItems: "center",
    backgroundColor: "rgba(232, 228, 218, 0.02)",
    borderColor: "rgba(232, 228, 218, 0.12)",
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  actionRowPressed: {
    backgroundColor: "rgba(13, 209, 188, 0.08)",
  },
  actionLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  actionMeta: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  actionDetail: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.2,
    textTransform: "uppercase",
  },
  actionValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  chevron: {
    color: colors.muted,
    fontSize: 22,
    lineHeight: 22,
  },
  email: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  identityLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
    textTransform: "uppercase",
  },
  status: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: "700",
  },
  secondaryAction: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderColor: "rgba(232, 228, 218, 0.18)",
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  secondaryActionDestructive: {
    borderColor: "rgba(232, 228, 218, 0.18)",
  },
  secondaryActionDisabled: {
    opacity: 0.5,
  },
  secondaryActionPressed: {
    backgroundColor: "rgba(232, 228, 218, 0.04)",
  },
  secondaryActionText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  secondaryActionTextDestructive: {
    color: colors.muted,
  },
});
