import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Image, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Screen } from "../components/Screen";
import { Button, LoadingState, RecoveryState, Title } from "../components/ui";
import { getCatalog, getShortFilm, isShortFilmPublished } from "../lib/api";
import { buildShortFilmShareMessage } from "../lib/content-links";
import { loadWatchHistory } from "../lib/playbackHistory";
import {
  getParentalScope,
  isParentalSessionUnlocked,
  loadParentalControls,
} from "../lib/parentalControls";
import { useAuth } from "../lib/authContext";
import { getResumePositionSeconds } from "../player/resumePosition";
import { resolveShortFilmArtwork } from "../lib/shortFilmArtwork";
import type { RootStackParamList } from "../navigation/types";
import type { ApiShortFilm, ShortFilmResponse } from "../types/api";
import type { ParentalControlState } from "../lib/parentalControls";
import { colors, borders } from "../theme/tokens";

type Props = NativeStackScreenProps<RootStackParamList, "ShortFilm">;

function formatClassification(contentRating: string | null, contentDescriptors: string[]) {
  if (!contentRating) {
    return null;
  }

  return contentDescriptors.length ? `${contentRating} • ${contentDescriptors.join(", ")}` : contentRating;
}

function formatPublishYear(publishAt: string | null) {
  if (!publishAt) {
    return null;
  }

  const year = new Date(publishAt).getFullYear();
  return Number.isNaN(year) ? null : `${year}`;
}

