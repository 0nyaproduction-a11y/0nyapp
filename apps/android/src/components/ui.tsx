import type { PropsWithChildren } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { borders, colors, radii, spacing } from "../theme/tokens";

type TextBlockProps = PropsWithChildren<{
  style?: StyleProp<TextStyle>;
}>;

export function Title({ children, style }: TextBlockProps) {
  return <Text style={[styles.title, style]}>{children}</Text>;
}

type BrandWordmarkProps = {
  plus?: boolean;
  style?: StyleProp<TextStyle>;
};

export function BrandWordmark({ plus = false, style }: BrandWordmarkProps) {
  return (
    <Text accessibilityLabel={plus ? "0nya Plus" : "0nya"} allowFontScaling style={[styles.brand, style]}>
      <Text style={styles.brandAccent}>0</Text>
      <Text style={styles.brandText}>{plus ? "nya Plus" : "nya"}</Text>
    </Text>
  );
}

export function Label({ children }: PropsWithChildren) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Body({ children, style }: TextBlockProps) {
  return <Text style={[styles.body, style]}>{children}</Text>;
}

export function Card({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}

type NavigationRowProps = {
  accessibilityLabel?: string;
  onPress: () => void;
  subtitle?: string;
  title: string;
};

// Compact tappable row (title + optional supporting line + chevron) for
// secondary navigation actions that should not compete visually with a
// screen's primary content, e.g. Restore/Sync, Buy Coins.
export function NavigationRow({ accessibilityLabel, onPress, subtitle, title }: NavigationRowProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? (subtitle ? `${title}. ${subtitle}` : title)}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.navigationRow, pressed && styles.navigationRowPressed]}
    >
      <View style={styles.navigationRowCopy}>
        <Text style={styles.navigationRowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.navigationRowSubtitle}>{subtitle}</Text> : null}
      </View>
      <Text style={styles.navigationRowChevron}>{"\u203A"}</Text>
    </Pressable>
  );
}

type ButtonProps = PropsWithChildren<{
  accessibilityLabel: string;
  disabled?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}>;

export function Button({ accessibilityLabel, children, disabled, onPress, style }: ButtonProps) {
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
        style,
      ]}
    >
      <Text style={styles.buttonText}>{children}</Text>
    </Pressable>
  );
}

type FieldProps = {
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoComplete?: TextInputProps["autoComplete"];
  accessibilityLabel: string;
  onChangeText: (value: string) => void;
  keyboardType?: TextInputProps["keyboardType"];
  maxLength?: number;
  placeholder: string;
  secureTextEntry?: boolean;
  textContentType?: TextInputProps["textContentType"];
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

type RecoveryStateProps = {
  body: string;
  primaryActionLabel: string;
  onPrimaryAction: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  variant?: "card" | "cinematic";
  title: string;
};

export function RecoveryState({
  body,
  onPrimaryAction,
  onSecondaryAction,
  primaryActionLabel,
  secondaryActionLabel,
  variant = "card",
  title,
}: RecoveryStateProps) {
  const content = (
    <>
      <Title style={variant === "cinematic" ? styles.recoveryTitleCinematic : undefined}>{title}</Title>
      <Body style={variant === "cinematic" ? styles.recoveryBodyCinematic : undefined}>{body}</Body>
      <Button
        accessibilityLabel={primaryActionLabel}
        onPress={onPrimaryAction}
        style={variant === "cinematic" ? styles.recoveryButtonCinematic : undefined}
      >
        {primaryActionLabel}
      </Button>
      {secondaryActionLabel && onSecondaryAction ? (
        <Button accessibilityLabel={secondaryActionLabel} onPress={onSecondaryAction}>
          {secondaryActionLabel}
        </Button>
      ) : null}
    </>
  );

  if (variant === "cinematic") {
    return <View style={styles.recoveryCinematic}>{content}</View>;
  }

  return (
    <Card>
      {content}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
  },
  brand: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 20,
  },
  brandAccent: {
    color: colors.accent,
  },
  brandText: {
    color: colors.text,
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
  recoveryCinematic: {
    alignItems: "center",
    flex: 1,
    gap: 14,
    justifyContent: "center",
    maxWidth: 340,
    alignSelf: "center",
    paddingHorizontal: 24,
  },
  recoveryTitleCinematic: {
    textAlign: "center",
  },
  recoveryBodyCinematic: {
    maxWidth: 300,
    textAlign: "center",
  },
  recoveryButtonCinematic: {
    alignSelf: "stretch",
    maxWidth: 240,
    width: "100%",
  },
  navigationRow: {
    alignItems: "center",
    backgroundColor: colors.backgroundSoft,
    borderColor: borders.color,
    borderRadius: radii.none,
    borderWidth: borders.width,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 56,
    paddingHorizontal: spacing.cardPadding,
    paddingVertical: 12,
  },
  navigationRowPressed: {
    backgroundColor: "rgba(13, 209, 188, 0.08)",
    borderColor: "rgba(232, 228, 218, 0.14)",
  },
  navigationRowCopy: {
    flex: 1,
    gap: 2,
    paddingRight: 12,
  },
  navigationRowTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  navigationRowSubtitle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  navigationRowChevron: {
    color: colors.muted,
    fontSize: 22,
    lineHeight: 22,
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
