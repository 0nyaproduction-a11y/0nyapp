import { useFocusEffect } from "@react-navigation/native";
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
import { getWallet, submitGooglePlayBillingBoundary } from "../lib/api";
import { useAuth } from "../lib/authContext";
import { navigateToSignIn } from "../lib/authReturnIntentStorage";
import { getBillingService, type BillingHarnessScenario, type StoreProduct } from "../billing";
import type { RootStackScreenProps } from "../navigation/types";
import type { WalletResponse } from "../types/api";
import { borders, colors } from "../theme/tokens";

type Props = RootStackScreenProps<"CoinPurchase">;

export function CoinPurchaseScreen({ navigation, route }: Props) {
  const { session } = useAuth();
  const [wallet, setWallet] = useState<WalletResponse | null>(null);
  const [storeProducts, setStoreProducts] = useState<StoreProduct[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [billingMessage, setBillingMessage] = useState<string | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const token = session?.access_token;
  const chaiReturn = route.params?.returnToChai ?? null;
  const walletReturn = route.params?.returnToWallet ?? null;
  const billingService = getBillingService(wallet);

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
      const products = await getBillingService(walletData).getProducts("coin_pack");
      setStoreProducts(products.filter((product) => product.kind === "coin_pack"));
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

  async function handlePurchase(product: StoreProduct, scenario?: BillingHarnessScenario) {
    if (!token || isPurchasing) {
      return;
    }

    setIsPurchasing(true);
    setBillingMessage(null);

    try {
      const result = await billingService.purchase(product, scenario);
      const boundary = await submitGooglePlayBillingBoundary(token, {
        googleProductId: result.googleProductId,
        kind: result.kind,
        mode: "purchase",
        productCode: result.productCode,
        scenario: result.scenario ?? result.status,
        testOnly: result.testOnly,
      });
      const refreshedWallet = await getWallet(token);

      setWallet(refreshedWallet);
      setBillingMessage(
        boundary.testOnly
          ? `Test-only ${result.status.replace(/_/g, " ")}. Google verification was not performed; server balance is ${boundary.wallet.coinBalance} coins.`
          : "Google Play Billing is not configured yet. No wallet change was made.",
      );
    } catch {
      setBillingMessage("We couldn't complete the billing check. Your wallet was not changed.");
    } finally {
      setIsPurchasing(false);
    }
  }

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
          {storeProducts.length > 0 ? (
            <Card>
              <Label>Coin packs</Label>
              <Body>
                Prices come from Google Play once product IDs are configured. This build keeps
                wallet credit server-authoritative.
              </Body>
              <View style={styles.productList}>
                {storeProducts.map((product) => (
                  <CoinPackRow
                    disabled={isPurchasing}
                    key={product.productCode}
                    onPress={() => void handlePurchase(product)}
                    product={product}
                  />
                ))}
              </View>
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
          {__DEV__ && billingService.isHarness ? (
            <Card>
              <Label>Development billing harness</Label>
              <Body>Run billing outcomes without Google UI or production entitlement changes.</Body>
              <View style={styles.harnessGrid}>
                {coinHarnessScenarios.map((scenario) => (
                  <Pressable
                    accessibilityLabel={`Run ${scenario}`}
                    accessibilityRole="button"
                    disabled={isPurchasing}
                    key={scenario}
                    onPress={() => {
                      const firstProduct = storeProducts[0] ?? defaultHarnessProduct;
                      void handlePurchase(firstProduct, scenario);
                    }}
                    style={({ pressed }) => [
                      styles.harnessChip,
                      pressed && styles.harnessChipPressed,
                      isPurchasing && styles.harnessChipDisabled,
                    ]}
                  >
                    <Text style={styles.harnessChipText}>{scenario}</Text>
                  </Pressable>
                ))}
              </View>
            </Card>
          ) : null}
          {billingMessage ? (
            <Card>
              <Label>Billing status</Label>
              <Body>{billingMessage}</Body>
            </Card>
          ) : null}
        </>
      ) : null}
      {!token ? (
        <Card>
          <Label>Guest</Label>
          <Title>Sign in to buy coins</Title>
          <Body>Sign in to view your balance and buy coins.</Body>
          <Button
            accessibilityLabel="Sign in to buy coins"
            onPress={async () => {
              await navigateToSignIn(() => navigation.navigate("SignIn"), {
                kind: "wallet",
                microDramaAccess: walletReturn?.microDramaAccess ?? null,
              });
            }}
          >
            Sign In
          </Button>
        </Card>
      ) : null}
      {chaiReturn ? (
        <Card>
          <Body>This build cannot complete the top-up yet. You can return to the same Chai amount.</Body>
        </Card>
      ) : null}
      {walletReturn ? (
        <Card>
          <Label>Episode unlock</Label>
          <Body>Return to the same episode unlock after adding coins.</Body>
          <Button
            accessibilityLabel="Return to episode unlock"
            onPress={() =>
              navigation.navigate("Wallet", {
                microDramaAccess: walletReturn.microDramaAccess,
              })
            }
          >
            Return to Episode Unlock
          </Button>
        </Card>
      ) : null}
    </Screen>
  );
}

