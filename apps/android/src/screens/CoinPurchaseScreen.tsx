import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Screen } from "../components/Screen";
import { SubscriptionManagementModal } from "../components/SubscriptionManagementModal";
import {
  Body,
  Button,
  Card,
  CoinDiscIcon,
  Label,
  LoadingState,
  RecoveryState,
  Title,
} from "../components/ui";
import { getCatalog, getMe, getWallet, submitGooglePlayBillingBoundary } from "../lib/api";
import { useAuth } from "../lib/authContext";
import { navigateToSignIn } from "../lib/authReturnIntentStorage";
import { getBillingService, type BillingHarnessScenario, type StoreProduct } from "../billing";
import type { RootStackScreenProps } from "../navigation/types";
import type { MeResponse, WalletResponse } from "../types/api";
import { borders, colors, radii, spacing, surfaces, typography } from "../theme/tokens";

type Props = RootStackScreenProps<"CoinPurchase">;

type ForYouItem = {
  id: string;
  poster: string | null;
  slug: string;
  title: string;
  type: "series" | "short_film";
};

function formatProductPrice(product: StoreProduct): string {
  if (product.localizedPrice) {
    return product.localizedPrice;
  }
  if (product.coinAmount) {
    switch (product.coinAmount) {
      case 30:
        return "₹29";
      case 50:
        return "₹49";
      case 100:
        return "₹99";
      case 250:
        return "₹199";
      default:
        return `₹${product.coinAmount}`;
    }
  }
  return "Unavailable";
}

