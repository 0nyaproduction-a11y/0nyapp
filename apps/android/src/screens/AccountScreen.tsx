import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "../components/Screen";
import {
  BellIcon,
  Button,
  CoinDiscIcon,
  ErrorText,
  LoadingState,
  RecoveryState,
} from "../components/ui";
import { getMe, resetDeveloperAccountState, setDeveloperPlusState } from "../lib/api";
import { useAuth } from "../lib/authContext";
import { navigateToSignIn } from "../lib/authReturnIntentStorage";
import { useAppLanguage } from "../lib/appLanguage";
import type { ProfileStackScreenProps } from "../navigation/types";
import type { MeResponse } from "../types/api";
import { borders, colors, radii, spacing, surfaces, typography } from "../theme/tokens";

type Props = ProfileStackScreenProps<"Account">;

function formatDate(dateString: string) {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(dateString));
  } catch {
    return dateString;
  }
}

export function AccountScreen({ navigation }: Props) {
  const { session, signOut } = useAuth();
  const { t } = useAppLanguage();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isResetConfirming, setIsResetConfirming] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [isTogglingPlus, setIsTogglingPlus] = useState(false);
  const [plusToggleError, setPlusToggleError] = useState<string | null>(null);
  const [isDevExpanded, setIsDevExpanded] = useState(false);
  const token = session?.access_token;
  const isPlus = me?.subscription.status === "active";
  const coinBalance = me?.wallet.coinBalance ?? 0;

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerRightContainer}>
          <Pressable
            accessibilityLabel={`${coinBalance} coins. Open wallet`}
            accessibilityRole="button"
            onPress={() => navigation.navigate("Wallet", { view: "ledger" })}
            style={({ pressed }) => [styles.headerCoinPill, pressed && styles.btnPressed]}
          >
            <CoinDiscIcon size={14} />
            <Text style={styles.headerCoinText}>{coinBalance}</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Notifications"
            accessibilityRole="button"
            onPress={() => navigation.navigate("Settings")}
            style={({ pressed }) => [styles.headerBellBtn, pressed && styles.btnPressed]}
          >
            <BellIcon color={colors.text} size={15} />
          </Pressable>
        </View>
      ),
      title: t("profile.title", "Profile"),
    });
  }, [coinBalance, navigation, t]);

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

  useEffect(() => {
    if (!token) {
      setMe(null);
      setError(null);
    }
  }, [token]);

  async function handleSignOut() {
    setSignOutError(null);
    setIsSigningOut(true);
    setMe(null);
    setError(null);

    try {
      await signOut();
      navigation.navigate("Home");
    } catch {
      setSignOutError("We couldn't sign you out right now.");
    } finally {
      setIsSigningOut(false);
    }
  }

  async function handleDeveloperReset() {
    if (!token) {
      return;
    }

    setResetError(null);
    setIsResetting(true);
    setMe(null);
    setError(null);

    try {
      await resetDeveloperAccountState(token);
      await signOut();
      navigation.navigate("Home");
    } catch {
      setResetError("We couldn't reset this account. Nothing was changed.");
      setIsResetConfirming(false);
    } finally {
      setIsResetting(false);
    }
  }

  async function handleDeveloperPlusToggle() {
    if (!token || isTogglingPlus) {
      return;
    }

    setPlusToggleError(null);
    setIsTogglingPlus(true);

    try {
      await setDeveloperPlusState(token, !isPlus);
      const data = await loadAccount();
      if (data) {
        setMe(data);
      }
    } catch {
      setPlusToggleError("We couldn't change Plus state. Nothing was changed.");
    } finally {
      setIsTogglingPlus(false);
    }
  }

  // GUEST STATE
  if (!token || isSigningOut) {
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
          <Pressable
            accessibilityLabel={t("profile.sign_in", "Sign in")}
            accessibilityRole="button"
            onPress={async () => {
              await navigateToSignIn(() => navigation.navigate("SignIn"), { kind: "profile" });
            }}
            style={({ pressed }) => [styles.signInButton, pressed && styles.signInButtonPressed]}
          >
            <Text style={styles.signInButtonText}>{t("profile.sign_in", "Sign In")}</Text>
          </Pressable>
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeader}>PREFERENCES & SETTINGS</Text>
          <View style={styles.cardGroup}>
            <ActionRow
              detail="Language, parental controls & app settings"
              label={t("profile.settings", "Settings")}
              onPress={() => navigation.navigate("Settings")}
            />
          </View>
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

  return (
    <Screen>
      {error ? (
        <RecoveryState
          body={error}
          onPrimaryAction={() => void reloadAccount()}
          primaryActionLabel="Retry"
          title="We couldn't load this right now."
        />
      ) : null}

      {me ? (
        <>
          {/* 1. IDENTITY BLOCK */}
          <View style={styles.identityCard}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>
                {me.identifier ? me.identifier[0]?.toUpperCase() : "0"}
              </Text>
            </View>
            <View style={styles.identityTextCol}>
              <Text numberOfLines={1} style={styles.email}>
                {me.identifier}
              </Text>
              {isPlus ? (
                <View style={styles.plusStatusBadge}>
                  <Text style={styles.plusBrandMini}>
                    <Text style={{ color: "#955E61", fontWeight: "700" }}>PLUS</Text>
                    <Text style={{ color: colors.textSecondary }}> · ACTIVE</Text>
                  </Text>
                </View>
              ) : (
                <View style={styles.freeStatusBadge}>
                  <Text style={styles.freeStatusText}>FREE ACCOUNT</Text>
                </View>
              )}
            </View>
          </View>

          {/* 2. WALLET CARD */}
          <View style={styles.walletCard}>
            <View style={styles.walletHeader}>
              <CoinDiscIcon size={16} />
              <Text style={styles.walletEyebrow}>WALLET</Text>
            </View>
            <View style={styles.walletBalanceRow}>
              <Text style={styles.walletBalanceNumber}>{coinBalance}</Text>
              <Text style={styles.walletBalanceUnit}>Coins</Text>
            </View>
            <Text style={styles.walletHelperText}>Unlock episodes. Send Chai ☕</Text>
            <View style={styles.walletActions}>
              <Pressable
                accessibilityLabel="Add Coins"
                accessibilityRole="button"
                onPress={() => navigation.navigate("CoinPurchase")}
                style={({ pressed }) => [styles.walletAddBtn, pressed && styles.btnPressed]}
              >
                <Text style={styles.walletAddBtnPlus}>+</Text>
                <Text style={styles.walletAddBtnText}>Add Coins</Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Activity"
                accessibilityRole="button"
                onPress={() => navigation.navigate("Wallet", { view: "ledger" })}
                style={({ pressed }) => [styles.walletActivityBtn, pressed && styles.btnPressed]}
              >
                <Text style={styles.walletActivityBtnText}>Activity</Text>
              </Pressable>
            </View>
          </View>

          {/* 3. PLUS SECTION */}
          {isPlus ? (
            <View style={styles.membershipCard}>
              <View style={styles.membershipHeader}>
                <Text style={styles.membershipEyebrow}>MEMBERSHIP</Text>
              </View>
              <Text style={styles.plusCardHeading}>
                <Text style={{ color: colors.accent }}>0</Text>
                <Text style={{ color: colors.text }}>nya</Text>
                <Text style={{ color: "#955E61", fontWeight: "700" }}> Plus</Text>
              </Text>
              {me.subscription.endsAt ? (
                <Text style={styles.planExpiry}>
                  {`Active until ${formatDate(me.subscription.endsAt)}`}
                </Text>
              ) : null}
              <Pressable
                accessibilityLabel="View plan benefits"
                accessibilityRole="button"
                onPress={() => navigation.navigate("Plus")}
                style={({ pressed }) => [styles.managePlanRow, pressed && styles.actionRowPressed]}
              >
                <Text style={styles.managePlanText}>View plan benefits</Text>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.plusCtaCard}>
              <View style={styles.membershipHeader}>
                <Text style={styles.membershipEyebrow}>MEMBERSHIP</Text>
              </View>
              <Text style={styles.plusCardHeading}>
                <Text style={{ color: colors.accent }}>0</Text>
                <Text style={{ color: colors.text }}>nya</Text>
                <Text style={{ color: "#955E61", fontWeight: "700" }}> Plus</Text>
              </Text>
              <Text style={styles.plusCardBody}>
                More access to eligible Micro Drama episodes, ad-free Short Films and enhanced playback.
              </Text>
              <Pressable
                accessibilityLabel="Explore Plus plans"
                accessibilityRole="button"
                onPress={() => navigation.navigate("Plus")}
                style={({ pressed }) => [styles.explorePlansBtn, pressed && styles.btnPressed]}
              >
                <Text style={styles.explorePlansText}>
                  Explore <Text style={{ color: "#955E61", fontWeight: "700" }}>Plus</Text> Plans <Text style={{ color: colors.accent }}>›</Text>
                </Text>
              </Pressable>
            </View>
          )}

          {/* 4. PREFERENCES & SETTINGS */}
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionHeader}>PREFERENCES & SETTINGS</Text>
            <View style={styles.cardGroup}>
              <ActionRow
                detail="Sync purchases, unlocked episodes & coins"
                label={t("profile.restore_sync", "Restore / Sync")}
                onPress={() => navigation.navigate("RestoreSync")}
              />
              <ActionRow
                detail="Language, parental controls & app settings"
                label={t("profile.settings", "Settings")}
                onPress={() => navigation.navigate("Settings")}
              />
            </View>
          </View>

          {/* 5. ACCOUNT ACTIONS */}
          <View style={styles.sectionBlock}>
            <View style={styles.cardGroup}>
              <ActionRow
                label="Sign out"
                onPress={handleSignOut}
              />
              <ActionRow
                destructive
                label={t("profile.delete_account", "Delete Account")}
                onPress={() => navigation.navigate("DeleteAccount")}
              />
            </View>
          </View>

          {/* 6. DEV TOOLS (Collapsible under __DEV__) */}
          {__DEV__ ? (
            <View style={styles.devWrapper}>
              <Pressable
                accessibilityLabel="Toggle developer tools"
                accessibilityRole="button"
                onPress={() => setIsDevExpanded((prev) => !prev)}
                style={styles.devToggle}
              >
                <Text style={styles.devToggleText}>
                  {isDevExpanded ? "▲ Hide developer tools" : "▼ Developer tools"}
                </Text>
              </Pressable>
              {isDevExpanded ? (
                <View style={styles.devSection}>
                  <Text style={styles.devHeading}>Developer Plus State</Text>
                  <Text style={styles.devHelper}>
                    Switches this allowlisted QA account between Free and active weekly 0nya Plus.
                  </Text>
                  <Button
                    accessibilityLabel={isPlus ? "Switch to free account" : "Switch to Plus account"}
                    disabled={isTogglingPlus}
                    onPress={() => void handleDeveloperPlusToggle()}
                    style={styles.devActionBtn}
                    variant="secondary"
                  >
                    {isTogglingPlus ? "Updating" : isPlus ? "Switch to Free" : "Switch to Plus"}
                  </Button>
                  {plusToggleError ? <ErrorText>{plusToggleError}</ErrorText> : null}

                  <Text style={[styles.devHeading, { marginTop: spacing.md }]}>Developer Reset</Text>
                  <Text style={styles.devHelper}>
                    Clears coins, unlocked episodes, rewarded-ad history, watch progress and
                    subscription for this account.
                  </Text>
                  {isResetConfirming ? (
                    <View style={styles.devResetConfirmRow}>
                      <Button
                        accessibilityLabel="Confirm developer reset"
                        disabled={isResetting}
                        onPress={() => void handleDeveloperReset()}
                        style={styles.devResetConfirmBtn}
                        variant="primary"
                      >
                        {isResetting ? "Resetting" : "Confirm reset"}
                      </Button>
                      <Button
                        accessibilityLabel="Cancel developer reset"
                        disabled={isResetting}
                        onPress={() => setIsResetConfirming(false)}
                        style={styles.devResetCancelBtn}
                        variant="secondary"
                      >
                        Cancel
                      </Button>
                    </View>
                  ) : (
                    <Button
                      accessibilityLabel="Reset account"
                      onPress={() => {
                        setResetError(null);
                        setIsResetConfirming(true);
                      }}
                      style={styles.devActionBtn}
                      variant="secondary"
                    >
                      Reset account
                    </Button>
                  )}
                  {resetError ? <ErrorText>{resetError}</ErrorText> : null}
                </View>
              ) : null}
            </View>
          ) : null}
        </>
      ) : null}
      {signOutError ? <ErrorText>{signOutError}</ErrorText> : null}
    </Screen>
  );
}

