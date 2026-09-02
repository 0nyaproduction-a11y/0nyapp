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
import { borders, colors, radii, spacing, typography } from "../theme/tokens";

type TextBlockProps = PropsWithChildren<{
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
}>;

type TransientFeedbackProps = {
  message: string;
  style?: StyleProp<ViewStyle>;
  visible: boolean;
};

export function Title({ children, numberOfLines, style }: TextBlockProps) {
  return <Text numberOfLines={numberOfLines} style={[styles.title, style]}>{children}</Text>;
}

type BrandWordmarkProps = {
  allWhite?: boolean;
  plus?: boolean;
  style?: StyleProp<TextStyle>;
};

export function BrandWordmark({ allWhite = false, plus = false, style }: BrandWordmarkProps) {
  return (
    <Text accessibilityLabel={plus ? "0nya Plus" : "0nya"} allowFontScaling style={[styles.brand, style]}>
      <Text style={allWhite ? styles.brandText : styles.brandAccent}>0</Text>
      <Text style={styles.brandText}>{plus ? "nya Plus" : "nya"}</Text>
    </Text>
  );
}

export function Label({ children, numberOfLines, style }: TextBlockProps) {
  return <Text numberOfLines={numberOfLines} style={[styles.label, style]}>{children}</Text>;
}

export function Body({ children, numberOfLines, style }: TextBlockProps) {
  return <Text numberOfLines={numberOfLines} style={[styles.body, style]}>{children}</Text>;
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

type ButtonVariant = "primary" | "secondary" | "text" | "legacy";

type ButtonProps = PropsWithChildren<{
  accessibilityLabel: string;
  disabled?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  variant?: ButtonVariant;
}>;

export function Button({ accessibilityLabel, children, disabled, onPress, style, variant = "legacy" }: ButtonProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === "primary" && styles.buttonPrimary,
        variant === "secondary" && styles.buttonSecondary,
        variant === "text" && styles.buttonTextVariant,
        disabled && styles.buttonDisabled,
        pressed && styles.buttonPressed,
        style,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          variant === "primary" && styles.buttonTextPrimary,
          variant === "secondary" && styles.buttonTextSecondary,
          variant === "text" && styles.buttonTextLink,
          disabled && styles.buttonTextDisabled,
        ]}
      >
        {children}
      </Text>
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

export function TransientFeedback({ message, style, visible }: TransientFeedbackProps) {
  if (!visible) {
    return null;
  }

  return (
    <View pointerEvents="none" style={[styles.transientFeedback, style]}>
      <Text style={styles.transientFeedbackIcon}>{"\u2713"}</Text>
      <Text style={styles.transientFeedbackText}>{message}</Text>
    </View>
  );
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
    ...typography.h1,
    color: colors.text,
  },
  brand: {
    ...typography.body,
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
    ...typography.micro,
    color: colors.accent,
    textTransform: "uppercase",
  },
  body: {
    ...typography.body,
    color: colors.muted,
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
    ...typography.body,
    color: colors.text,
    fontFamily: typography.label.fontFamily,
    fontWeight: "500",
  },
  navigationRowSubtitle: {
    ...typography.caption,
    color: colors.muted,
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
  buttonPrimary: {
    borderRadius: radii.md,
    minHeight: 50,
    paddingHorizontal: 20,
    paddingVertical: 13,
  },
  buttonSecondary: {
    backgroundColor: colors.bgElevated,
    borderColor: colors.borderSubtle,
    borderRadius: radii.md,
    borderWidth: borders.width,
  },
  buttonTextVariant: {
    backgroundColor: "transparent",
    borderWidth: 0,
    minHeight: 44,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  buttonDisabled: {
    backgroundColor: "rgba(232, 228, 218, 0.08)",
  },
  buttonTextDisabled: {
    color: "rgba(232, 228, 218, 0.45)",
  },
  buttonPressed: {
    opacity: 0.82,
  },
  buttonText: {
    ...typography.label,
    color: "#11100e",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  buttonTextPrimary: {
    ...typography.label,
    color: colors.accentOnPrimary,
    fontWeight: "600",
    textTransform: "none",
  },
  buttonTextSecondary: {
    ...typography.label,
    color: colors.text,
    fontWeight: "600",
    textTransform: "none",
  },
  buttonTextLink: {
    ...typography.label,
    color: colors.accent,
    fontWeight: "600",
    textTransform: "none",
  },
  field: {
    ...typography.body,
    borderColor: borders.color,
    borderRadius: radii.none,
    borderWidth: borders.width,
    color: colors.text,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  error: {
    ...typography.caption,
    color: "#ff8d76",
  },
  transientFeedback: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "rgba(5, 10, 10, 0.86)",
    borderColor: "rgba(232, 228, 218, 0.12)",
    borderRadius: 999,
    borderWidth: borders.width,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    maxWidth: "86%",
    minHeight: 38,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  transientFeedbackIcon: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "900",
  },
  transientFeedbackText: {
    ...typography.label,
    color: colors.text,
    fontWeight: "600",
  },
});