const coinHarnessScenarios: BillingHarnessScenario[] = [
  "PURCHASE_SUCCESS",
  "USER_CANCELLED",
  "PURCHASE_DECLINED",
  "PURCHASE_PENDING",
  "SERVICE_DISCONNECTED",
  "NETWORK_ERROR",
  "PRODUCT_UNAVAILABLE",
  "ALREADY_PROCESSED",
  "INVALID_PRODUCT",
];

const defaultHarnessProduct: StoreProduct = {
  billingPeriodLabel: null,
  billingPlan: null,
  coinAmount: 100,
  displayName: "100 Coins",
  googleProductId: null,
  kind: "coin_pack",
  localizedPrice: null,
  productCode: "coins_100",
  status: "not_configured",
};

type CoinPackRowProps = {
  disabled: boolean;
  onPress: () => void;
  product: StoreProduct;
};

function CoinPackRow({ disabled, onPress, product }: CoinPackRowProps) {
  // Monetary price only: store-localized when the billing layer provides it,
  // otherwise the row carries no duplicated coin amount on the price side.
  const priceLabel = product.localizedPrice;
  const priceMeta = priceLabel
    ? product.googleProductId
      ? "Google Play price"
      : "Launch reference price"
    : "Google Play price not configured";

  return (
    <Pressable
      accessibilityLabel={`${product.displayName}. ${priceLabel ?? priceMeta}`}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.productRow,
        pressed && styles.productRowPressed,
        disabled && styles.productRowDisabled,
      ]}
    >
      <View style={styles.productCopy}>
        <Text style={styles.productTitle}>{product.displayName}</Text>
        <Text style={styles.productMeta}>{priceMeta}</Text>
      </View>
      {priceLabel ? <Text style={styles.productAmount}>{priceLabel}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  productList: {
    gap: 10,
  },
  productRow: {
    alignItems: "center",
    borderColor: borders.color,
    borderWidth: borders.width,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    minHeight: 58,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  productRowPressed: {
    backgroundColor: "rgba(43, 126, 125, 0.12)",
  },
  productRowDisabled: {
    opacity: 0.62,
  },
  productCopy: {
    flex: 1,
    gap: 2,
  },
  productTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  productMeta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  productAmount: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  harnessGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  harnessChip: {
    borderColor: "rgba(43, 126, 125, 0.24)",
    borderWidth: borders.width,
    minHeight: 38,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  harnessChipPressed: {
    backgroundColor: "rgba(43, 126, 125, 0.14)",
  },
  harnessChipDisabled: {
    opacity: 0.5,
  },
  harnessChipText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "800",
  },
});