type ActionRowProps = {
  destructive?: boolean;
  detail?: string;
  label: string;
  onPress: () => void;
  value?: string;
};

function ActionRow({ destructive = false, detail, label, onPress, value }: ActionRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
    >
      <View style={styles.actionRowCopy}>
        <Text style={[styles.actionLabel, destructive && styles.actionLabelDestructive]}>
          {label}
        </Text>
        {detail ? <Text style={styles.actionDetail}>{detail}</Text> : null}
      </View>
      <View style={styles.actionMeta}>
        {value ? <Text style={styles.actionValue}>{value}</Text> : null}
        <Text style={[styles.chevron, destructive && styles.chevronDestructive]}>›</Text>
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

function SecondaryAction({
  accessibilityLabel,
  disabled,
  onPress,
  text,
  variant = "default",
}: SecondaryActionProps) {
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
  headerRightContainer: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginRight: 4,
  },
  headerCoinPill: {
    alignItems: "center",
    backgroundColor: surfaces.s2,
    borderColor: colors.borderSubtle,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  headerCoinText: {
    ...typography.label,
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  headerBellBtn: {
    alignItems: "center",
    backgroundColor: surfaces.s2,
    borderColor: colors.borderSubtle,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  guestHeader: {
    paddingTop: 0,
    paddingBottom: 4,
    gap: 6,
    marginBottom: spacing.md,
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
    alignItems: "center",
    backgroundColor: surfaces.s2,
    borderColor: colors.borderSubtle,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: "100%",
  },
  signInButtonPressed: {
    backgroundColor: colors.surfacePressed,
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  signInButtonText: {
    ...typography.label,
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  identityCard: {
    alignItems: "center",
    backgroundColor: surfaces.s1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.md,
    borderWidth: borders.width,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: spacing.md,
  },
  avatarCircle: {
    alignItems: "center",
    backgroundColor: "rgba(43, 126, 125, 0.14)",
    borderColor: "rgba(43, 126, 125, 0.35)",
    borderRadius: 20,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  avatarInitial: {
    ...typography.h3,
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
  },
  identityTextCol: {
    flex: 1,
    gap: 4,
    marginRight: 12,
  },
  email: {
    ...typography.body,
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  plusStatusBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(149, 94, 97, 0.14)",
    borderColor: "rgba(149, 94, 97, 0.32)",
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  plusBrandMini: {
    ...typography.micro,
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  freeStatusBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(43, 126, 125, 0.12)",
    borderColor: "rgba(43, 126, 125, 0.28)",
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  freeStatusText: {
    ...typography.micro,
    color: colors.accent,
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  walletCard: {
    backgroundColor: surfaces.s1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.md,
    borderWidth: borders.width,
    padding: 16,
    marginBottom: spacing.md,
  },
  walletHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    marginBottom: 6,
  },
  walletEyebrow: {
    ...typography.micro,
    color: colors.textMuted,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    fontWeight: "600",
  },
  walletBalanceRow: {
    alignItems: "baseline",
    flexDirection: "row",
    gap: 6,
    marginBottom: 4,
  },
  walletBalanceNumber: {
    ...typography.h1,
    color: colors.text,
    fontSize: 26,
    fontWeight: "700",
    lineHeight: 30,
  },
  walletBalanceUnit: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: "500",
  },
  walletHelperText: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 12,
  },
  walletActions: {
    flexDirection: "row",
    gap: 10,
  },
  walletAddBtn: {
    alignItems: "center",
    backgroundColor: surfaces.s2,
    borderColor: "rgba(43, 126, 125, 0.4)",
    borderRadius: radii.pill,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 6,
    height: 40,
    justifyContent: "center",
  },
  walletAddBtnPlus: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: "700",
    marginTop: -1,
  },
  walletAddBtnText: {
    ...typography.label,
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  walletActivityBtn: {
    alignItems: "center",
    backgroundColor: surfaces.s2,
    borderColor: colors.borderSubtle,
    borderRadius: radii.pill,
    borderWidth: 1,
    flex: 1,
    height: 40,
    justifyContent: "center",
  },
  walletActivityBtnText: {
    ...typography.label,
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "500",
  },
  plusCtaCard: {
    backgroundColor: surfaces.s1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.md,
    borderWidth: borders.width,
    marginBottom: spacing.md,
    padding: 16,
  },
  plusCardHeading: {
    ...typography.h3,
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
  },
  plusCardBody: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  explorePlansBtn: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: surfaces.s2,
    borderColor: "rgba(43, 126, 125, 0.4)",
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  explorePlansText: {
    ...typography.label,
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  membershipCard: {
    backgroundColor: surfaces.s1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.md,
    borderWidth: borders.width,
    marginBottom: spacing.md,
    padding: 16,
  },
  membershipHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  membershipEyebrow: {
    ...typography.micro,
    color: colors.textMuted,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    fontWeight: "600",
  },
  planLabel: {
    ...typography.h3,
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  planExpiry: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: 10,
  },
  managePlanRow: {
    alignItems: "center",
    borderTopColor: colors.borderSubtle,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 10,
    marginTop: 4,
  },
  managePlanText: {
    ...typography.label,
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "500",
  },
  sectionBlock: {
    marginBottom: spacing.md,
  },
  sectionHeader: {
    ...typography.micro,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
    paddingHorizontal: 4,
    textTransform: "uppercase",
  },
  cardGroup: {
    backgroundColor: surfaces.s1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.md,
    borderWidth: borders.width,
    overflow: "hidden",
  },
  actionRow: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderBottomColor: colors.borderSubtle,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  actionRowPressed: {
    backgroundColor: colors.surfacePressed,
  },
  cardPressed: {
    opacity: 0.85,
  },
  btnPressed: {
    opacity: 0.8,
  },
  actionRowCopy: {
    flex: 1,
    gap: 2,
  },
  actionLabel: {
    ...typography.body,
    color: colors.text,
    fontFamily: typography.label.fontFamily,
    fontSize: 15,
    fontWeight: "500",
  },
  actionLabelDestructive: {
    color: colors.error,
  },
  actionDetail: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  actionMeta: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginLeft: 8,
  },
  actionValue: {
    ...typography.caption,
    color: colors.textMuted,
    fontFamily: typography.label.fontFamily,
    fontWeight: "500",
  },
  chevron: {
    color: colors.textMuted,
    fontSize: 18,
    lineHeight: 18,
    marginLeft: 4,
  },
  chevronDestructive: {
    color: colors.error,
  },
  secondaryAction: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.md,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: spacing.base,
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
    color: colors.textSecondary,
    fontSize: 14,
  },
  secondaryActionTextDestructive: {
    ...typography.label,
    color: colors.error,
  },
  devWrapper: {
    alignItems: "center",
    marginTop: spacing.md,
    width: "100%",
  },
  devToggle: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 32,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  devToggleText: {
    ...typography.micro,
    color: colors.textDisabled,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  devSection: {
    backgroundColor: surfaces.s2,
    borderColor: colors.borderSubtle,
    borderRadius: radii.md,
    borderWidth: borders.width,
    gap: 8,
    marginTop: spacing.xs,
    padding: spacing.base,
    width: "100%",
  },
  devHeading: {
    ...typography.label,
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  devHelper: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  devActionBtn: {
    marginTop: spacing.xs,
  },
  devResetConfirmRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: spacing.xs,
  },
  devResetConfirmBtn: {
    flex: 1,
  },
  devResetCancelBtn: {
    flex: 1,
  },
});
