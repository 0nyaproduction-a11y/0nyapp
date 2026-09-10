import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { borders, colors, radii, spacing, surfaces, typography } from "../theme/tokens";

type SubscriptionManagementModalProps = {
  endsAt?: string | null;
  onClose: () => void;
  onNavigateToRestoreSync: () => void;
  status?: "active" | "none" | null;
  visible: boolean;
};

function formatExpiryDate(dateString: string) {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(dateString));
  } catch {
    return dateString;
  }
}

export function SubscriptionManagementModal({
  endsAt,
  onClose,
  onNavigateToRestoreSync,
  status,
  visible,
}: SubscriptionManagementModalProps) {
  const insets = useSafeAreaInsets();
  const isPlus = status === "active";
  const hasExpiry = Boolean(isPlus && endsAt);
  const formattedExpiry = hasExpiry && endsAt ? formatExpiryDate(endsAt) : null;

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <Pressable onPress={onClose} style={styles.backdrop}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={[styles.sheet, { paddingBottom: Math.max(24, insets.bottom + 16) }]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Manage subscription</Text>
            <Pressable
              accessibilityLabel="Close manage subscription"
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [styles.closeIconBtn, pressed && styles.btnPressed]}
            >
              <Text style={styles.closeIconText}>✕</Text>
            </Pressable>
          </View>

          {/* Membership Card */}
          <View style={styles.membershipCard}>
            <View style={styles.brandRow}>
              <Text accessibilityLabel="0nya Plus" style={styles.brandTitle}>
                <Text style={styles.brand0}>0</Text>
                <Text style={styles.brandNya}>nya</Text>
                <Text style={styles.brandPlus}> Plus</Text>
              </Text>
            </View>

            {formattedExpiry ? (
              <Text style={styles.statusText}>Active until {formattedExpiry}</Text>
            ) : null}

            <Text style={styles.messageText}>
              {hasExpiry
                ? "Billing and renewal controls are awaiting launch."
                : "We couldn't find a store-managed subscription for this membership."}
            </Text>
          </View>

          {/* Action: Restore / Sync */}
          <Pressable
            accessibilityLabel="Restore or sync purchases and Plus status"
            accessibilityRole="button"
            onPress={() => {
              onClose();
              onNavigateToRestoreSync();
            }}
            style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
          >
            <Text style={styles.actionRowLabel}>Restore / Sync</Text>
            <Text style={styles.actionRowChevron}>›</Text>
          </Pressable>

          {/* Secondary: Close */}
          <Pressable
            accessibilityLabel="Close"
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.btnPressed]}
          >
            <Text style={styles.secondaryBtnText}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: surfaces.s2,
    borderTopColor: colors.borderSubtle,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: borders.width,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  closeIconBtn: {
    alignItems: "center",
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  closeIconText: {
    color: colors.textMuted,
    fontSize: 18,
    fontWeight: "600",
  },
  membershipCard: {
    backgroundColor: surfaces.s1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.md,
    borderWidth: borders.width,
    gap: 6,
    marginBottom: spacing.sm,
    padding: 14,
  },
  brandRow: {
    flexDirection: "row",
  },
  brandTitle: {
    ...typography.h3,
    fontSize: 16,
    fontWeight: "700",
  },
  brand0: {
    color: colors.accent,
  },
  brandNya: {
    color: colors.text,
  },
  brandPlus: {
    color: "#955E61",
  },
  statusText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "500",
  },
  messageText: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: 2,
  },
  actionRow: {
    alignItems: "center",
    backgroundColor: surfaces.s1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.pill,
    borderWidth: borders.width,
    flexDirection: "row",
    height: 48,
    justifyContent: "space-between",
    marginBottom: spacing.xs,
    paddingHorizontal: 16,
  },
  actionRowPressed: {
    backgroundColor: colors.surfacePressed,
    transform: [{ scale: 0.98 }],
  },
  actionRowLabel: {
    ...typography.label,
    color: colors.text,
    fontSize: 14,
    fontWeight: "500",
  },
  actionRowChevron: {
    color: colors.accent,
    fontSize: 18,
    lineHeight: 18,
  },
  secondaryBtn: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderRadius: radii.pill,
    height: 40,
    justifyContent: "center",
    marginTop: 4,
  },
  secondaryBtnText: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "500",
  },
  btnPressed: {
    opacity: 0.7,
  },
});