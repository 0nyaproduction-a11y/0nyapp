import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
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
import { getWallet } from "../lib/api";
import { useAuth } from "../lib/authContext";
import type { RootStackScreenProps } from "../navigation/types";
import type { WalletResponse } from "../types/api";

type Props = RootStackScreenProps<"CoinPurchase">;

export function CoinPurchaseScreen({ route }: Props) {
  const { session } = useAuth();
  const [wallet, setWallet] = useState<WalletResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const token = session?.access_token;
  const chaiReturn = route.params?.returnToChai ?? null;

  const loadCoinProducts = useCallback(async () => {
    if (!token) {
      setWallet(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const walletData = await getWallet(token);
      setWallet(walletData);
      setError(null);
    } catch {
      setWallet(null);
      setError("We couldn't load this right now.");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void loadCoinProducts();
    }, [loadCoinProducts]),
  );

  return (
    <Screen>
      {isLoading && !wallet && !error ? <LoadingState /> : null}
      {error ? (
        <RecoveryState
          body={error}
          onPrimaryAction={() => void loadCoinProducts()}
          primaryActionLabel="Retry"
          title="We couldn't load this right now."
        />
      ) : null}
      {wallet ? (
        <>
          <Card>
            <Label>Balance</Label>
            <Title>{`${wallet.balance} coins`}</Title>
          </Card>
          {wallet.coinProducts.length > 0 ? (
            <Card>
              <Label>Coin packs</Label>
              <Body>Coin packs are not available in this test build yet.</Body>
              <Button accessibilityLabel="Coin packs unavailable" disabled onPress={() => undefined}>
                UNAVAILABLE IN THIS BUILD
              </Button>
            </Card>
          ) : (
            <Card>
              <Label>Coin packs</Label>
              <Body>Coin packs are not available in this test build yet.</Body>
              <Button accessibilityLabel="Coin packs unavailable" disabled onPress={() => undefined}>
                UNAVAILABLE IN THIS BUILD
              </Button>
            </Card>
          )}
        </>
      ) : null}
      {!token ? (
        <Card>
          <Label>Guest</Label>
          <Body>Sign in to view your balance.</Body>
        </Card>
      ) : null}
      {chaiReturn ? (
        <Card>
          <Body>This build cannot complete the top-up yet. You can return to the same Chai amount.</Body>
        </Card>
      ) : null}
    </Screen>
  );
}
