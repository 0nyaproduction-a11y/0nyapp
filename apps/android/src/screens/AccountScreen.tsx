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
import { navigateToSignIn } from "../lib/authReturnIntentStorage";
import { useAppLanguage } from "../lib/appLanguage";
import type { ProfileStackScreenProps } from "../navigation/types";
import appJson from "../../app.json";
import type { MeResponse } from "../types/api";
import { borders, colors, radii, spacing, typography } from "../theme/tokens";

const appVersion = appJson.expo?.version ?? "1.0.0";

type Props = ProfileStackScreenProps<"Account">;

export function AccountScreen({ navigation }: Props) {
  const { session, signOut } = useAuth();
  const { t } = useAppLanguage();
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
        <View style={styles.guestHeader}>
          <Text style={styles.guestStatus}>{t("profile.guest_account", "Guest Account")}</Text>
          <Text style={styles.guestSubtitle}>
            {t(
              "profile.guest_subtitle",
              "Sign in to keep your watch history, unlocked episodes, and coins synced across devices.",
            )}
          </Text>
          <Button
            accessibilityLabel={t("profile.sign_in", "Sign in")}
            onPress={async () => {
              await navigateToSignIn(() => navigation.navigate("SignIn"), { kind: "profile" });
            }}
            style={styles.signInButton}
            variant="primary"
          >
            {t("profile.sign_in", "Sign In")}
          </Button>
        </View>

        <View style={styles.actionList}>
          <ActionRow
            label={t("profile.settings", "Settings")}
            onPress={() => navigation.navigate("Settings")}
          />
        </View>

        <View style={styles.versionRow}>
          <Text style={styles.versionText}>{`${t("profile.version", "Version")} ${appVersion}`}</Text>
        </View>
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
  guestHeader: {
    paddingTop: 0,
    paddingBottom: 4,
    gap: 6,
  },
  guestStatus: {
    ...typography.micro,
    color: colors.accent,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  guestSubtitle: {
    ...typography.body,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  signInButton: {
    alignSelf: "stretch",
    borderRadius: radii.md,
    minHeight: 50,
  },
  actionList: {
    borderTopColor: colors.borderSubtle,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 20,
  },
  actionRow: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderBottomColor: colors.borderSubtle,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 52,
    paddingHorizontal: 4,
    paddingVertical: 14,
  },
  actionRowPressed: {
    backgroundColor: colors.surfacePressed,
  },
  actionLabel: {
    ...typography.body,
    color: colors.text,
    fontFamily: typography.label.fontFamily,
    fontWeight: "500",
  },
  actionMeta: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  actionDetail: {
    ...typography.micro,
    color: colors.muted,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  actionValue: {
    ...typography.caption,
    color: colors.textMuted,
    fontFamily: typography.label.fontFamily,
    fontWeight: "500",
  },
  chevron: {
    color: colors.muted,
    fontSize: 18,
    lineHeight: 18,
    marginLeft: 4,
  },
  versionRow: {
    alignItems: "center",
    marginTop: 32,
    paddingHorizontal: 4,
  },
  versionText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  email: {
    ...typography.body,
    color: colors.text,
  },
  identityLabel: {
    ...typography.micro,
    color: colors.muted,
    letterSpacing: 0.2,
    textTransform: "uppercase",
  },
  status: {
    ...typography.label,
    color: colors.accent,
    fontWeight: "600",
  },
  secondaryAction: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.md,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 12,
  },
  secondaryActionDestructive: {
    borderColor: "rgba(255, 141, 118, 0.22)",
  },
  secondaryActionDisabled: {
    opacity: 0.5,
  },
  secondaryActionPressed: {
    backgroundColor: colors.surfacePressed,
  },
  secondaryActionText: {
    ...typography.label,
    color: colors.text,
  },
  secondaryActionTextDestructive: {
    ...typography.label,
    color: "#ff8d76",
  },
});
