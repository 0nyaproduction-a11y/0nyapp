import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "../components/Screen";
import { Body, Button, Card, Label, LoadingState, RecoveryState, Title } from "../components/ui";
import { getShortFilm, getWallet } from "../lib/api";
import { useAuth } from "../lib/authContext";
import type { RootStackParamList } from "../navigation/types";
import type { ApiShortFilm, ShortFilmChaiAvailability } from "../types/api";
import { borders, colors } from "../theme/tokens";

type Props = NativeStackScreenProps<RootStackParamList, "ShortFilmChaiAmount">;

function amountLabel(amount: number) {
  return `${amount} coins`;
}

export function ShortFilmChaiAmountScreen({ navigation, route }: Props) {
  const { session } = useAuth();
  const accessToken = session?.access_token ?? null;
  const [shortFilm, setShortFilm] = useState<ApiShortFilm>(route.params.shortFilm);
  const [chai, setChai] = useState<ShortFilmChaiAvailability | null>(null);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(
    route.params.selectedAmount ?? null,
  );
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isContinuing, setIsContinuing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadScreen = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setWalletError(null);

    try {
      const data = await getShortFilm(route.params.shortFilm.slug, accessToken);
      setShortFilm(data.shortFilm);
      setChai(data.chai);

      const allowedAmounts = data.chai.allowedCoinAmounts;
      if (!data.chai.available || allowedAmounts.length === 0) {
        setSelectedAmount(null);
        setWalletBalance(null);
        setError("Chai is unavailable right now.");
        return;
      }

      setSelectedAmount((currentAmount) => {
        if (currentAmount !== null && allowedAmounts.includes(currentAmount)) {
          return currentAmount;
        }

        if (route.params.selectedAmount && allowedAmounts.includes(route.params.selectedAmount)) {
          return route.params.selectedAmount;
        }

        return allowedAmounts[0] ?? null;
      });

      if (accessToken) {
        try {
          const wallet = await getWallet(accessToken);
          setWalletBalance(wallet.balance);
        } catch {
          setWalletBalance(null);
          setWalletError("We couldn't load your wallet right now.");
        }
      } else {
        setWalletBalance(null);
      }
    } catch {
      setError("We couldn't load this right now.");
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, route.params.shortFilm.slug, route.params.selectedAmount]);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      void loadScreen();
    }, [loadScreen]),
  );

  const allowedAmounts = useMemo(() => chai?.allowedCoinAmounts ?? [], [chai]);
  const canContinue =
    !isLoading &&
    !error &&
    selectedAmount !== null &&
    allowedAmounts.includes(selectedAmount) &&
    !isContinuing;

  const handleSelectAmount = useCallback((amount: number) => {
    setSelectedAmount(amount);
    setError(null);
  }, []);

  const handleContinue = useCallback(async () => {
    if (selectedAmount === null || !allowedAmounts.includes(selectedAmount)) {
      setError("Choose one of the configured Chai amounts.");
      return;
    }

    if (!accessToken) {
      navigation.navigate("SignIn");
      return;
    }

    setIsContinuing(true);
    setError(null);

    try {
      const wallet = await getWallet(accessToken);
      setWalletBalance(wallet.balance);
      setWalletError(null);

      if (wallet.balance < selectedAmount) {
        navigation.navigate("CoinPurchase", {
          returnToChai: {
            selectedAmount,
            shortFilm,
          },
        });
        return;
      }

      navigation.navigate("ShortFilmChaiConfirm", {
        coinAmount: selectedAmount,
        shortFilm,
      });
    } catch {
      setError("We couldn't load your wallet right now.");
    } finally {
      setIsContinuing(false);
    }
  }, [accessToken, allowedAmounts, navigation, selectedAmount, shortFilm]);

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  if (isLoading && !chai) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  if (error || !chai) {
    return (
      <Screen>
        <RecoveryState
          body={error ?? "Please try again."}
          onPrimaryAction={() => void loadScreen()}
          onSecondaryAction={handleBack}
          primaryActionLabel="Retry"
          secondaryActionLabel="Back"
          title="Chai unavailable"
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Card>
        <Label>Chai</Label>
        <Title>{shortFilm.title}</Title>
        <Body>Choose one configured coin amount.</Body>
      </Card>

      <Card>
        <Label>Amount</Label>
        <View style={styles.amountList}>
          {allowedAmounts.map((amount) => {
            const selected = amount === selectedAmount;

            return (
              <Pressable
                key={amount}
                accessibilityLabel={`Select ${amountLabel(amount)}${selected ? ", selected" : ""}`}
                accessibilityRole="button"
                onPress={() => handleSelectAmount(amount)}
                style={({ pressed }) => [
                  styles.amountChip,
                  selected && styles.amountChipSelected,
                  pressed && styles.amountChipPressed,
                ]}
              >
                <Text style={[styles.amountText, selected && styles.amountTextSelected]}>
                  {selected ? `✓ ${amountLabel(amount)}` : amountLabel(amount)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card>
        <Label>Wallet</Label>
        {accessToken ? (
          walletError ? (
            <Body>{walletError}</Body>
          ) : walletBalance !== null ? (
            <Title>{`${walletBalance} coins`}</Title>
          ) : (
            <Body>Refreshing wallet balance...</Body>
          )
        ) : (
          <Body>Sign in to view your wallet balance and continue.</Body>
        )}
      </Card>

      {walletError ? (
        <RecoveryState
          body={walletError}
          onPrimaryAction={() => void loadScreen()}
          primaryActionLabel="Retry"
          title="We couldn't load your wallet right now."
        />
      ) : null}

      {error ? <RecoveryState body={error} onPrimaryAction={handleBack} primaryActionLabel="Back" title="Chai unavailable" /> : null}

      <Button accessibilityLabel="Continue to Chai confirm" disabled={!canContinue} onPress={() => void handleContinue()}>
        {isContinuing ? "Continuing" : "Continue"}
      </Button>

      <Pressable
        accessibilityLabel="Back"
        accessibilityRole="button"
        onPress={handleBack}
        style={({ pressed }) => [styles.textAction, pressed && styles.textActionPressed]}
      >
        <Text style={styles.textActionText}>Back</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  amountList: {
    gap: 12,
  },
  amountChip: {
    alignItems: "center",
    borderColor: borders.color,
    borderWidth: borders.width,
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  amountChipPressed: {
    opacity: 0.82,
  },
  amountChipSelected: {
    borderColor: colors.accent,
  },
  amountText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  amountTextSelected: {
    color: colors.accent,
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