export function ShortFilmDetailScreen({ navigation, route }: Props) {
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const normalizedSlug = typeof route.params.slug === "string" ? route.params.slug.trim() : "";
  const hasValidSlug = normalizedSlug.length > 0;
  const parentalScope = useMemo(() => getParentalScope(session), [session]);
  const [shortFilm, setShortFilm] = useState<ShortFilmResponse["shortFilm"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [resumeAtSeconds, setResumeAtSeconds] = useState<number | null>(null);
  const [relatedShortFilms, setRelatedShortFilms] = useState<ApiShortFilm[]>([]);
  const [parentalControlState, setParentalControlState] = useState<ParentalControlState | null>(null);
  const isSessionUnlocked = isParentalSessionUnlocked(parentalScope);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const loadShortFilm = useCallback(async () => {
    if (!hasValidSlug) {
      throw new Error("Invalid short film slug.");
    }

    const data = await getShortFilm(normalizedSlug, accessToken);
    return data.shortFilm;
  }, [accessToken, hasValidSlug, normalizedSlug]);

  const resolveResumeAtSeconds = useCallback(
    (history: Awaited<ReturnType<typeof loadWatchHistory>>, shortFilmSlug: string) => {
      const savedProgress = history.find(
        (entry) => entry.contentType === "short_film" && entry.shortFilmSlug === shortFilmSlug,
      );

      return getResumePositionSeconds(savedProgress, undefined, 5);
    },
    [],
  );

  useEffect(() => {
    if (!hasValidSlug) {
      setError("This short film link is unavailable.");
      setIsLoading(false);
      setShortFilm(null);
      return undefined;
    }

    let isMounted = true;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch lifecycle boundary.
    setIsLoading(true);
    setResumeAtSeconds(null);

    void Promise.all([loadShortFilm(), loadWatchHistory(session), loadParentalControls(session)])
      .then(([shortFilmData, history, parentalControlStatus]) => {
        if (!isMounted) {
          return;
        }

        setShortFilm(shortFilmData);
        setResumeAtSeconds(resolveResumeAtSeconds(history, shortFilmData.slug));
        setParentalControlState(parentalControlStatus);
        setError(null);
      })
      .catch(() => {
        if (isMounted) {
          setError("We couldn't load this right now.");
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [hasValidSlug, loadShortFilm, resolveResumeAtSeconds, session]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      void loadWatchHistory(session)
        .then((history) => {
          if (!isActive) {
            return;
          }

          setResumeAtSeconds(resolveResumeAtSeconds(history, normalizedSlug));
        })
        .catch(() => undefined);

      return () => {
        isActive = false;
      };
    }, [normalizedSlug, resolveResumeAtSeconds, session]),
  );

  useEffect(() => {
    let isMounted = true;

    if (!hasValidSlug) {
      setRelatedShortFilms([]);
      return undefined;
    }

    void getCatalog(accessToken)
      .then((data) => {
        if (!isMounted) {
          return;
        }

        setRelatedShortFilms(
          data.shortFilms.filter((item) => item.slug !== normalizedSlug).slice(0, 6),
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
  }, [accessToken, hasValidSlug, normalizedSlug]);

  const classification = shortFilm
    ? formatClassification(shortFilm.contentRating, shortFilm.contentDescriptors)
    : null;
  const hasConfiguredParentalLock = parentalControlState?.hasPin ?? false;
  const poster = resolveShortFilmArtwork(shortFilm?.heroImage, shortFilm?.poster);
  const posterUri = poster ?? "";
  const canPlayFilm = Boolean(shortFilm && (__DEV__ || shortFilm.playbackReady));
  const hasResumeProgress = resumeAtSeconds !== null;
  const publishYear = shortFilm ? formatPublishYear(shortFilm.publishAt) : null;
  const metadata = shortFilm
    ? ["Short Film", shortFilm.durationLabel, shortFilm.language, publishYear].filter(Boolean).join(" · ")
    : "";
  const playButtonLabel = shortFilm?.ageVerificationRequired
    ? "Blocked"
    : canPlayFilm
      ? hasResumeProgress
        ? "Resume"
        : "Play"
      : "Not ready";

  const handleShare = useCallback(() => {
    if (!shortFilm) {
      return;
    }

    void Share.share({
      message: buildShortFilmShareMessage(shortFilm.title, shortFilm.slug),
    }).catch(() => undefined);
  }, [shortFilm]);

  const handlePlay = useCallback(() => {
    if (!shortFilm || !isShortFilmPublished(shortFilm)) {
      return;
    }

    if (shortFilm.ageVerificationRequired) {
      return;
    }

    if (shortFilm.parentalLockRequired && hasConfiguredParentalLock && !isSessionUnlocked) {
      navigation.navigate("ParentalControls", {
        mode: "unlock",
        target: {
          screen: "ShortFilmPlayback",
          params: { resumeAtSeconds: resumeAtSeconds ?? undefined, slug: shortFilm.slug },
        },
      });
      return;
    }

    if (!canPlayFilm) {
      return;
    }

    navigation.navigate("ShortFilmPlayback", {
      resumeAtSeconds: resumeAtSeconds ?? undefined,
      slug: shortFilm.slug,
    });
  }, [canPlayFilm, hasConfiguredParentalLock, isSessionUnlocked, navigation, resumeAtSeconds, shortFilm]);

  if (!hasValidSlug) {
    return (
      <Screen>
        <RecoveryState
          body="This short film link is unavailable."
          onPrimaryAction={() => navigation.goBack()}
          primaryActionLabel="Back"
          title="Unavailable"
        />
      </Screen>
    );
  }

  if (isLoading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  if (!shortFilm) {
    return (
      <Screen>
        <RecoveryState
          body={error ?? "Please try again."}
          onPrimaryAction={() => {
            setIsLoading(true);
            setShortFilm(null);
            setError(null);
            setResumeAtSeconds(null);
            void loadShortFilm()
              .then((data) => {
                setShortFilm(data);
              })
              .catch(() => {
                setError("We couldn't load this right now.");
              })
              .finally(() => {
                setIsLoading(false);
              });
          }}
          primaryActionLabel="Retry"
          title="We couldn't load this right now."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Pressable
        accessibilityLabel="Back"
        accessibilityRole="button"
        onPress={() => navigation.goBack()}
        style={styles.backButton}
      >
        <Text style={styles.backArrow}>←</Text>
      </Pressable>

      <View style={styles.posterWrap}>
        {posterUri ? (
          <Image
            accessibilityLabel={`${shortFilm.title} poster`}
            accessible
            alt=""
            source={{ uri: posterUri }}
            style={styles.posterImage}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.posterFallback}>
            <Title>{shortFilm.title}</Title>
          </View>
        )}
      </View>

      <View style={styles.metaStack}>
        <Title>{shortFilm.title}</Title>
        <Text style={styles.metaLine}>{metadata}</Text>
        {classification ? <Text style={styles.ratingLine}>{classification}</Text> : null}
        {shortFilm.creatorReference ? (
          <Text style={styles.creditLine}>Directed by {shortFilm.creatorReference}</Text>
        ) : null}
      </View>

      <Text style={styles.synopsis}>{shortFilm.synopsis}</Text>

      <Button
        accessibilityLabel={
          shortFilm.ageVerificationRequired
            ? "Age verification unavailable"
            : canPlayFilm
              ? hasResumeProgress
                ? "Resume short film"
                : "Play short film"
              : "Playback not ready"
        }
        disabled={shortFilm.ageVerificationRequired || !canPlayFilm}
        onPress={() => void handlePlay()}
      >
        {shortFilm.ageVerificationRequired ? playButtonLabel : `▶ ${playButtonLabel}`}
      </Button>

      <Pressable
        accessibilityLabel="Share short film"
        accessibilityRole="button"
        onPress={() => void handleShare()}
        style={({ pressed }) => [styles.shareButton, pressed && styles.shareButtonPressed]}
      >
        <Text style={styles.shareButtonText}>Share</Text>
      </Pressable>

      {relatedShortFilms.length > 0 ? (
        <View style={styles.relatedSection}>
          <Text style={styles.sectionHeading}>Related Short Films</Text>
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
                          resizeMode="contain"
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
    </Screen>
  );
}

const styles = StyleSheet.create({
backButton: {
  alignItems: "center",
  alignSelf: "flex-start",
},
backArrow: {
  color: colors.text,
  fontSize: 22,
  fontWeight: "700",
  lineHeight: 24,
},
metaStack: {
  gap: 6,
},
posterWrap: {
  aspectRatio: 9 / 16,
  alignSelf: "center",
  backgroundColor: colors.background,
  borderColor: borders.color,
  borderWidth: borders.width,
  overflow: "hidden",
  width: "74%",
},
posterImage: {
  width: "100%",
  height: "100%",
},
  posterFallback: {
    alignItems: "center",
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: "center",
    padding: 16,
  },
  metaLine: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  ratingLine: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  creditLine: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  synopsis: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: "400",
    lineHeight: 21,
  },
  shareButton: {
    alignSelf: "flex-start",
    paddingVertical: 4,
  },
  shareButtonPressed: {
    opacity: 0.75,
  },
  shareButtonText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  sectionHeading: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  relatedSection: {
    gap: 10,
  },
  relatedRow: {
    flexDirection: "row",
    gap: 12,
  },
  relatedCard: {
    gap: 8,
    width: 128,
  },
  relatedCardPressed: {
    opacity: 0.85,
  },
  relatedPosterWrap: {
    aspectRatio: 9 / 16,
    backgroundColor: colors.background,
    borderColor: borders.color,
    borderWidth: borders.width,
    overflow: "hidden",
    width: "100%",
  },
  relatedPoster: {
    width: "100%",
    height: "100%",
  },
  relatedPosterFallback: {
    alignItems: "center",
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: "center",
    padding: 12,
  },
  relatedPosterTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  relatedTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
});
