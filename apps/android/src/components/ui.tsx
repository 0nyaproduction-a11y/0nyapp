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
import { borders, colors, radii, spacing, surfaces, typography } from "../theme/tokens";
import { FacetedLoader } from "./FacetedLoader";

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
    <Text accessibilityLabel={plus ? "0nya+" : "0nya"} allowFontScaling style={[styles.brand, style]}>
      <Text style={allWhite ? styles.brandText : styles.brandAccent}>0</Text>
      <Text style={styles.brandText}>nya</Text>
      {plus ? <Text style={allWhite ? styles.brandText : styles.brandPlusRed}>+</Text> : null}
    </Text>
  );
}

export function OnyaPlusBrandMark({
  fontSize = 16,
  style,
}: {
  fontSize?: number;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text accessibilityLabel="0nya+" allowFontScaling style={[{ fontSize, fontWeight: "800", letterSpacing: -0.2 }, style]}>
      <Text style={{ color: colors.accent }}>0</Text>
      <Text style={{ color: colors.text }}>nya</Text>
      <Text style={{ color: colors.plusRed }}>+</Text>
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

export function PlayTriangleIcon({
  color = "#FEFDFD",
  size = 10,
}: {
  color?: string;
  size?: number;
}) {
  const height = size;
  const width = Math.round((size * 5) / 6);
  return (
    <View
      style={{
        width: 0,
        height: 0,
        borderTopWidth: height / 2,
        borderBottomWidth: height / 2,
        borderLeftWidth: width,
        borderTopColor: "transparent",
        borderBottomColor: "transparent",
        borderLeftColor: color,
        marginLeft: 1.5,
      }}
    />
  );
}

export function TealCircleBadge({
  children,
  size = 24,
}: {
  children?: React.ReactNode;
  size?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.accent,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </View>
  );
}

export function PlusVectorIcon({ color = colors.accent, size = 11 }: { color?: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <View style={{ position: "absolute", width: size, height: 1.8, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ position: "absolute", width: 1.8, height: size, backgroundColor: color, borderRadius: 1 }} />
    </View>
  );
}

export function CheckmarkVectorIcon({ color = colors.accent, size = 12 }: { color?: string; size?: number }) {
  return (
    <Text style={{ color, fontSize: size, fontWeight: "700", lineHeight: size + 2 }}>{"\u2713"}</Text>
  );
}

export function VectorChevron({ color = "rgba(254, 253, 253, 0.42)", size = 6 }: { color?: string; size?: number }) {
  return (
    <View style={chevronStyles.wrap}>
      <View style={[chevronStyles.arm, { borderColor: color, width: size, height: size }]} />
    </View>
  );
}

const chevronStyles = StyleSheet.create({
  wrap: {
    width: 14,
    height: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  arm: {
    borderTopWidth: 1.8,
    borderRightWidth: 1.8,
    transform: [{ rotate: "45deg" }],
    marginRight: 2,
  },
});

export function GearIcon({ color = "rgba(254, 253, 253, 0.55)", size = 18 }: { color?: string; size?: number }) {
  const toothWidth = Math.max(3, Math.round(size * 0.22));
  const toothLength = Math.max(2, Math.round(size * 0.15));
  const coreSize = size - toothLength * 2;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <View style={{ position: "absolute", width: toothWidth, height: size, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ position: "absolute", width: size, height: toothWidth, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ position: "absolute", width: toothWidth, height: size, backgroundColor: color, borderRadius: 1, transform: [{ rotate: "45deg" }] }} />
      <View style={{ position: "absolute", width: size, height: toothWidth, backgroundColor: color, borderRadius: 1, transform: [{ rotate: "45deg" }] }} />
      <View
        style={{
          position: "absolute",
          width: coreSize + 2,
          height: coreSize + 2,
          borderRadius: (coreSize + 2) / 2,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: "absolute",
          width: Math.max(3, Math.round(coreSize * 0.42)),
          height: Math.max(3, Math.round(coreSize * 0.42)),
          borderRadius: Math.max(3, Math.round(coreSize * 0.42)) / 2,
          backgroundColor: surfaces.s2,
        }}
      />
    </View>
  );
}

export function BellIcon({
  color = "rgba(254, 253, 253, 0.70)",
  size = 17,
}: {
  color?: string;
  size?: number;
}) {
  const scale = size / 17;
  const loopWidth = Math.max(3, Math.round(3.5 * scale));
  const loopHeight = Math.max(2, Math.round(2 * scale));
  const bodyWidth = Math.max(8, Math.round(11 * scale));
  const bodyHeight = Math.max(6, Math.round(8.5 * scale));
  const flareWidth = Math.max(10, Math.round(14 * scale));
  const flareHeight = Math.max(1.5, Math.round(1.8 * scale));
  const clapperWidth = Math.max(2.5, Math.round(3.5 * scale));
  const clapperHeight = Math.max(1.5, Math.round(2 * scale));

  return (
    <View
      accessible={false}
      style={{
        alignItems: "center",
        height: size,
        justifyContent: "center",
        width: size,
      }}
    >
      <View
        style={{
          backgroundColor: color,
          borderTopLeftRadius: loopWidth / 2,
          borderTopRightRadius: loopWidth / 2,
          height: loopHeight,
          marginBottom: 0.5,
          width: loopWidth,
        }}
      />
      <View
        style={{
          backgroundColor: color,
          borderBottomLeftRadius: 1.5,
          borderBottomRightRadius: 1.5,
          borderTopLeftRadius: bodyWidth / 2,
          borderTopRightRadius: bodyWidth / 2,
          height: bodyHeight,
          width: bodyWidth,
        }}
      />
      <View
        style={{
          backgroundColor: color,
          borderRadius: flareHeight / 2,
          height: flareHeight,
          marginTop: -0.5,
          width: flareWidth,
        }}
      />
      <View
        style={{
          backgroundColor: color,
          borderBottomLeftRadius: clapperWidth / 2,
          borderBottomRightRadius: clapperWidth / 2,
          height: clapperHeight,
          marginTop: 0.5,
          width: clapperWidth,
        }}
      />
    </View>
  );
}

export function CoinDiscIcon({ size = 20 }: { size?: number }) {
  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: "rgba(229, 169, 60, 0.16)",
        borderColor: "#E5A93C",
        borderRadius: size / 2,
        borderWidth: 1,
        height: size,
        justifyContent: "center",
        width: size,
      }}
    >
      <Text
        style={{
          color: "#E5A93C",
          fontSize: Math.round(size * 0.58),
          fontWeight: "800",
          lineHeight: Math.round(size * 0.7),
          marginTop: -0.5,
        }}
      >
        C
      </Text>
    </View>
  );
}

