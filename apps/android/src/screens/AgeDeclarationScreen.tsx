import { CommonActions } from "@react-navigation/native";
import { useEffect, useRef, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "../components/Screen";
import { BrandWordmark } from "../components/ui";
import { consumeAuthReturnIntent, resolveReturnRoutes } from "../lib/authReturnIntentStorage";
import { buildPrivacyUrl, buildTermsUrl } from "../lib/content-links";
import { useAppLanguage } from "../lib/appLanguage";
import type { RootStackScreenProps } from "../navigation/types";
import { colors, spacing, surfaces } from "../theme/tokens";

type Props = RootStackScreenProps<"AgeDeclaration">;

export function AgeDeclarationScreen({ navigation }: Props) {
  const { t } = useAppLanguage();
  const [isThirteenOrOlder, setIsThirteenOrOlder] = useState(false);
  const [isEighteenOrOlder, setIsEighteenOrOlder] = useState(false);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const isOpeningLinkRef = useRef(false);

  // Ensure no production debug or settings gear appears in headerRight
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => null,
    });
  }, [navigation]);

  const is13DirectlySelected = isThirteenOrOlder && !isEighteenOrOlder;
  const is18Selected = isEighteenOrOlder;
  const is13Satisfied = isThirteenOrOlder || isEighteenOrOlder;
  const is13Included = is18Selected;
  const canContinue = is13Satisfied && hasAcceptedTerms;

  function handleThirteenPress() {
    if (is13DirectlySelected) {
      setIsThirteenOrOlder(false);
      setIsEighteenOrOlder(false);
    } else {
      setIsThirteenOrOlder(true);
      setIsEighteenOrOlder(false);
    }
  }

  function handleEighteenPress() {
    if (is18Selected) {
      setIsEighteenOrOlder(false);
      setIsThirteenOrOlder(false);
    } else {
      setIsEighteenOrOlder(true);
      setIsThirteenOrOlder(true);
    }
  }

  const handleOpenLink = async (url: string | null) => {
    if (!url) return;
    isOpeningLinkRef.current = true;
    setTimeout(() => {
      isOpeningLinkRef.current = false;
    }, 600);
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    } catch (err) {
      console.warn("Failed to open link:", url, err);
    }
  };

  async function handleContinue() {
    const intent = await consumeAuthReturnIntent();

    navigation.dispatch(
      CommonActions.reset(
        resolveReturnRoutes(intent ?? { kind: "home" }),
      ),
    );
  }

  return (
    <Screen>
      <View style={styles.container}>
        {/* Intro section */}
        <View style={styles.intro}>
          <View style={styles.brandRow}>
            <BrandWordmark style={styles.brand} />
          </View>
          <Text style={styles.heading}>
            {t("age_declaration.heading", "A quick check before you start")}
          </Text>
          <Text style={styles.supportingCopy}>
            {t(
              "age_declaration.supporting_copy",
              "Confirm your age and agree to the terms to finish setting up your 0nya account."
            )}
          </Text>
        </View>

        {/* Age declaration cards */}
        <View style={styles.ageCardsContainer}>
          {/* 13+ Card */}
          <Pressable
            accessibilityLabel={
              is13Included
                ? t("age_declaration.thirteen_plus_included", "I’m 13 or older, included with 18+")
                : t("age_declaration.thirteen_plus", "I’m 13 or older")
            }
            accessibilityRole="radio"
            accessibilityState={{ checked: is13Satisfied }}
            onPress={handleThirteenPress}
            style={({ pressed }) => [
              styles.ageCard,
              is13DirectlySelected && styles.ageCardSelected,
              is13Included && styles.ageCardIncluded,
              pressed && styles.ageCardPressed,
            ]}
          >
            <View style={styles.ageCardLeft}>
              <View
                style={[
                  styles.ageBadge,
                  is13DirectlySelected && styles.ageBadgeSelected,
                  is13Included && styles.ageBadgeIncluded,
                ]}
              >
                <Text
                  style={[
                    styles.ageBadgeText,
                    (is13DirectlySelected || is13Included) && styles.ageBadgeTextSelected,
                  ]}
                >
                  13+
                </Text>
              </View>
              <Text
                style={[
                  styles.ageCardLabel,
                  (is13DirectlySelected || is13Included) && styles.ageCardLabelSelected,
                ]}
              >
                {t("age_declaration.thirteen_plus", "I’m 13 or older")}
              </Text>
            </View>
            {is13Included ? (
              <View style={styles.includedBadge}>
                <Text style={styles.includedBadgeText}>
                  {t("age_declaration.included", "Included")}
                </Text>
              </View>
            ) : (
              <View style={[styles.radioCircle, is13DirectlySelected && styles.radioCircleSelected]}>
                {is13DirectlySelected ? <View style={styles.radioDot} /> : null}
              </View>
            )}
          </Pressable>

          {/* 18+ Card */}
          <Pressable
            accessibilityLabel={t("age_declaration.eighteen_plus", "I’m 18 or older")}
            accessibilityRole="radio"
            accessibilityState={{ checked: is18Selected }}
            onPress={handleEighteenPress}
            style={({ pressed }) => [
              styles.ageCard,
              is18Selected && styles.ageCardSelected,
              pressed && styles.ageCardPressed,
            ]}
          >
            <View style={styles.ageCardLeft}>
              <View style={[styles.ageBadge, is18Selected && styles.ageBadgeSelected]}>
                <Text style={[styles.ageBadgeText, is18Selected && styles.ageBadgeTextSelected]}>
                  18+
                </Text>
              </View>
              <View style={styles.ageCardTextGroup}>
                <Text style={[styles.ageCardLabel, is18Selected && styles.ageCardLabelSelected]}>
                  {t("age_declaration.eighteen_plus", "I’m 18 or older")}
                </Text>
                <Text style={styles.ageCardSubtext}>
                  {t("age_declaration.includes_thirteen", "Includes 13+")}
                </Text>
              </View>
            </View>
            <View style={[styles.radioCircle, is18Selected && styles.radioCircleSelected]}>
              {is18Selected ? <View style={styles.radioDot} /> : null}
            </View>
          </Pressable>
        </View>

        {/* Agreement consent block */}
        <Pressable
          accessibilityLabel={t(
            "age_declaration.agreement_accessibility",
            "I agree to the Terms of Use and Privacy Policy"
          )}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: hasAcceptedTerms }}
          onPress={() => {
            if (isOpeningLinkRef.current) return;
            setHasAcceptedTerms((current) => !current);
          }}
          style={({ pressed }) => [
            styles.agreementBlock,
            hasAcceptedTerms && styles.agreementBlockChecked,
            pressed && styles.agreementBlockPressed,
          ]}
        >
          <View style={[styles.checkbox, hasAcceptedTerms && styles.checkboxChecked]}>
            {hasAcceptedTerms ? (
              <View style={styles.checkmark}>
                <View style={styles.checkmarkShort} />
                <View style={styles.checkmarkLong} />
              </View>
            ) : null}
          </View>

          <Text style={styles.agreementText}>
            {t("age_declaration.agree_prefix", "I agree to the")}{" "}
            <Text
              accessibilityRole="link"
              onPress={() => void handleOpenLink(buildTermsUrl())}
              style={styles.linkText}
            >
              {t("settings.terms", "Terms of Use")}
            </Text>{" "}
            {t("age_declaration.agree_and", "and")}{" "}
            <Text
              accessibilityRole="link"
              onPress={() => void handleOpenLink(buildPrivacyUrl())}
              style={styles.linkText}
            >
              {t("settings.privacy_policy", "Privacy Policy")}
            </Text>
            .
          </Text>
        </Pressable>

        {/* Primary Action CTA & Footer */}
        <View style={styles.actionSection}>
          <Pressable
            accessibilityLabel={t("age_declaration.continue", "Continue")}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canContinue }}
            disabled={!canContinue}
            onPress={handleContinue}
            style={({ pressed }) => [
              styles.ctaButton,
              canContinue ? styles.ctaButtonActive : styles.ctaButtonDisabled,
              pressed && canContinue && styles.ctaButtonPressed,
            ]}
          >
            <Text
              style={[
                styles.ctaButtonText,
                canContinue ? styles.ctaButtonTextActive : styles.ctaButtonTextDisabled,
              ]}
            >
              {t("age_declaration.continue", "Continue")}
            </Text>
          </Pressable>

          <Text style={styles.footerText}>
            {t(
              "age_declaration.parental_controls_notice",
              "Parental controls are available in Settings."
            )}
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
    paddingTop: spacing.xs,
  },
  intro: {
    gap: 6,
  },
  brandRow: {
    paddingBottom: spacing.xs,
  },
  brand: {
    fontSize: 20,
    lineHeight: 24,
  },
  heading: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "600",
    lineHeight: 28,
  },
  supportingCopy: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  ageCardsContainer: {
    gap: 10,
  },
  ageCard: {
    alignItems: "center",
    backgroundColor: surfaces.s1,
    borderColor: colors.borderSubtle,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  ageCardSelected: {
    backgroundColor: "rgba(43, 126, 125, 0.12)",
    borderColor: colors.accent,
  },
  ageCardIncluded: {
    backgroundColor: "rgba(43, 126, 125, 0.08)",
    borderColor: "rgba(43, 126, 125, 0.35)",
  },
  ageCardPressed: {
    opacity: 0.85,
  },
  ageCardLeft: {
    alignItems: "center",
    flexDirection: "row",
    flex: 1,
    gap: 12,
  },
  ageBadge: {
    alignItems: "center",
    backgroundColor: "rgba(254, 253, 253, 0.07)",
    borderRadius: 8,
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  ageBadgeSelected: {
    backgroundColor: "rgba(43, 126, 125, 0.28)",
  },
  ageBadgeIncluded: {
    backgroundColor: "rgba(43, 126, 125, 0.18)",
  },
  ageBadgeText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
  },
  ageBadgeTextSelected: {
    color: colors.accent,
  },
  includedBadge: {
    alignItems: "center",
    backgroundColor: "rgba(43, 126, 125, 0.16)",
    borderColor: "rgba(43, 126, 125, 0.32)",
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  includedBadgeText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  ageCardTextGroup: {
    gap: 2,
  },
  ageCardLabel: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: "500",
  },
  ageCardLabelSelected: {
    color: colors.text,
    fontWeight: "600",
  },
  ageCardSubtext: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 14,
  },
  radioCircle: {
    alignItems: "center",
    borderColor: "rgba(254, 253, 253, 0.22)",
    borderRadius: 10,
    borderWidth: 1.5,
    height: 20,
    justifyContent: "center",
    marginLeft: 12,
    width: 20,
  },
  radioCircleSelected: {
    borderColor: colors.accent,
  },
  radioDot: {
    backgroundColor: colors.accent,
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  agreementBlock: {
    alignItems: "center",
    backgroundColor: surfaces.s1,
    borderColor: colors.borderSubtle,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  agreementBlockChecked: {
    borderColor: "rgba(43, 126, 125, 0.40)",
  },
  agreementBlockPressed: {
    opacity: 0.85,
  },
  checkbox: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderColor: "rgba(254, 253, 253, 0.32)",
    borderRadius: 6,
    borderWidth: 1.5,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  checkboxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkmark: {
    height: 12,
    position: "relative",
    width: 12,
  },
  checkmarkLong: {
    backgroundColor: colors.accentOnPrimary,
    height: 2,
    left: 4,
    position: "absolute",
    top: 5,
    transform: [{ rotate: "-45deg" }],
    width: 8,
  },
  checkmarkShort: {
    backgroundColor: colors.accentOnPrimary,
    height: 2,
    left: 1,
    position: "absolute",
    top: 7,
    transform: [{ rotate: "45deg" }],
    width: 4,
  },
  agreementText: {
    color: colors.textSecondary,
    flex: 1,
    fontSize: 13.5,
    lineHeight: 19,
  },
  linkText: {
    color: colors.accent,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  actionSection: {
    gap: 12,
    marginTop: spacing.sm,
  },
  ctaButton: {
    alignItems: "center",
    borderRadius: 16,
    height: 50,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 20,
  },
  ctaButtonActive: {
    backgroundColor: colors.accent,
  },
  ctaButtonDisabled: {
    backgroundColor: "rgba(254, 253, 253, 0.06)",
    borderColor: "rgba(254, 253, 253, 0.12)",
    borderWidth: 1,
  },
  ctaButtonPressed: {
    opacity: 0.86,
  },
  ctaButtonText: {
    fontSize: 15,
    fontWeight: "700",
  },
  ctaButtonTextActive: {
    color: colors.accentOnPrimary,
  },
  ctaButtonTextDisabled: {
    color: colors.textDisabled,
  },
  footerText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
});
