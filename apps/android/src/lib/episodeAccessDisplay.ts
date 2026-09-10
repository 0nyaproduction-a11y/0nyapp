import type { ApiEpisode, EpisodeAccess } from "../types/api";

export type CanonicalEpisodeAccessState =
  | "free"
  | "unlocked"
  | "included"
  | "preview"
  | "coin_required"
  | "unavailable";

export type EpisodeAccessMarker = {
  accessibilityLabel: string;
  icon?: "coin" | "free" | "preview" | "included" | "unlocked" | "unavailable" | "rewarded";
  label?: string;
  tone: "available" | "locked" | "muted" | "included" | "unlocked" | "coin" | "unavailable";
  variant?: "ad" | "coin" | "plus";
};

export type EpisodeAccessDisplay = {
  accessibilityLabel: string;
  canPreview: boolean;
  coinPrice?: number;
  isLocked: boolean;
  label: string;
  markers: EpisodeAccessMarker[];
  stateKind: CanonicalEpisodeAccessState;
};

export type EpisodeAccessResolverOptions = {
  isGuest?: boolean;
  isPlus?: boolean;
};

export function resolveEpisodeAccess(
  episode: ApiEpisode,
  access: EpisodeAccess | undefined,
  options?: EpisodeAccessResolverOptions,
): CanonicalEpisodeAccessState {
  // Precedence 1: Unavailable
  if (access?.kind === "locked" && access?.label === "Unavailable") {
    return "unavailable";
  }

  // Precedence 2: CMS Free
  const isFree = Boolean(episode.isFree || access?.kind === "free");
  if (isFree) {
    return "free";
  }

  // Precedence 3: Coin Unlocked (signed-in user permanently unlocked with Coins)
  if (access?.kind === "owned") {
    return "unlocked";
  }

  // Precedence 4: Plus Included (active Plus subscriber receives full catalog access to all published episodes)
  const isPlusSubscriber = Boolean(
    options?.isPlus ||
      ((access?.kind === "included" || access?.kind === "subscription") && Boolean(access?.canWatch)),
  );
  if (isPlusSubscriber) {
    return "included";
  }
  if ((access?.kind === "included" || access?.kind === "subscription") && access?.canWatch) {
    return "included";
  }

  // If access is marked canWatch without a specific kind above, treat as unlocked
  if (access?.canWatch) {
    return "unlocked";
  }

  // Precedence 5: Plus-exclusive (episode has plusAccess, but coin unlock is disabled)
  if (episode.plusAccess && (!episode.coinUnlockEnabled || episode.coinPrice <= 0)) {
    return "included";
  }

  // Precedence 6: Coin Required (locked episode requiring coins)
  return "coin_required";
}

export function getEpisodeAccessDisplay(
  episode: ApiEpisode,
  access: EpisodeAccess | undefined,
  options?: EpisodeAccessResolverOptions,
): EpisodeAccessDisplay {
  const stateKind = resolveEpisodeAccess(episode, access, options);
  const isPlusSubscriber = Boolean(
    options?.isPlus ||
      ((access?.kind === "included" || access?.kind === "subscription") && Boolean(access?.canWatch)),
  );

  switch (stateKind) {
    case "free":
      return {
        accessibilityLabel: "Free",
        canPreview: false,
        isLocked: false,
        label: "Free",
        markers: isPlusSubscriber
          ? []
          : [{ accessibilityLabel: "Free", icon: "free", tone: "available" }],
        stateKind,
      };

    case "unlocked":
      return {
        accessibilityLabel: "Unlocked",
        canPreview: false,
        isLocked: false,
        label: "Unlocked",
        markers: isPlusSubscriber
          ? []
          : [{ accessibilityLabel: "Unlocked", icon: "unlocked", tone: "unlocked" }],
        stateKind,
      };

    case "included": {
      const isLocked = !isPlusSubscriber;
      const canPreview = isLocked && Boolean(episode.lockedPreviewSeconds > 0 || options?.isGuest);

      if (isLocked && episode.rewardedUnlockEnabled) {
        const accessibilityLabel = canPreview
          ? "Watch ad or unlock with 0nya Plus, preview available"
          : "Watch ad or unlock with 0nya Plus";

        return {
          accessibilityLabel,
          canPreview,
          isLocked,
          label: "Ad or 0nya Plus",
          markers: [
            {
              accessibilityLabel: "Watch ad to unlock",
              icon: "rewarded",
              tone: "muted",
              variant: "ad",
            },
            {
              accessibilityLabel: "Included with 0nya Plus",
              icon: "included",
              tone: "locked",
              variant: "plus",
            },
          ],
          stateKind,
        };
      }

      const accessibilityLabel = isLocked
        ? canPreview
          ? "Included with Plus, preview available"
          : "Included with Plus"
        : "Included with Plus";

      return {
        accessibilityLabel,
        canPreview,
        isLocked,
        label: "Included with Plus",
        markers: isLocked
          ? [
              {
                accessibilityLabel: "Included with Plus",
                icon: "included",
                tone: "locked",
                variant: "plus",
              },
            ]
          : [],
        stateKind,
      };
    }

    case "preview":
      return {
        accessibilityLabel: "Preview",
        canPreview: true,
        isLocked: true,
        label: "Preview",
        markers: [{ accessibilityLabel: "Preview", icon: "preview", tone: "muted" }],
        stateKind,
      };

    case "unavailable":
      return {
        accessibilityLabel: "Unavailable",
        canPreview: false,
        isLocked: true,
        label: "Unavailable",
        markers: [{ accessibilityLabel: "Unavailable", icon: "unavailable", tone: "unavailable" }],
        stateKind,
      };

    case "coin_required": {
      if (isPlusSubscriber) {
        return {
          accessibilityLabel: "Included with Plus",
          canPreview: false,
          isLocked: false,
          label: "Included with Plus",
          markers: [],
          stateKind: "included",
        };
      }

      const coinPrice = episode.coinPrice > 0 ? episode.coinPrice : 10;
      const canPreview = Boolean(episode.lockedPreviewSeconds > 0 || options?.isGuest);
      const coinLabel = `${coinPrice} Coins`;

      if (episode.plusAccess) {
        const accessibilityLabel = canPreview
          ? `${coinLabel} or 0nya Plus, preview available`
          : `${coinLabel} or 0nya Plus`;

        return {
          accessibilityLabel,
          canPreview,
          coinPrice,
          isLocked: true,
          label: `${coinLabel} or Plus`,
          markers: [
            {
              accessibilityLabel: coinLabel,
              icon: "coin",
              label: String(coinPrice),
              tone: "coin",
              variant: "coin",
            },
            {
              accessibilityLabel: "Included with 0nya Plus",
              icon: "included",
              tone: "locked",
              variant: "plus",
            },
          ],
          stateKind,
        };
      }

      const accessibilityLabel = canPreview ? `${coinLabel}, preview available` : coinLabel;

      return {
        accessibilityLabel,
        canPreview,
        coinPrice,
        isLocked: true,
        label: coinLabel,
        markers: [
          {
            accessibilityLabel: coinLabel,
            icon: "coin",
            label: String(coinPrice),
            tone: "coin",
            variant: "coin",
          },
        ],
        stateKind,
      };
    }
  }
}