export function ChaiIcon({
  color = colors.accent,
  size = 11,
}: {
  color?: string;
  size?: number;
}) {
  const cupWidth = Math.round(size * 0.72);
  const cupHeight = Math.round(size * 0.58);
  const saucerWidth = size;
  const saucerHeight = 1.2;
  const stroke = 1.2;
  const handleWidth = Math.max(2, Math.round(size * 0.22));
  const handleHeight = Math.max(3, Math.round(size * 0.32));

  return (
    <View
      accessible={false}
      style={{
        width: size + 2,
        height: size,
        justifyContent: "flex-end",
        alignItems: "center",
      }}
    >
      <View
        style={{
          width: cupWidth + handleWidth,
          height: cupHeight,
          flexDirection: "row",
          alignItems: "flex-start",
          marginBottom: 1,
        }}
      >
        <View
          style={{
            width: cupWidth,
            height: cupHeight,
            borderColor: color,
            borderWidth: stroke,
            borderBottomLeftRadius: Math.round(cupWidth * 0.35),
            borderBottomRightRadius: Math.round(cupWidth * 0.35),
            borderTopLeftRadius: 0.5,
            borderTopRightRadius: 0.5,
          }}
        />
        <View
          style={{
            width: handleWidth,
            height: handleHeight,
            borderColor: color,
            borderTopWidth: stroke,
            borderRightWidth: stroke,
            borderBottomWidth: stroke,
            borderLeftWidth: 0,
            borderTopRightRadius: Math.round(handleHeight * 0.5),
            borderBottomRightRadius: Math.round(handleHeight * 0.5),
            marginTop: 1,
          }}
        />
      </View>
      <View
        style={{
          width: saucerWidth,
          height: saucerHeight,
          backgroundColor: color,
          borderRadius: 0.6,
        }}
      />
    </View>
  );
}

export type CompactPillButtonProps = PropsWithChildren<{
  accessibilityLabel: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  onPress?: () => void | Promise<void>;
  size?: "sm" | "md" | "lg";
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  variant?: "primary" | "secondary" | "destructive";
}>;

export function CompactPillButton({
  accessibilityLabel,
  children,
  disabled,
  icon,
  onPress,
  size = "md",
  style,
  textStyle,
  variant = "primary",
}: CompactPillButtonProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.compactPill,
        size === "sm" && styles.compactPillSm,
        size === "lg" && styles.compactPillLg,
        variant === "primary" && styles.compactPillPrimary,
        variant === "secondary" && styles.compactPillSecondary,
        variant === "destructive" && styles.compactPillDestructive,
        disabled && styles.compactPillDisabled,
        pressed && !disabled && (variant === "destructive" ? styles.compactPillDestructivePressed : styles.compactPillPressed),
        style,
      ]}
    >
      {icon ? <View style={[styles.compactPillIconWrap, size === "sm" && styles.compactPillIconWrapSm]}>{icon}</View> : null}
      <Text
        style={[
          styles.compactPillText,
          size === "sm" && styles.compactPillTextSm,
          size === "lg" && styles.compactPillTextLg,
          variant === "primary" && styles.compactPillTextPrimary,
          variant === "secondary" && styles.compactPillTextSecondary,
          variant === "destructive" && styles.compactPillTextDestructive,
          disabled && styles.compactPillTextDisabled,
          textStyle,
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
      placeholderTextColor={colors.textDisabled}
      style={styles.field}
    />
  );
}

