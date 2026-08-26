import type { ApiEpisode, EpisodeAccess } from "../types/api";

export type EpisodeAccessMarker = {
  accessibilityLabel: string;
  icon?: "coin";
  label: string;
  tone: "available" | "locked" | "muted";
};

export type EpisodeAccessDisplay = {
  accessibilityLabel: string;
  isLocked: boolean;
  label: string;
  markers: EpisodeAccessMarker[];
};

export function getEpisodeAccessDisplay(
  episode: ApiEpisode,
  access: EpisodeAccess | undefined,
): EpisodeAccessDisplay {
  if (access?.canWatch) {
    const label = access.kind === "free" || episode.isFree ? "Free" : getPlayableLabel(access);
    const markers = getPlayableMarkers(access, episode, label);

    return {
      accessibilityLabel: markers.map((marker) => marker.accessibilityLabel).join(", "),
      isLocked: false,
      label,
      markers,
    };
  }

  const markers = getUnlockMethodMarkers(episode);
  const label = markers.length
    ? markers.map((marker) => marker.accessibilityLabel).join(" + ")
    : access?.label || "Locked";

  return {
    accessibilityLabel: label,
    isLocked: true,
    label,
    markers: markers.length
      ? markers
      : [{ accessibilityLabel: label, label: "Locked", tone: "locked" }],
  };
}

function getPlayableLabel(access: EpisodeAccess) {
  if (access.kind === "owned") {
    return "Unlocked";
  }

  if (access.kind === "included" || access.kind === "subscription") {
    return "Included";
  }

  return access.label || "Unlocked";
}

function getPlayableMarkers(
  access: EpisodeAccess,
  episode: ApiEpisode,
  label: string,
): EpisodeAccessMarker[] {
  if (access.kind === "free" || episode.isFree) {
    return [{ accessibilityLabel: "Free", label: "Free", tone: "muted" }];
  }

  if (access.kind === "owned") {
    return [{ accessibilityLabel: "Unlocked", label: "\u2713", tone: "available" }];
  }

  return [{ accessibilityLabel: label, label, tone: "available" }];
}

function getUnlockMethodMarkers(episode: ApiEpisode) {
  const markers: EpisodeAccessMarker[] = [];

  if (episode.coinUnlockEnabled && episode.coinPrice > 0) {
    markers.push({
      accessibilityLabel: `Unlock with ${episode.coinPrice} coins`,
      icon: "coin",
      label: String(episode.coinPrice),
      tone: "available",
    });
  }

  if (episode.rewardedUnlockEnabled) {
    markers.push({
      accessibilityLabel: "Watch Ad",
      label: "\u25B6 Ad",
      tone: "available",
    });
  }

  if (episode.plusAccess) {
    markers.push({
      accessibilityLabel: "Plus",
      label: "+ Plus",
      tone: "available",
    });
  }

  return markers;
}
