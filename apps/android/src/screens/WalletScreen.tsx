import { useEffect, useState } from "react";
import { Screen } from "../components/Screen";
import { Body, Button, Card, ErrorText, Label, LoadingState, Title } from "../components/ui";
import { getWallet } from "../lib/api";
import { useAuth } from "../lib/authContext";
import type { WalletResponse } from "../types/api";

export function WalletScreen() {
  const { session } = useAuth();
  const [wallet, setWallet] = useState<WalletResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const token = session?.access_token;

  useEffect(() => {
    let isMounted = true;
    if (!token) {
      return undefined;
    }

    getWallet(token)
      .then((walletData) => {
        if (isMounted) {
          setWallet(walletData);
        }
      })
      .catch((walletError) => {
        if (isMounted) {
          setError(walletError instanceof Error ? walletError.message : "Could not load wallet.");
        }
      })

    return () => {
      isMounted = false;
    };
  }, [token]);

  return (
    <Screen>
      <Title>Wallet</Title>
      {token && !wallet && !error ? <LoadingState /> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
      {wallet ? (
        <>
          <Card>
            <Label>Balance</Label>
            <Title>{wallet.balance} coins</Title>
          </Card>
          <Card>
            <Label>Coin Packs</Label>
            {wallet.coinProducts.map((product) => (
              <Button
                accessibilityLabel={`${product.displayName} coming soon`}
                disabled
                key={product.code}
                onPress={() => undefined}
              >
                {product.displayName} Coming Soon
              </Button>
            ))}
          </Card>
          <Card>
            <Label>Recent Activity</Label>
            {wallet.recentTransactions.map((transaction) => (
              <Body key={`${transaction.type}-${transaction.createdAt}`}>
                {transaction.amount > 0 ? "+" : ""}
                {transaction.amount} {transaction.type.replace("_", " ")}
              </Body>
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