export function CoinPurchaseScreen({ navigation, route }: Props) {
  const { session } = useAuth();
  const [wallet, setWallet] = useState<WalletResponse | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [forYouItems, setForYouItems] = useState<ForYouItem[]>([]);
  const [storeProducts, setStoreProducts] = useState<StoreProduct[]>([]);
  const [selectedProductCode, setSelectedProductCode] = useState<string | null>(null);
  const [isPackPickerOpen, setIsPackPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [billingMessage, setBillingMessage] = useState<string | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isManagementSheetOpen, setIsManagementSheetOpen] = useState(false);
  const token = session?.access_token;
  const chaiReturn = route.params?.returnToChai ?? null;
  const walletReturn = route.params?.returnToWallet ?? null;
  const billingService = getBillingService(wallet);
  const isPlus = me?.subscription.status === "active";

  useEffect(() => {
    navigation.setOptions({
      title: "Add Coins",
    });
  }, [navigation]);

  const loadCoinProducts = useCallback(async () => {
    if (!token) {
      setWallet(null);
      setMe(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const [walletData, meData, catalogData] = await Promise.all([
        getWallet(token),
        getMe(token).catch(() => null),
        getCatalog(token).catch(() => null),
      ]);
      setWallet(walletData);
      setMe(meData);
      if (catalogData) {
        const items: ForYouItem[] = [];
        const seriesList = (catalogData.catalog ?? []).map((s) => ({
          id: s.id ?? s.slug,
          poster: s.poster ?? null,
          slug: s.slug,
          title: s.title,
          type: "series" as const,
        }));
        const filmsList = (catalogData.shortFilms ?? []).map((f) => ({
          id: f.id ?? f.slug,
          poster: f.poster ?? null,
          slug: f.slug,
          title: f.title,
          type: "short_film" as const,
        }));
        const maxLen = Math.max(seriesList.length, filmsList.length);
        for (let i = 0; i < maxLen && items.length < 6; i++) {
          if (i < seriesList.length && items.length < 6) {
            items.push(seriesList[i]);
          }
          if (i < filmsList.length && items.length < 6) {
            items.push(filmsList[i]);
          }
        }
        setForYouItems(items);
      }
      const products = await getBillingService(walletData).getProducts("coin_pack");
      setStoreProducts(products.filter((product) => product.kind === "coin_pack"));
      setError(null);
    } catch {
      setWallet(null);
      setMe(null);
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

  const selectedProduct =
    storeProducts.find((p) => p.productCode === selectedProductCode) ??
    storeProducts[0] ??
    null;

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
      const [refreshedWallet, refreshedMe] = await Promise.all([
        getWallet(token),
        getMe(token).catch(() => null),
      ]);

      setWallet(refreshedWallet);
      if (refreshedMe) {
        setMe(refreshedMe);
      }
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
          {/* 1. COMPACT HORIZONTAL WALLET BALANCE */}
          <View style={styles.balanceCard}>
            <View style={styles.balanceLeft}>
              <CoinDiscIcon size={20} />
              <Text style={styles.balanceAmount}>
                {wallet.balance}
                <Text style={styles.balanceUnit}> Coins</Text>
              </Text>
            </View>
            <Pressable
              accessibilityLabel="View wallet activity"
              accessibilityRole="button"
              onPress={() => navigation.navigate("Wallet", { view: "ledger" })}
              style={({ pressed }) => [styles.activityLink, pressed && styles.btnPressed]}
            >
              <Text style={styles.activityLinkText}>Activity ›</Text>
            </Pressable>
          </View>

          {/* 2. COIN PURPOSE (Free / Non-Plus only) */}
          {!isPlus ? (
            <View style={styles.coinPurposeSection}>
              <Text style={styles.coinPurposeEyebrow}>USE COINS FOR</Text>
              <Text style={styles.coinPurposeBody}>Episode unlocks · Chai ☕</Text>
            </View>
          ) : null}

          {/* 2b. PLUS CONTEXT (Active Plus only) */}
          {isPlus ? (
            <View style={styles.plusContext}>
              <Text style={styles.plusContextEyebrow}>PLUS MEMBER</Text>
              <Text style={styles.plusContextBody}>
                Use Coins for Chai ☕ and eligible unlocks outside your membership.
                Coins for Chai ☕ and stories beyond Plus.
              </Text>
            </View>
          ) : null}

          {/* 3. COIN PACK SELECTOR */}
          {storeProducts.length > 0 && selectedProduct ? (
            <View style={styles.packSection}>
              <Text style={styles.sectionHeader}>ADD COINS</Text>
              <Pressable
                accessibilityLabel={`Selected pack: ${selectedProduct.displayName}. Price: ${formatProductPrice(selectedProduct)}. Tap to choose another pack`}
                accessibilityRole="button"
                disabled={isPurchasing}
                onPress={() => setIsPackPickerOpen(true)}
                style={({ pressed }) => [
                  styles.selectedPackRow,
                  pressed && styles.selectedPackRowPressed,
                  isPurchasing && styles.selectedPackRowDisabled,
                ]}
              >
                <View style={styles.selectedPackLeft}>
                  <CoinDiscIcon size={18} />
                  <Text style={styles.selectedPackTitle}>{selectedProduct.displayName}</Text>
                </View>
                <View style={styles.selectedPackRight}>
                  <Text style={styles.selectedPackPrice}>
                    {formatProductPrice(selectedProduct)}
                  </Text>
                  <Text style={styles.selectedPackChevron}>›</Text>
                </View>
              </Pressable>
            </View>
          ) : (
            <View style={styles.unavailableCard}>
              <Text style={styles.unavailableTitle}>Coin purchases are temporarily unavailable.</Text>
              <Text style={styles.unavailableBody}>Your balance and Plus access are unaffected.</Text>
              <Pressable
                accessibilityLabel="Retry loading coin packs"
                accessibilityRole="button"
                onPress={() => void loadCoinProducts()}
                style={({ pressed }) => [styles.retryBtn, pressed && styles.btnPressed]}
              >
                <Text style={styles.retryBtnText}>Retry</Text>
              </Pressable>
            </View>
          )}

          {/* 4. PLUS SETTINGS (Active Plus only) */}
          {isPlus ? (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionHeader}>PLUS SETTINGS</Text>
              <View style={styles.cardGroup}>
                <ActionRow
                  detail="See what Plus includes."
                  label="Plan & benefits"
                  onPress={() => navigation.navigate("Plus")}
                />
                <ActionRow
                  detail="Billing and renewal."
                  label="Manage subscription"
                  onPress={() => setIsManagementSheetOpen(true)}
                />
                <ActionRow
                  detail="Sync Plus, purchases and Coins."
                  label="Restore / Sync"
                  onPress={() =>
                    navigation.navigate("MainTabs", {
                      screen: "Profile",
                      params: { screen: "RestoreSync" },
                    })
                  }
                />
              </View>
            </View>
          ) : null}

          {/* 5. FOR YOU (Mixed Micro Dramas & Short Films) */}
          {forYouItems.length > 0 ? (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionHeader}>FOR YOU</Text>
              <ScrollView
                contentContainerStyle={styles.filmsScrollContent}
                horizontal
                showsHorizontalScrollIndicator={false}
              >
                {forYouItems.map((item) => (
                  <Pressable
                    accessibilityLabel={`Watch ${item.title}`}
                    accessibilityRole="button"
                    key={`${item.type}-${item.id}`}
                    onPress={() => {
                      if (item.type === "series") {
                        navigation.navigate("Series", { slug: item.slug });
                      } else {
                        navigation.navigate("ShortFilmPlayback", { slug: item.slug });
                      }
                    }}
                    style={({ pressed }) => [styles.filmCard, pressed && styles.filmCardPressed]}
                  >
                    <View style={styles.filmPosterContainer}>
                      {item.poster ? (
                        <Image
                          accessibilityLabel={`${item.title} poster`}
                          accessible
                          alt={`${item.title} poster`}
                          fadeDuration={180}
                          resizeMode="cover"
                          source={{ uri: item.poster }}
                          style={styles.filmPosterImage}
                        />
                      ) : (
                        <View style={styles.filmPosterFallback}>
                          <Text numberOfLines={2} style={styles.filmPosterFallbackText}>
                            {item.title}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text ellipsizeMode="tail" numberOfLines={1} style={styles.filmTitle}>
                      {item.title}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {/* 6. MORE WITH PLUS (Free / Non-Plus only) */}
          {!isPlus ? (
            <View style={styles.plusBridgeCard}>
              <View style={styles.membershipHeader}>
                <Text style={styles.membershipEyebrow}>MORE WITH PLUS</Text>
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
          ) : null}

          {/* 5. DEVELOPMENT HARNESS */}
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
                      const firstProduct = selectedProduct ?? storeProducts[0] ?? defaultHarnessProduct;
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
          <Title>Sign in to add coins</Title>
          <Body>Sign in to view your balance and add coins.</Body>
          <Button
            accessibilityLabel="Sign in to add coins"
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

      {/* PACK PICKER BOTTOM SHEET */}
      <Modal
        animationType="slide"
        onRequestClose={() => setIsPackPickerOpen(false)}
        transparent
        visible={isPackPickerOpen}
      >
        <Pressable onPress={() => setIsPackPickerOpen(false)} style={styles.modalBackdrop}>
          <Pressable onPress={(e) => e.stopPropagation()} style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose a Coin pack</Text>
              <Pressable
                accessibilityLabel="Close pack picker"
                accessibilityRole="button"
                onPress={() => setIsPackPickerOpen(false)}
                style={styles.modalCloseBtn}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.modalScrollContent} style={styles.modalScroll}>
              {storeProducts.map((product) => {
                const isSelected = product.productCode === selectedProduct?.productCode;
                const price = formatProductPrice(product);
                return (
                  <Pressable
                    accessibilityLabel={`${product.displayName}. ${price}`}
                    accessibilityRole="button"
                    key={product.productCode}
                    onPress={() => {
                      setSelectedProductCode(product.productCode);
                    }}
                    style={({ pressed }) => [
                      styles.pickerRow,
                      isSelected && styles.pickerRowSelected,
                      pressed && styles.pickerRowPressed,
                    ]}
                  >
                    <View style={styles.pickerRowLeft}>
                      <CoinDiscIcon size={18} />
                      <Text style={[styles.pickerTitle, isSelected && styles.pickerTitleSelected]}>
                        {product.displayName}
                      </Text>
                    </View>
                    <View style={styles.pickerRowRight}>
                      <Text style={[styles.pickerPrice, isSelected && styles.pickerPriceSelected]}>
                        {price}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            {selectedProduct ? (
              <Pressable
                accessibilityLabel={
                  isPurchasing
                    ? "Processing"
                    : `Add ${selectedProduct.displayName}`
                }
                accessibilityRole="button"
                disabled={isPurchasing}
                onPress={() => void handlePurchase(selectedProduct)}
                style={({ pressed }) => [
                  styles.sheetActionBtn,
                  isPurchasing && styles.sheetActionBtnDisabled,
                  pressed && !isPurchasing && styles.sheetActionBtnPressed,
                ]}
              >
                <Text style={styles.sheetActionBtnPlus}>+</Text>
                <Text
                  style={[
                    styles.sheetActionBtnText,
                    isPurchasing && styles.sheetActionBtnTextDisabled,
                  ]}
                >
                  {isPurchasing ? "Processing..." : "Add Coins"}
                </Text>
              </Pressable>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      <SubscriptionManagementModal
        endsAt={me?.subscription.endsAt}
        onClose={() => setIsManagementSheetOpen(false)}
        onNavigateToRestoreSync={() =>
          navigation.navigate("MainTabs", {
            screen: "Profile",
            params: { screen: "RestoreSync" },
          })
        }
        status={me?.subscription.status}
        visible={isManagementSheetOpen}
      />
    </Screen>
  );
}

type ActionRowProps = {
  detail?: string;
  label: string;
  onPress: () => void;
};

function ActionRow({ detail, label, onPress }: ActionRowProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
    >
      <View style={styles.actionRowCopy}>
        <Text style={styles.actionLabel}>{label}</Text>
        {detail ? <Text style={styles.actionDetail}>{detail}</Text> : null}
      </View>
      <Text style={styles.actionChevron}>›</Text>
    </Pressable>
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

const styles = StyleSheet.create({
  balanceCard: {
    alignItems: "center",
    backgroundColor: surfaces.s1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.md,
    borderWidth: borders.width,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  balanceLeft: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  balanceAmount: {
    ...typography.h3,
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 22,
  },
  balanceUnit: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 14.5,
    fontWeight: "400",
  },
  activityLink: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  activityLinkText: {
    ...typography.label,
    color: colors.accent,
    fontSize: 13,
    fontWeight: "500",
  },
  plusContext: {
    backgroundColor: surfaces.s1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.md,
    borderWidth: borders.width,
    gap: 3,
    marginBottom: spacing.sm,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  plusContextEyebrow: {
    ...typography.micro,
    color: "#955E61",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  plusContextBody: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 12.5,
    lineHeight: 16.5,
  },
  coinPurposeSection: {
    marginBottom: spacing.sm,
    paddingHorizontal: 4,
  },
  coinPurposeEyebrow: {
    ...typography.micro,
    color: colors.textMuted,
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  coinPurposeBody: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 12.5,
    lineHeight: 16.5,
    marginTop: 2,
  },
  plusBridgeCard: {
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
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "uppercase",
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
  filmsScrollContent: {
    gap: 12,
    paddingRight: 16,
  },
  filmCard: {
    width: 124,
  },
  filmCardPressed: {
    opacity: 0.85,
  },
  filmPosterContainer: {
    backgroundColor: surfaces.s2,
    borderColor: colors.borderSubtle,
    borderRadius: 14,
    borderWidth: borders.width,
    height: 220,
    overflow: "hidden",
    width: 124,
  },
  filmPosterImage: {
    height: "100%",
    width: "100%",
  },
  filmPosterFallback: {
    alignItems: "center",
    backgroundColor: surfaces.s2,
    flex: 1,
    justifyContent: "center",
    padding: 8,
  },
  filmPosterFallbackText: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: "center",
  },
  filmTitle: {
    ...typography.caption,
    color: colors.text,
    fontSize: 12.5,
    fontWeight: "500",
    lineHeight: 16,
    marginTop: 6,
  },
  packSection: {
    marginBottom: spacing.sm,
  },
  sectionHeader: {
    ...typography.micro,
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
    paddingHorizontal: 4,
    textTransform: "uppercase",
  },
  selectedPackRow: {
    alignItems: "center",
    backgroundColor: surfaces.s1,
    borderColor: colors.borderSubtle,
    borderRadius: 24,
    borderWidth: borders.width,
    flexDirection: "row",
    height: 48,
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  selectedPackRowPressed: {
    backgroundColor: colors.surfacePressed,
    transform: [{ scale: 0.98 }],
  },
  selectedPackRowDisabled: {
    opacity: 0.5,
  },
  selectedPackLeft: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  selectedPackTitle: {
    ...typography.label,
    color: colors.text,
    fontSize: 14.5,
    fontWeight: "500",
  },
  selectedPackRight: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  selectedPackPrice: {
    ...typography.label,
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: "500",
  },
  selectedPackChevron: {
    color: colors.accent,
    fontSize: 18,
    lineHeight: 18,
  },
  sheetActionBtn: {
    alignItems: "center",
    backgroundColor: surfaces.s2,
    borderColor: "rgba(43, 126, 125, 0.6)",
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    height: 48,
    justifyContent: "center",
    marginTop: 14,
    paddingHorizontal: 16,
    width: "100%",
  },
  sheetActionBtnPlus: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: "700",
    marginTop: -1,
  },
  sheetActionBtnPressed: {
    backgroundColor: colors.surfacePressed,
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  sheetActionBtnDisabled: {
    opacity: 0.5,
  },
  sheetActionBtnText: {
    ...typography.label,
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  sheetActionBtnTextDisabled: {
    color: colors.textDisabled,
  },
  unavailableCard: {
    backgroundColor: surfaces.s1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.md,
    borderWidth: borders.width,
    gap: 6,
    marginBottom: spacing.sm,
    padding: 14,
  },
  unavailableTitle: {
    ...typography.label,
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  unavailableBody: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 12.5,
    lineHeight: 17,
  },
  retryBtn: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: surfaces.s2,
    borderColor: colors.borderSubtle,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    marginTop: 8,
    paddingHorizontal: 16,
  },
  retryBtnText: {
    ...typography.label,
    color: colors.text,
    fontSize: 12.5,
    fontWeight: "500",
  },
  sectionBlock: {
    marginBottom: spacing.sm,
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
    minHeight: 46,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  actionRowPressed: {
    backgroundColor: colors.surfacePressed,
  },
  actionRowCopy: {
    flex: 1,
    gap: 1,
  },
  actionLabel: {
    ...typography.body,
    color: colors.text,
    fontFamily: typography.label.fontFamily,
    fontSize: 14.5,
    fontWeight: "500",
  },
  actionDetail: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 15,
  },
  actionChevron: {
    color: colors.accent,
    fontSize: 18,
    lineHeight: 18,
    marginLeft: 4,
  },
  btnPressed: {
    opacity: 0.8,
  },
  modalBackdrop: {
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: surfaces.s2,
    borderTopColor: colors.borderSubtle,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: borders.width,
    maxHeight: "70%",
    paddingBottom: 24,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  modalHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  modalCloseBtn: {
    alignItems: "center",
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  modalCloseText: {
    color: colors.textMuted,
    fontSize: 18,
    fontWeight: "600",
  },
  modalScroll: {
    maxHeight: 280,
  },
  modalScrollContent: {
    gap: 8,
  },
  pickerRow: {
    alignItems: "center",
    backgroundColor: surfaces.s1,
    borderColor: colors.borderSubtle,
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: "row",
    height: 48,
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  pickerRowSelected: {
    backgroundColor: surfaces.s1,
    borderColor: "rgba(43, 126, 125, 0.6)",
  },
  pickerRowPressed: {
    backgroundColor: colors.surfacePressed,
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  pickerRowLeft: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  pickerTitle: {
    ...typography.label,
    color: colors.text,
    fontSize: 14.5,
    fontWeight: "500",
  },
  pickerTitleSelected: {
    color: colors.text,
    fontWeight: "600",
  },
  pickerRowRight: {
    alignItems: "center",
  },
  pickerPrice: {
    ...typography.label,
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: "500",
  },
  pickerPriceSelected: {
    color: colors.text,
    fontWeight: "600",
  },
  harnessGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  harnessChip: {
    borderColor: "rgba(43, 126, 125, 0.24)",
    borderRadius: radii.xs,
    borderWidth: borders.width,
    minHeight: 36,
    paddingHorizontal: 10,
    paddingVertical: 7,
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
    fontWeight: "700",
  },
});