export { FacetedLoader } from "./FacetedLoader";

export function LoadingState() {
  return (
    <View style={[styles.loadingStateContainer]}>
      <FacetedLoader color={colors.accent} size={36} />
    </View>
  );
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
        variant="primary"
      >
        {primaryActionLabel}
      </Button>
      {secondaryActionLabel && onSecondaryAction ? (
        <Button accessibilityLabel={secondaryActionLabel} onPress={onSecondaryAction} variant="secondary">
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
  brandPlusRed: {
    color: colors.plusRed,
  },
  label: {
    ...typography.micro,
    color: colors.accent,
    textTransform: "uppercase",
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
  },
  card: {
    gap: 10,
    borderColor: borders.color,
    borderRadius: radii.sm,
    borderWidth: borders.width,
    backgroundColor: surfaces.s1,
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
    backgroundColor: surfaces.s1,
    borderColor: borders.color,
    borderRadius: radii.row,
    borderWidth: borders.width,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 56,
    paddingHorizontal: spacing.cardPadding,
    paddingVertical: 12,
  },
  navigationRowPressed: {
    backgroundColor: colors.surfaceSelected,
    borderColor: colors.borderSubtle,
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
    color: colors.textMuted,
  },
  navigationRowChevron: {
    color: colors.textMuted,
    fontSize: 22,
    lineHeight: 22,
  },
  button: {
    alignItems: "center",
    borderRadius: radii.cta,
    backgroundColor: colors.accent,
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  buttonPrimary: {
    borderRadius: radii.cta,
    backgroundColor: colors.accent,
    minHeight: 48,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  buttonSecondary: {
    backgroundColor: surfaces.s2,
    borderColor: colors.borderSubtle,
    borderRadius: radii.sm,
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
    backgroundColor: colors.surfacePressed,
    borderColor: "transparent",
  },
  buttonTextDisabled: {
    color: colors.textDisabled,
  },
  buttonPressed: {
    opacity: 0.82,
  },
  buttonText: {
    ...typography.label,
    color: colors.accentOnPrimary,
    fontWeight: "600",
    textTransform: "none",
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
    backgroundColor: surfaces.s1,
    borderColor: borders.color,
    borderRadius: radii.sm,
    borderWidth: borders.width,
    color: colors.text,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  error: {
    ...typography.caption,
    color: colors.error,
  },
  loadingStateContainer: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 120,
    padding: spacing.xl,
  },
  transientFeedback: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "rgba(3, 5, 4, 0.88)",
    borderColor: colors.borderSubtle,
    borderRadius: radii.pill,
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
  compactPill: {
    alignItems: "center",
    borderRadius: radii.pill,
    flexDirection: "row",
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  compactPillSm: {
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  compactPillLg: {
    minHeight: 46,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  compactPillPrimary: {
    backgroundColor: surfaces.s2,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
  },
  compactPillSecondary: {
    backgroundColor: "rgba(254, 253, 253, 0.05)",
    borderColor: "rgba(254, 253, 253, 0.10)",
    borderWidth: 1,
  },
  compactPillDestructive: {
    backgroundColor: "transparent",
    borderColor: "rgba(255, 141, 118, 0.20)",
    borderWidth: 1,
  },
  compactPillDisabled: {
    backgroundColor: "rgba(254, 253, 253, 0.04)",
    borderColor: "rgba(254, 253, 253, 0.08)",
    opacity: 0.6,
  },
  compactPillPressed: {
    backgroundColor: colors.surfacePressed,
    transform: [{ scale: 0.985 }],
  },
  compactPillDestructivePressed: {
    backgroundColor: "rgba(255, 141, 118, 0.08)",
  },
  compactPillIconWrap: {
    marginRight: 8,
  },
  compactPillIconWrapSm: {
    marginRight: 6,
  },
  compactPillText: {
    ...typography.label,
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.1,
    textTransform: "none",
  },
  compactPillTextSm: {
    fontSize: 13,
  },
  compactPillTextLg: {
    fontSize: 15,
  },
  compactPillTextPrimary: {
    color: "#FEFDFD",
  },
  compactPillTextSecondary: {
    color: colors.text,
  },
  compactPillTextDestructive: {
    color: "rgba(255, 141, 118, 0.85)",
  },
  compactPillTextDisabled: {
    color: colors.textDisabled,
  },
});
