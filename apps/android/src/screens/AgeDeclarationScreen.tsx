import { CommonActions } from "@react-navigation/native";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "../components/Screen";
import { consumeAuthReturnIntent, resolveReturnRoutes } from "../lib/authReturnIntentStorage";
import type { RootStackScreenProps } from "../navigation/types";
import { borders, colors, radii } from "../theme/tokens";

type Props = RootStackScreenProps<"AgeDeclaration">;

export function AgeDeclarationScreen({ navigation }: Props) {
  const [isThirteenOrOlder, setIsThirteenOrOlder] = useState(false);
  const [isEighteenOrOlder, setIsEighteenOrOlder] = useState(false);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);

  const canContinue = isThirteenOrOlder && hasAcceptedTerms;

  function handleThirteenToggle() {
    setIsThirteenOrOlder((current) => {
      const next = !current;

      if (!next) {
        setIsEighteenOrOlder(false);
      }

      return next;
    });
  }

  function handleEighteenToggle() {
    setIsEighteenOrOlder((current) => {
      const next = !current;

      if (next) {
        setIsThirteenOrOlder(true);
      }

      return next;
    });
  }

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
      <View style={styles.intro}>
        <Text style={styles.description}>
          Confirm your age and review the terms for your 0nya account.
        </Text>
      </View>

      <View style={styles.declarations}>
        <DeclarationRow
          ageMarker="13+"
          checked={isThirteenOrOlder}
          label="I confirm that I am 13 years or older."
          onPress={handleThirteenToggle}
        />
        <DeclarationRow
          ageMarker="18+"
          checked={isEighteenOrOlder}
          label="I confirm that I am 18 years or older."
          onPress={handleEighteenToggle}
          helper="Selecting 18+ also confirms 13+."
        />
        <DeclarationRow
          checked={hasAcceptedTerms}
          label={
            <Text>
              I agree to the <Text style={styles.linkText}>Terms of Use</Text> and acknowledge the{" "}
              <Text style={styles.linkText}>Privacy Policy</Text>.
            </Text>
          }
          onPress={() => setHasAcceptedTerms((current) => !current)}
        />
      </View>

      <View style={styles.infoRow}>
        <Text style={styles.infoText}>Parental controls can be managed in Settings.</Text>
      </View>

      <PrimaryAction disabled={!canContinue} onPress={handleContinue} />
    </Screen>
  );
}

type DeclarationRowProps = {
  ageMarker?: string;
  checked: boolean;
  helper?: string;
  label: React.ReactNode;
  onPress: () => void;
};

function DeclarationRow({ ageMarker, checked, helper, label, onPress }: DeclarationRowProps) {
  return (
    <Pressable
      accessibilityLabel={typeof label === "string" ? label : "Terms and privacy acceptance"}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onPress}
      style={({ pressed }) => [styles.declarationRow, pressed && styles.declarationRowPressed]}
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked ? (
          <View style={styles.checkmark}>
            <View style={styles.checkmarkShort} />
            <View style={styles.checkmarkLong} />
          </View>
        ) : null}
      </View>
      <View style={styles.declarationCopy}>
        <View style={styles.declarationLine}>
          <Text style={styles.declarationText}>{label}</Text>
          {ageMarker ? <Text style={styles.ageMarker}>{ageMarker}</Text> : null}
        </View>
        {helper ? <Text style={styles.helperText}>{helper}</Text> : null}
      </View>
    </Pressable>
  );
}

function PrimaryAction({ disabled, onPress }: { disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel="Continue to Home"
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryAction,
        disabled && styles.primaryActionDisabled,
        pressed && !disabled && styles.primaryActionPressed,
      ]}
    >
      <Text style={[styles.primaryActionText, disabled && styles.primaryActionTextDisabled]}>
        Continue
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ageMarker: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
    marginLeft: 12,
  },
  checkmark: {
    height: 14,
    position: "relative",
    width: 14,
  },
  checkmarkLong: {
    backgroundColor: colors.background,
    height: 2,
    left: 5,
    position: "absolute",
    top: 6,
    transform: [{ rotate: "-45deg" }],
    width: 10,
  },
  checkmarkShort: {
    backgroundColor: colors.background,
    height: 2,
    left: 1,
    position: "absolute",
    top: 8,
    transform: [{ rotate: "45deg" }],
    width: 6,
  },
  checkbox: {
    alignItems: "center",
    backgroundColor: colors.background,
    borderColor: "rgba(232, 228, 218, 0.34)",
    borderWidth: borders.width,
    height: 24,
    justifyContent: "center",
    marginTop: 2,
    width: 24,
  },
  checkboxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  declarationCopy: {
    flex: 1,
    gap: 8,
  },
  declarationLine: {
    alignItems: "flex-start",
    flexDirection: "row",
    flex: 1,
    justifyContent: "space-between",
  },
  declarationRow: {
    alignItems: "flex-start",
    borderBottomColor: borders.color,
    borderBottomWidth: borders.width,
    flexDirection: "row",
    gap: 14,
    minHeight: 72,
    paddingVertical: 18,
  },
  declarationRowPressed: {
    opacity: 0.82,
  },
  declarations: {
    marginTop: 14,
  },
  declarationText: {
    color: colors.text,
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 23,
  },
  description: {
    color: "rgba(232, 228, 218, 0.70)",
    fontSize: 16,
    lineHeight: 23,
    maxWidth: 320,
  },
  helperText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  infoRow: {
    marginTop: 4,
  },
  infoText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  intro: {
    paddingTop: 8,
  },
  linkText: {
    color: colors.accent,
  },
  primaryAction: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: radii.none,
    justifyContent: "center",
    minHeight: 54,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  primaryActionDisabled: {
    backgroundColor: colors.surface,
    borderColor: borders.color,
    borderWidth: borders.width,
  },
  primaryActionPressed: {
    opacity: 0.84,
  },
  primaryActionText: {
    color: colors.background,
    fontSize: 15,
    fontWeight: "800",
  },
  primaryActionTextDisabled: {
    color: "rgba(232, 228, 218, 0.32)",
  },
});
