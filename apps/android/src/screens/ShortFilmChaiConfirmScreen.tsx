import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { Screen } from "../components/Screen";
import { Body, Button, Card, Label, LoadingState, RecoveryState, Title } from "../components/ui";
import { getShortFilm, getWallet } from "../lib/api";
import { createChaiIdempotencyKey, sendShortFilmChaiTip } from "../lib/chai";
import { useAuth } from "../lib/authContext";
import { navigateToSignIn } from "../lib/authReturnIntentStorage";
import type { RootStackParamList } from "../navigation/types";
import type { ApiShortFilm, ShortFilmChaiAvailability } from "../types/api";
import { colors } from "../theme/tokens";

type Props = NativeStackScreenProps<RootStackParamList, "ShortFilmChaiConfirm">;

type SubmitStatus = "idle" | "submitting" | "success" | "error";

function amountLabel(amount: number) {
  return `${amount} coins`;
}

export function ShortFilmChaiConfirmScreen({ navigation, route }: Props) {
  const { session } = useAuth();
  const accessToken = session?.access_token ?? null;
  const [shortFilm, setShortFilm] = useState<ApiShortFilm>(route.params.shortFilm);
  const [chai, setChai] = useState<ShortFilmChaiAvailability | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [policyError, setPolicyError] = useState<string | null>(null);
  const [needsTopUp, setNeedsTopUp] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const idempotencyKeyRef = useRef<string | null>(null);
  const coinAmount = route.params.coinAmount;

  const loadState = useCallback(async () => {
    setIsLoading(true);
    setPolicyError(null);
    setSubmitError(null);
    setWalletError(null);
    setNeedsTopUp(false);

    try {
      const data = await getShortFilm(route.params.shortFilm.slug, accessToken);
      setShortFilm(data.shortFilm);
      setChai(data.chai);

      const allowedAmounts = data.chai.allowedCoinAmounts;
      if (!data.chai.available || allowedAmounts.length === 0) {
        setPolicyError("Chai is unavailable right now.");
        setWalletBalance(null);
        return;
      }

      if (!allowedAmounts.includes(coinAmount)) {
        setPolicyError("That Chai amount is no longer available.");
        setWalletBalance(null);
        return;
      }

      if (!accessToken) {
        await navigateToSignIn(
          () => navigation.navigate("SignIn"),
          { kind: "chai", shortFilm, selectedAmount: coinAmount },
        );
        return;
      }

      try {
        const wallet = await getWallet(accessToken);
        setWalletBalance(wallet.balance);

        if (wallet.balance < coinAmount) {
          setNeedsTopUp(true);
        }
      } catch {
        setWalletBalance(null);
        setWalletError("We couldn't load your wallet right now.");
      }
    } catch {
      setPolicyError("We couldn't load this right now.");
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, coinAmount, navigation, route.params.shortFilm.slug]);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      void loadState();
    }, [loadState]),
  );

  const allowedAmounts = useMemo(() => chai?.allowedCoinAmounts ?? [], [chai]);
  const canSubmit =
    !isLoading &&
    !policyError &&
    walletBalance !== null &&
    walletBalance >= coinAmount &&
    allowedAmounts.includes(coinAmount) &&
    submitStatus !== "submitting" &&
    submitStatus !== "success";

  const refreshWallet = useCallback(async () => {
    if (!accessToken) {
      return null;
    }

    const wallet = await getWallet(accessToken);
    setWalletBalance(wallet.balance);
    return wallet.balance;
  }, [accessToken]);

  const handleSubmit = useCallback(async () => {
    if (submitStatus === "submitting" || submitStatus === "success") {
      return;
    }

    if (!accessToken) {
      await navigateToSignIn(
        () => navigation.navigate("SignIn"),
        { kind: "chai", shortFilm, selectedAmount: coinAmount },
      );
      return;
    }

    if (walletBalance !== null && walletBalance < coinAmount) {
      navigation.navigate("CoinPurchase", {
        returnToChai: {
          selectedAmount: coinAmount,
          shortFilm,
        },
      });
      return;
    }

    const idempotencyKey = idempotencyKeyRef.current ?? createChaiIdempotencyKey();
    idempotencyKeyRef.current = idempotencyKey;
    setSubmitStatus("submitting");
    setSubmitError(null);
    let shouldResetToIdle = true;

    try {
      const result = await sendShortFilmChaiTip(accessToken, shortFilm.slug, coinAmount, idempotencyKey);

      if (result.status === "tip_success" || result.status === "already_processed" || result.success) {
        shouldResetToIdle = false;
        try {
          await refreshWallet();
        } catch {
          // Keep the success state even if the wallet refresh fails.
        }

        if (result.remainingBalance !== null) {
          setWalletBalance(result.remainingBalance);
        }

        setSubmitStatus("success");
        return;
      }

      if (result.status === "insufficient_balance") {
        shouldResetToIdle = false;
        setSubmitStatus("idle");
        navigation.navigate("CoinPurchase", {
          returnToChai: {
            selectedAmount: coinAmount,
            shortFilm,
          },
        });
        return;
      }

      if (
        result.status === "invalid_amount" ||
        result.status === "chai_disabled" ||
        result.status === "inactive_destination" ||
        result.status === "invalid_short_film" ||
        result.status === "transaction_conflict"
      ) {
        setPolicyError("Chai is unavailable right now.");
        await loadState();
        return;
      }

      if (result.status === "not_authenticated") {
        shouldResetToIdle = false;
        setSubmitStatus("idle");
        await navigateToSignIn(
          () => navigation.navigate("SignIn"),
          { kind: "chai", shortFilm, selectedAmount: coinAmount },
        );
        return;
      }

      shouldResetToIdle = false;
      setSubmitStatus("error");
      setSubmitError("We couldn't send this right now.");
    } catch {
      shouldResetToIdle = false;
      setSubmitStatus("error");
      setSubmitError("We couldn't send this right now.");
    } finally {
      if (shouldResetToIdle) {
        setSubmitStatus("idle");
      }
    }
  }, [
    accessToken,
    coinAmount,
    loadState,
    navigation,
    refreshWallet,
    shortFilm,
    submitStatus,
    walletBalance,
  ]);

  const handleDone = useCallback(() => {
    navigation.pop(2);
  }, [navigation]);

  if (isLoading && !chai) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  if (policyError) {
    return (
      <Screen>
        <RecoveryState
          body={policyError}
          onPrimaryAction={() => void loadState()}
          onSecondaryAction={() => navigation.goBack()}
          primaryActionLabel="Retry"
          secondaryActionLabel="Back"
          title="Chai unavailable"
        />
      </Screen>
    );
  }

  if (walletError) {
    return (
      <Screen>
        <RecoveryState
          body={walletError}
          onPrimaryAction={() => void loadState()}
          onSecondaryAction={() => navigation.goBack()}
          primaryActionLabel="Retry"
          secondaryActionLabel="Back"
          title="We couldn't load your wallet right now."
        />
      </Screen>
    );
  }

  if (needsTopUp) {
    return (
      <Screen>
        <RecoveryState
          body="You need more coins for this tip."
          onPrimaryAction={() =>
            navigation.navigate("CoinPurchase", {
              returnToChai: {
                selectedAmount: coinAmount,
                shortFilm,
              },
            })
          }
          onSecondaryAction={() => navigation.goBack()}
          primaryActionLabel="Buy Coins"
          secondaryActionLabel="Back"
          title="Not enough coins"
        />
      </Screen>
    );
  }

  if (submitStatus === "success") {
    return (
      <Screen>
        <Card>
          <Label>✓</Label>
          <Title>Chai sent</Title>
          <Body>{amountLabel(coinAmount)}</Body>
          <Body>Thank you for supporting the film.</Body>
          {walletBalance !== null ? <Body>{`Wallet balance: ${walletBalance} coins`}</Body> : null}
        </Card>
        <Button accessibilityLabel="Done" onPress={handleDone}>
          Done
        </Button>
      </Screen>
    );
  }

  return (
    <Screen>
      <Card>
        <Label>Confirm Chai</Label>
        <Title>{shortFilm.title}</Title>
        <Body>{`Chai: ${amountLabel(coinAmount)}`}</Body>
      </Card>

      <Card>
        <Label>Wallet</Label>
        {walletBalance !== null ? (
          <Title>{`${walletBalance} coins`}</Title>
        ) : (
          <Body>Refreshing wallet balance...</Body>
        )}
        {walletBalance !== null && walletBalance < coinAmount ? (
          <Body>Not enough coins right now.</Body>
        ) : null}
      </Card>

      <Button accessibilityLabel={`Send ${amountLabel(coinAmount)}`} disabled={!canSubmit} onPress={() => void handleSubmit()}>
        {submitStatus === "submitting" ? "Sending" : `Send ${amountLabel(coinAmount)}`}
      </Button>

      <Pressable
        accessibilityLabel="Cancel"
        accessibilityRole="button"
        onPress={() => navigation.goBack()}
        style={({ pressed }) => [styles.textAction, pressed && styles.textActionPressed]}
      >
        <Text style={styles.textActionText}>Cancel</Text>
      </Pressable>

      {submitStatus === "error" && submitError ? (
        <RecoveryState
          body={submitError}
          onPrimaryAction={() => void handleSubmit()}
          onSecondaryAction={() => navigation.goBack()}
          primaryActionLabel="Retry"
          secondaryActionLabel="Back"
          title="We couldn't send this right now."
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
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
