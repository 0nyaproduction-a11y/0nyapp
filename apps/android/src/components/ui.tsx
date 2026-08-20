import type { PropsWithChildren } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { borders, colors, radii, spacing } from "../theme/tokens";

export function Title({ children }: PropsWithChildren) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Label({ children }: PropsWithChildren) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Body({ children }: PropsWithChildren) {
  return <Text style={styles.body}>{children}</Text>;
}

export function Card({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}

type ButtonProps = PropsWithChildren<{
  accessibilityLabel: string;
  disabled?: boolean;
  onPress: () => void;
}>;

export function Button({ accessibilityLabel, children, disabled, onPress }: ButtonProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        disabled && styles.buttonDisabled,
        pressed && styles.buttonPressed,
      ]}
    >
      <Text style={styles.buttonText}>{children}</Text>
    </Pressable>
  );
}

type FieldProps = {
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  accessibilityLabel: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  value: string;
};

export function Field(props: FieldProps) {
  return (
    <TextInput
      {...props}
      placeholderTextColor="#8a8a8a"
      style={styles.field}
    />
  );
}

export function LoadingState() {
  return <ActivityIndicator color={colors.accent} size="large" />;
}

export function ErrorText({ children }: PropsWithChildren) {
  return <Text style={styles.error}>{children}</Text>;
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
  },
  label: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  body: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    gap: 10,
    borderColor: borders.color,
    borderRadius: radii.none,
    borderWidth: borders.width,
    backgroundColor: colors.surface,
    padding: spacing.cardPadding,
  },
  button: {
    alignItems: "center",
    borderRadius: radii.none,
    backgroundColor: colors.accent,
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  buttonDisabled: {
    // legacy non-tokenized value: no verified web disabled-button color exists
    // (web expresses disabled state via opacity, not a distinct fill color)
    backgroundColor: "#3a3834",
  },
  buttonPressed: {
    opacity: 0.82,
  },
  buttonText: {
    // legacy non-tokenized value: retained for contrast against the accent fill
    color: "#11100e",
    fontSize: 14,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  field: {
    borderColor: borders.color,
    borderRadius: radii.none,
    borderWidth: borders.width,
    color: colors.text,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  error: {
    // legacy non-tokenized value: no verified web error/alert color equivalent
    color: "#ff8d76",
    fontSize: 14,
    lineHeight: 20,
  },
});
