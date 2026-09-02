import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Modal, Pressable, ScrollView, Share, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Screen } from "../components/Screen";
import { Body, Button, Label, Title, TransientFeedback } from "../components/ui";
import { getCatalog, getWallet } from "../lib/api";
import { createChaiIdempotencyKey, sendShortFilmChaiTip } from "../lib/chai";
import { buildShortFilmShareMessage } from "../lib/content-links";
import { useAuth } from "../lib/authContext";
import { navigateToSignIn } from "../lib/authReturnIntentStorage";
import { resolveShortFilmArtwork } from "../lib/shortFilmArtwork";
import type { RootStackParamList } from "../navigation/types";
import type { ApiShortFilm } from "../types/api";
import { borders, colors } from "../theme/tokens";

type Props = NativeStackScreenProps<RootStackParamList, "ShortFilmEnd">;

const CHAI_SUCCESS_FEEDBACK_MS = 2600;

function amountLabel(amount: number) {
  return `${amount} coins`;
}

export function ShortFilmEndScreen({ navigation, route }: Props) {
  const { session } = useAuth();
  const { height: viewportHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const shortFilm: ApiShortFilm = route.params.shortFilm;
  const chai = route.params.chai;
  const accessToken = session?.access_token ?? null;
  const [isChaiSheetOpen, setIsChaiSheetOpen] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitState, setSubmitState] = useState<"idle" | "success" | "error">("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [lastSubmittedAmount, setLastSubmittedAmount] = useState<number | null>(null);
  const [chaiFeedback, setChaiFeedback] = useState<{ id: number; message: string } | null>(null);
  const [hasSentChaiThisPlayback, setHasSentChaiThisPlayback] = useState(
    route.params.hasSentChaiThisPlayback === true,
  );
  const [relatedShortFilms, setRelatedShortFilms] = useState<ApiShortFilm[]>([]);
  const filmTitle = shortFilm.title;
  const shareMessage = useMemo(
    () => buildShortFilmShareMessage(shortFilm.title, shortFilm.slug),
    [shortFilm.slug, shortFilm.title],
  );
  const allowedAmounts = useMemo(() => chai.allowedCoinAmounts ?? [], [chai.allowedCoinAmounts]);
  const canSendChai = shortFilm.chaiEnabled && chai.available && allowedAmounts.length > 0;
  const chaiCtaLabel = hasSentChaiThisPlayback ? "Send More Chai" : "Send Chai";

  const goHome = useCallback(() => {
    navigation.reset({
      index: 0,
      routes: [{ name: "MainTabs", params: { screen: "Home" } }],
    });
  }, [navigation]);

  const handleReplay = useCallback(() => {
    navigation.replace("ShortFilmPlayback", {
      slug: shortFilm.slug,
      startFromBeginning: true,
    });
  }, [navigation, shortFilm.slug]);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    if (!chaiFeedback) {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      setChaiFeedback((currentFeedback) =>
        currentFeedback?.id === chaiFeedback.id ? null : currentFeedback,
      );
    }, CHAI_SUCCESS_FEEDBACK_MS);

    return () => clearTimeout(timeoutId);
  }, [chaiFeedback]);

  useEffect(() => {
    let isMounted = true;

    void getCatalog(accessToken)
      .then((data) => {
        if (!isMounted) {
          return;
        }

        setRelatedShortFilms(
          data.shortFilms.filter((item) => item.slug !== shortFilm.slug).slice(0, 6),
        );
      })
      .catch(() => {
        if (isMounted) {
          setRelatedShortFilms([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [accessToken, shortFilm.slug]);

  const handleShare = useCallback(() => {
    void Share.share({ message: shareMessage }).catch(() => undefined);
  }, [shareMessage]);

  const openChaiSheet = useCallback(async () => {
    const firstAmount = allowedAmounts[0] ?? null;
    setSelectedAmount(firstAmount);
    setSubmitState("idle");
    setSubmitError(null);
    setIsChaiSheetOpen(true);

    if (!accessToken) {
      setWalletBalance(null);
      setWalletError(null);
      return;
    }

    try {
      const wallet = await getWallet(accessToken);
      setWalletBalance(wallet.balance);
      setWalletError(null);
    } catch {
      setWalletBalance(null);
      setWalletError("We couldn't load your wallet right now.");
    }
  }, [accessToken, allowedAmounts]);

  const handleChaiSubmit = useCallback(async () => {
    if (!selectedAmount || !allowedAmounts.includes(selectedAmount)) {
      setSubmitState("error");
      setSubmitError("Choose a valid Chai amount.");
      return;
    }

    if (!accessToken) {
      await navigateToSignIn(
        () => navigation.navigate("SignIn"),
        { kind: "chai", shortFilm, selectedAmount },
      );
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitState("idle");

    try {
      const wallet = await getWallet(accessToken);
      setWalletBalance(wallet.balance);

      if (wallet.balance < selectedAmount) {
        setIsChaiSheetOpen(false);
        navigation.navigate("CoinPurchase", {
          returnToChai: {
            selectedAmount,
            shortFilm,
          },
        });
        return;
      }

      const idempotencyKey = createChaiIdempotencyKey();
      const result = await sendShortFilmChaiTip(accessToken, shortFilm.slug, selectedAmount, idempotencyKey);

      if (result.success || result.status === "tip_success" || result.status === "already_processed") {
        setLastSubmittedAmount(selectedAmount);
        setHasSentChaiThisPlayback(true);
        setWalletBalance(result.remainingBalance ?? Math.max((walletBalance ?? wallet.balance) - selectedAmount, 0));
        setSubmitState("success");
        setIsChaiSheetOpen(false);
        setChaiFeedback({
          id: Date.now(),
          message: `Chai sent \u2022 ${selectedAmount} coins`,
        });
        return;
      }

      if (result.status === "insufficient_balance") {
        setIsChaiSheetOpen(false);
        navigation.navigate("CoinPurchase", {
          returnToChai: {
            selectedAmount,
            shortFilm,
          },
        });
        return;
      }

      setSubmitState("error");
      setSubmitError("We couldn't send this right now.");
    } catch {
      setSubmitState("error");
      setSubmitError("We couldn't send this right now.");
    } finally {
      setIsSubmitting(false);
    }
  }, [accessToken, allowedAmounts, navigation, selectedAmount, shortFilm, walletBalance]);

  const poster = resolveShortFilmArtwork(shortFilm.heroImage, shortFilm.poster);
  const posterHeight = Math.max(210, Math.min(viewportHeight * 0.38, 330));

  return (
    <Screen>
      <View style={styles.root}>
        <View style={[styles.posterWrap, { height: posterHeight, width: "100%" }]}>
          {poster ? (
            <>
              <Image alt="" source={{ uri: poster }} style={styles.posterBackdrop} resizeMode="cover" blurRadius={12} />
              <View style={styles.scrim} />
              <Image
                accessibilityLabel={`${filmTitle} poster`}
                accessible
                alt=""
                source={{ uri: poster }}
                style={styles.posterImage}
                resizeMode="contain"
              />
            </>
          ) : (
            <View style={styles.posterFallback}>
              <Title>{filmTitle}</Title>
            </View>
          )}
        </View>

        <View style={styles.content}>
          <Label>Film complete</Label>
          <Title>{filmTitle}</Title>
          <Body>Enjoyed the film?</Body>
          {canSendChai ? (
            <Pressable
              accessibilityLabel={chaiCtaLabel}
              accessibilityRole="button"
              onPress={() => void openChaiSheet()}
              style={styles.primaryAction}
            >
              <Text style={styles.primaryActionText}>{chaiCtaLabel}</Text>
              <Text style={styles.primaryActionHelper}>Appreciate this film</Text>
            </Pressable>
          ) : null}
          <View style={styles.secondaryRow}>
            <Pressable
              accessibilityLabel="Share short film"
              accessibilityRole="button"
              onPress={() => void handleShare()}
              style={styles.secondaryRowAction}
            >
              <Text style={styles.secondaryActionText}>Share</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Replay short film"
              accessibilityRole="button"
              onPress={handleReplay}
              style={styles.secondaryRowAction}
            >
              <Text style={styles.secondaryActionText}>Replay</Text>
            </Pressable>
          </View>
        </View>

        {relatedShortFilms.length > 0 ? (
          <View style={styles.relatedSection}>
            <Text style={styles.relatedHeading}>Related Short Films</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.relatedRow}>
                {relatedShortFilms.map((item) => {
                  const relatedPoster = resolveShortFilmArtwork(item.heroImage, item.poster);

                  return (
                    <Pressable
                      key={item.slug}
                      accessibilityLabel={`Open details for ${item.title}`}
                      accessibilityRole="button"
                      onPress={() => navigation.push("ShortFilm", { slug: item.slug })}
                      style={({ pressed }) => [
                        styles.relatedCard,
                        pressed && styles.relatedCardPressed,
                      ]}
                    >
                      <View style={styles.relatedPosterWrap}>
                        {relatedPoster ? (
                          <Image
                            accessibilityLabel={`${item.title} poster`}
                            accessible
                            alt=""
                            source={{ uri: relatedPoster }}
                            style={styles.relatedPoster}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={styles.relatedPosterFallback}>
                            <Text style={styles.relatedPosterTitle} numberOfLines={2}>
                              {item.title}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.relatedTitle} numberOfLines={2}>
                        {item.title}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        ) : null}

        <Pressable
          accessibilityLabel="Back home"
          accessibilityRole="button"
          onPress={goHome}
          style={styles.homeAction}
        >
          <Text style={styles.homeActionText}>Home</Text>
        </Pressable>
      </View>

      <TransientFeedback
        message={chaiFeedback?.message ?? ""}
        style={[styles.chaiFeedback, { bottom: 24 + insets.bottom }]}
        visible={Boolean(chaiFeedback)}
      />

      <Modal animationType="slide" transparent visible={isChaiSheetOpen} onRequestClose={() => setIsChaiSheetOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setIsChaiSheetOpen(false)}>
          <Pressable onPress={() => undefined} style={[styles.sheet, { paddingBottom: 16 + insets.bottom }]}>
            {submitState === "success" && lastSubmittedAmount !== null ? (
              <View style={styles.sheetContent}>
                <Label>Chai sent</Label>
                <Title>{amountLabel(lastSubmittedAmount)}</Title>
                <Body>Thank you for supporting the film.</Body>
                <Button accessibilityLabel="Done" onPress={() => setIsChaiSheetOpen(false)}>
                  Done
                </Button>
              </View>
            ) : (
              <View style={styles.sheetContent}>
                <Label>Send Chai</Label>
                <View style={styles.balanceRow}>
                  <Text style={styles.balanceLabel}>Balance</Text>
                  <Text style={styles.balanceValue}>{walletBalance !== null ? `${walletBalance} coins` : "Loading..."}</Text>
                </View>
                {walletError ? <Text style={styles.sheetError}>{walletError}</Text> : null}

                <View style={styles.amountList}>
                  {allowedAmounts.map((amount) => {
                    const isSelected = amount === selectedAmount;

                    return (
                      <Pressable
                        key={amount}
                        accessibilityLabel={`Select ${amountLabel(amount)}`}
                        accessibilityRole="button"
                        onPress={() => setSelectedAmount(amount)}
                        style={[styles.amountChip, isSelected && styles.amountChipSelected]}
                      >
                        <Text style={[styles.amountText, isSelected && styles.amountTextSelected]}>
                          {amountLabel(amount)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={styles.sheetHelperText}>
                  {selectedAmount !== null ? `Selected: ${amountLabel(selectedAmount)}` : "Choose an amount"}
                </Text>

                {submitError ? <Text style={styles.sheetError}>{submitError}</Text> : null}
                <Button
                  accessibilityLabel={isSubmitting ? "Sending Chai" : "Send Chai"}
                  disabled={isSubmitting || selectedAmount === null}
                  onPress={() => void handleChaiSubmit()}
                >
                  {isSubmitting ? "Sending" : selectedAmount !== null ? `Send ${selectedAmount} coins` : "Send coins"}
                </Button>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    gap: 14,
  },
  posterWrap: {
    alignSelf: "center",
    backgroundColor: colors.surface,
    borderColor: borders.color,
    borderWidth: borders.width,
    overflow: "hidden",
  },
  posterBackdrop: {
    bottom: 0,
    height: "100%",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    width: "100%",
  },
  posterImage: {
    height: "100%",
    width: "100%",
  },
  posterFallback: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 16,
  },
  scrim: {
    backgroundColor: "rgba(5, 5, 5, 0.35)",
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  content: {
    gap: 10,
    paddingTop: 4,
  },
  primaryAction: {
    alignItems: "flex-start",
    backgroundColor: colors.backgroundSoft,
    borderRadius: 14,
    borderColor: "rgba(13, 209, 188, 0.38)",
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 62,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  primaryActionText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  primaryActionHelper: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
  },
  secondaryAction: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  secondaryRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 2,
  },
  secondaryRowAction: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 14,
    borderColor: borders.color,
    borderWidth: borders.width,
    flex: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  secondaryActionText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  relatedSection: {
    gap: 10,
    paddingBottom: 4,
  },
  relatedHeading: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  relatedRow: {
    flexDirection: "row",
    gap: 12,
  },
  relatedCard: {
    gap: 8,
    width: 112,
  },
  relatedCardPressed: {
    opacity: 0.85,
  },
  relatedPosterWrap: {
    aspectRatio: 2 / 3,
    backgroundColor: colors.background,
    borderColor: borders.color,
    borderWidth: borders.width,
    overflow: "hidden",
    width: "100%",
  },
  relatedPoster: {
    height: "100%",
    width: "100%",
  },
  relatedPosterFallback: {
    alignItems: "center",
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: "center",
    padding: 10,
  },
  relatedPosterTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  relatedTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },
  homeAction: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  homeActionText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
  },
  chaiFeedback: {
    left: 18,
    position: "absolute",
    right: 18,
  },
  sheetBackdrop: {
    backgroundColor: "rgba(0,0,0,0.55)",
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.background,
    borderColor: borders.color,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: borders.width,
    padding: 20,
  },
  sheetContent: {
    gap: 10,
  },
  balanceRow: {
    alignItems: "center",
    borderColor: borders.color,
    borderWidth: borders.width,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  balanceLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  balanceValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  amountList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  amountChip: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderColor: borders.color,
    borderWidth: borders.width,
    minWidth: 72,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  amountChipSelected: {
    backgroundColor: "rgba(13, 209, 188, 0.14)",
    borderColor: colors.accent,
  },
  amountText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  amountTextSelected: {
    color: colors.accent,
  },
  sheetHelperText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  sheetError: {
    color: "#f2b7ad",
    fontSize: 13,
    lineHeight: 18,
  },
});
