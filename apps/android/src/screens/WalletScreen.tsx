import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "../components/Screen";
import {
  Body,
  Button,
  Card,
  Label,
  LoadingState,
  RecoveryState,
  Title,
} from "../components/ui";
import { getMe, getRequestRecoveryCopy, getWallet, type RecoveryCopy } from "../lib/api";
import { useAuth } from "../lib/authContext";
import type { RootStackScreenProps } from "../navigation/types";
import type { MeResponse, WalletResponse } from "../types/api";
import { colors, borders } from "../theme/tokens";

type WalletEntry = WalletResponse["recentTransactions"][number];

const ledgerDescriptionByType: Record<WalletEntry["type"], string> = {
  credit: "Coin top-up",
  episode_purchase: "Episode unlock",
  refund: "Refund",
  promo: "Promotional credit",
};

function formatLedgerDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function formatLedgerAmount(amount: number) {
  return `${amount > 0 ? "+" : ""}${amount} coins`;
}

export function WalletScreen() {
  const navigation = useNavigation<RootStackScreenProps<"Wallet">["navigation"]>();
  const { session } = useAuth();
  const [wallet, setWallet] = useState<WalletResponse | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<RecoveryCopy | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const token = session?.access_token;

  const loadWallet = useCallback(async () => {
    if (!token) {
      setWallet(null);
      setMe(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const [walletResult, meResult] = await Promise.allSettled([getWallet(token), getMe(token)]);

      if (walletResult.status === "fulfilled") {
        setWallet(walletResult.value);
        setError(null);
      } else {
        setWallet(null);
        setError(
          getRequestRecoveryCopy(walletResult.reason, {
            body: "Please try again.",
            title: "We couldn't load this right now.",
          }),
        );
      }

      if (meResult.status === "fulfilled") {
        setMe(meResult.value);
      } else {
        setMe(null);
        if (__DEV__) {
          console.info(
            "[0nya wallet me refresh]",
            meResult.reason instanceof Error ? meResult.reason.message : String(meResult.reason),
            meResult.reason instanceof Error ? meResult.reason.stack : undefined,
          );
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void loadWallet();
    }, [loadWallet]),
  );

  if (!token) {
    return (
      <Screen>
        <Card>
          <Label>Guest</Label>
          <Title>Sign in to view your wallet</Title>
          <Body>Sign in to view your coins and wallet activity.</Body>
          <Button accessibilityLabel="Sign in to view wallet" onPress={() => navigation.navigate("SignIn")}>
            Sign in
          </Button>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      {isLoading && !wallet && !error ? <LoadingState /> : null}
      {error ? (
        <Screen scroll={false}>
          <RecoveryState
            body={error.body}
            onPrimaryAction={() => void loadWallet()}
            primaryActionLabel="Retry"
            variant="cinematic"
            title={error.title}
          />
        </Screen>
      ) : null}
      {wallet ? (
        <View style={styles.stack}>
          <View style={styles.balanceBlock}>
            <Text style={styles.balanceValue}>{wallet.balance}</Text>
            <Text style={styles.balanceUnit}>Coins</Text>
            <Pressable
              accessibilityLabel="Add coins"
              accessibilityRole="button"
              onPress={() => navigation.navigate("CoinPurchase")}
              style={({ pressed }) => [styles.actionPill, pressed && styles.actionPillPressed]}
            >
              <Text style={styles.actionPillText}>Add Coins</Text>
            </Pressable>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionHeading}>Recent Activity</Text>
            {wallet.recentTransactions.length > 0 ? (
              <View style={styles.activityList}>
                {wallet.recentTransactions.map((transaction) => {
                  const description = ledgerDescriptionByType[transaction.type];
                  const amountLabel = formatLedgerAmount(transaction.amount);
                  const isCredit = transaction.amount > 0;

                  return (
                    <View key={`${transaction.type}-${transaction.createdAt}`} style={styles.activityRow}>
                      <View style={styles.rowText}>
                        <Text style={styles.rowTitle}>{description}</Text>
                        <Text style={styles.rowMeta}>{formatLedgerDate(transaction.createdAt)}</Text>
                      </View>
                      <Text
                        style={[
                          styles.rowAmount,
                          isCredit ? styles.rowAmountCredit : styles.rowAmountDebit,
                        ]}
                      >
                        {amountLabel}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.emptyState}>No wallet activity yet.</Text>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionHeading}>0nya Plus</Text>
            <Text style={styles.plusStatus}>
              {me?.subscription.status === "active" ? "Active" : "Weekly membership"}
            </Text>
            <Text style={styles.plusBody}>
              {me?.subscription.status === "active"
                ? me.subscription.endsAt
                  ? `Active until ${new Intl.DateTimeFormat("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    }).format(new Date(me.subscription.endsAt))}`
                  : me.subscription.label
                : "View membership details in Plus."}
            </Text>
            <Pressable
              accessibilityLabel={me?.subscription.status === "active" ? "Manage 0nya Plus" : "Get 0nya Plus"}
              accessibilityRole="button"
              onPress={() => navigation.navigate("Plus")}
              style={({ pressed }) => [styles.actionPill, styles.actionPillSecondary, pressed && styles.actionPillPressed]}
            >
              <Text style={styles.actionPillText}>
                {me?.subscription.status === "active" ? "Manage 0nya Plus" : "Get 0nya Plus"}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
  },
  balanceBlock: {
    gap: 2,
    paddingTop: 0,
  },
  balanceValue: {
    color: colors.text,
    fontSize: 40,
    fontWeight: "800",
    letterSpacing: -0.6,
    lineHeight: 44,
  },
  balanceUnit: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.2,
    marginBottom: 8,
  },
  actionPill: {
    alignSelf: "flex-start",
    alignItems: "center",
    backgroundColor: colors.backgroundSoft,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: borders.width,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 16,
  },
  actionPillSecondary: {
    backgroundColor: "rgba(13, 209, 188, 0.06)",
    borderColor: "rgba(13, 209, 188, 0.24)",
  },
  actionPillPressed: {
    backgroundColor: "rgba(13, 209, 188, 0.12)",
    borderColor: "rgba(13, 209, 188, 0.34)",
  },
  actionPillText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  section: {
    backgroundColor: colors.backgroundSoft,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: borders.width,
    gap: 10,
    padding: 16,
  },
  sectionHeading: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
  activityList: {
    gap: 0,
  },
  activityRow: {
    alignItems: "center",
    borderBottomColor: borders.color,
    borderBottomWidth: borders.width,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 12,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  rowMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  rowAmount: {
    fontSize: 14,
    fontWeight: "800",
  },
  rowAmountCredit: {
    color: colors.accent,
  },
  rowAmountDebit: {
    color: colors.text,
  },
  emptyState: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  plusStatus: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  plusBody: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
});
