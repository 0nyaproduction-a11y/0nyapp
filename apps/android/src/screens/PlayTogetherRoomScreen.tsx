import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Share, StyleSheet, Text, View } from "react-native";

import { Screen } from "../components/Screen";
import {
  Body,
  Button,
  Card,
  ErrorText,
  Label,
  LoadingState,
  RecoveryState,
  Title,
} from "../components/ui";
import {
  ApiError,
  createPlayTogetherInvite,
  createPlayTogetherRoom,
  getRequestRecoveryCopy,
  joinPlayTogetherRoom,
  revokePlayTogetherInvite,
  type RecoveryCopy,
} from "../lib/api";
import { useAuth } from "../lib/authContext";
import { usePlayTogetherRoom } from "../lib/usePlayTogetherRoom";
import type { RootStackScreenProps } from "../navigation/types";
import { borders, colors, radii, spacing, typography } from "../theme/tokens";
import type { PlayTogetherCreatedInvite } from "../types/playTogether";

type Props = RootStackScreenProps<"PlayTogetherRoom">;

// "> " system feedback line — restrained Quiet Cinema voice for connection and
// session states. Never decorative copy; always reflects server-authoritative
// room status.
function SystemLine({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityLiveRegion="polite" style={styles.systemLine}>
      {children}
    </Text>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getInviteFallbackCopy(error: unknown): RecoveryCopy {
  return getRequestRecoveryCopy(error, {
    body: "This invite could not be used. Ask the Host for a fresh invite.",
    title: "Invite could not be used",
  });
}

export function PlayTogetherRoomScreen({ navigation, route }: Props) {
  const { session } = useAuth();
  const accessToken = session?.access_token ?? null;
  const myUserId = session?.user?.id ?? null;

  const { mode } = route.params;
  const hostEpisodeId = route.params.mode === "host" ? route.params.episodeId : null;
  const joinInviteToken = route.params.mode === "join" ? route.params.inviteToken : null;

  const [roomId, setRoomId] = useState<string | null>(
    route.params.mode === "room" ? route.params.roomId : null,
  );
  const [isMutating, setIsMutating] = useState(false);
  const [createState, setCreateState] = useState<RecoveryCopy | null>(null);
  const [joinState, setJoinState] = useState<RecoveryCopy | null>(null);
  const [invite, setInvite] = useState<PlayTogetherCreatedInvite | null>(null);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);

  const { connection, fatalError, refresh, room } = usePlayTogetherRoom(accessToken, roomId);

  const createRoom = useCallback(async () => {
    if (!accessToken || !hostEpisodeId) {
      return;
    }
    setIsMutating(true);
    setCreateState(null);
    try {
      const result = await createPlayTogetherRoom(accessToken, hostEpisodeId);
      setRoomId(result.room.id);
    } catch (error) {
      setCreateState(
        getRequestRecoveryCopy(error, {
          body: "The room could not be created. Check your connection and try again.",
          title: "Unable to create room",
        }),
      );
    } finally {
      setIsMutating(false);
    }
  }, [accessToken, hostEpisodeId]);

  useEffect(() => {
    if (mode === "host" && !roomId) {
      void createRoom();
    }
  }, [createRoom, mode, roomId]);

  const joinRoom = useCallback(async () => {
    if (!accessToken || !joinInviteToken) {
      return;
    }
    setIsMutating(true);
    setJoinState(null);
    try {
      const result = await joinPlayTogetherRoom(accessToken, joinInviteToken);
      setRoomId(result.room.roomId);
    } catch (error) {
      setJoinState(getInviteFallbackCopy(error));
    } finally {
      setIsMutating(false);
    }
  }, [accessToken, joinInviteToken]);

  useEffect(() => {
    if (mode === "join" && !roomId) {
      void joinRoom();
    }
  }, [joinRoom, mode, roomId]);

  const handleCreateInvite = useCallback(async () => {
    if (!accessToken || !roomId) {
      return;
    }
    setIsMutating(true);
    setInviteMessage(null);
    try {
      const result = await createPlayTogetherInvite(accessToken, roomId);
      setInvite(result.invite);
    } catch (error) {
      setInviteMessage(
        error instanceof ApiError && error.code === "network_error"
          ? "Check your connection and try again."
          : "The invite could not be created. Try again.",
      );
    } finally {
      setIsMutating(false);
    }
  }, [accessToken, roomId]);

  const handleShareInvite = useCallback(() => {
    if (!invite) {
      return;
    }
    void Share.share({
      message: `Join my 0nya Play Together session.\n${invite.inviteToken}`,
    }).catch(() => undefined);
  }, [invite]);

  const handleRevokeInvite = useCallback(async () => {
    if (!accessToken || !roomId || !invite) {
      return;
    }
    setIsMutating(true);
    setInviteMessage(null);
    try {
      await revokePlayTogetherInvite(accessToken, roomId, invite.id);
      setInvite(null);
    } catch (error) {
      setInviteMessage("The invite could not be revoked. Try again.");
    } finally {
      setIsMutating(false);
    }
  }, [accessToken, invite, roomId]);

  const isHost = useMemo(
    () => room?.participants.some((p) => p.userId === myUserId && p.role === "host") ?? false,
    [myUserId, room],
  );

  const displayEpisodeId = room?.episodeId.slice(0, 8) ?? null;
  const isReconnecting = room !== null && connection === "reconnecting";

  if (!session) {
    return (
      <Screen>
        <Card>
          <Label>Play Together</Label>
          <Title>Sign in to play together</Title>
          <Body>Play Together sessions require an authenticated 0nya account.</Body>
          <Button accessibilityLabel="Close" onPress={() => navigation.goBack()}>
            Close
          </Button>
        </Card>
      </Screen>
    );
  }

  if (mode === "host" && roomId === null) {
    return (
      <Screen>
        {createState ? (
          <RecoveryState
            body={createState.body}
            onPrimaryAction={() => void createRoom()}
            onSecondaryAction={() => navigation.goBack()}
            primaryActionLabel="Try again"
            secondaryActionLabel="Close"
            title={createState.title}
          />
        ) : (
          <View style={styles.centerState}>
            <Label>Play Together</Label>
            <SystemLine>{"> Creating your room…"}</SystemLine>
            <LoadingState />
          </View>
        )}
      </Screen>
    );
  }

  if (mode === "join" && roomId === null) {
    return (
      <Screen>
        {joinState ? (
          <RecoveryState
            body={joinState.body}
            onPrimaryAction={() => void joinRoom()}
            onSecondaryAction={() => navigation.goBack()}
            primaryActionLabel="Try again"
            secondaryActionLabel="Close"
            title={joinState.title}
          />
        ) : (
          <View style={styles.centerState}>
            <Label>Play Together</Label>
            <SystemLine>{"> Joining your session…"}</SystemLine>
            <LoadingState />
          </View>
        )}
      </Screen>
    );
  }

  if (fatalError) {
    return (
      <Screen>
        <RecoveryState
          body={fatalError}
          onPrimaryAction={() => void refresh()}
          onSecondaryAction={() => navigation.goBack()}
          primaryActionLabel="Try again"
          secondaryActionLabel="Close"
          title="Room unavailable"
        />
      </Screen>
    );
  }

  if (!room) {
    if (connection === "reconnecting") {
      return (
        <Screen>
          <RecoveryState
            body="Check your connection and try again."
            onPrimaryAction={() => void refresh()}
            onSecondaryAction={() => navigation.goBack()}
            primaryActionLabel="Try again"
            secondaryActionLabel="Close"
            title="No connection"
          />
        </Screen>
      );
    }

    return (
      <Screen>
        <View style={styles.centerState}>
          <SystemLine>{"> Connecting to session…"}</SystemLine>
          <LoadingState />
        </View>
      </Screen>
    );
  }

  const closeButton = (
    <Button accessibilityLabel="Close" onPress={() => navigation.goBack()}>
      Close
    </Button>
  );

  if (room.status === "ended") {
    return (
      <Screen>
        {isReconnecting ? <ReconnectBanner onRetry={() => void refresh()} /> : null}
        <Card>
          <Label>Play Together</Label>
          <Title>Session ended</Title>
          <Body>
            {room.endedAt ? `Ended ${formatDateTime(room.endedAt)}. ` : ""}
            No one else can join this session.
          </Body>
        </Card>
        {closeButton}
      </Screen>
    );
  }

  if (room.status === "expired") {
    return (
      <Screen>
        {isReconnecting ? <ReconnectBanner onRetry={() => void refresh()} /> : null}
        <Card>
          <Label>Play Together</Label>
          <Title>Session expired</Title>
          <Body>This session window expired and can no longer be used. Start a new session to watch together.</Body>
        </Card>
        {closeButton}
      </Screen>
    );
  }

  if (room.status === "waiting_for_access") {
    return (
      <Screen>
        {isReconnecting ? <ReconnectBanner onRetry={() => void refresh()} /> : null}
        <Card>
          <Label>Play Together</Label>
          <Title>Waiting for access</Title>
          <Body>The session will start once everyone in the room has access to this episode.</Body>
        </Card>
        {closeButton}
      </Screen>
    );
  }

  if (room.status === "active") {
    return (
      <Screen>
        {isReconnecting ? <ReconnectBanner onRetry={() => void refresh()} /> : null}
        <Card>
          <Label>Play Together</Label>
          <Title>Connected</Title>
          <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Connected</Text>
          </View>
          <Body>You are the {isHost ? "Host" : "Guest"} in this session.</Body>
          <Body style={styles.mutedLine}>
            {displayEpisodeId ? `Episode ${displayEpisodeId} · ` : ""}
            {room.playbackState === "playing" ? "Playing" : "Paused"}
          </Body>
        </Card>
        {closeButton}
      </Screen>
    );
  }

  return (
    <Screen>
      {isReconnecting ? <ReconnectBanner onRetry={() => void refresh()} /> : null}
      <Card>
        <Label>Play Together</Label>
        <SystemLine>{"> Waiting for connection…"}</SystemLine>
        {displayEpisodeId ? <Body style={styles.mutedLine}>Episode {displayEpisodeId}</Body> : null}

        {isHost ? (
          <View style={styles.inviteBlock}>
            <Body>
              Invites connect a guest to this room only and never grant content access.
            </Body>
            {invite ? (
              <View style={styles.inviteActive}>
                <Text selectable numberOfLines={1} style={styles.inviteToken}>
                  {invite.inviteToken}
                </Text>
                <Body style={styles.mutedLine}>Invite expires {formatDateTime(invite.expiresAt)}</Body>
                <Button
                  accessibilityLabel="Share invite"
                  disabled={isMutating}
                  onPress={handleShareInvite}
                  variant="primary"
                >
                  Share invite
                </Button>
                <Button
                  accessibilityLabel="Revoke invite"
                  disabled={isMutating}
                  onPress={() => void handleRevokeInvite()}
                  variant="text"
                >
                  Revoke invite
                </Button>
              </View>
            ) : (
              <Button
                accessibilityLabel="Create invite"
                disabled={isMutating}
                onPress={() => void handleCreateInvite()}
                variant="primary"
              >
                {isMutating ? "Creating invite…" : "Create invite"}
              </Button>
            )}
            {inviteMessage ? <ErrorText>{inviteMessage}</ErrorText> : null}
          </View>
        ) : null}

        {room.expiresAt ? (
          <Body style={styles.mutedLine}>Room available until {formatDateTime(room.expiresAt)}</Body>
        ) : null}
      </Card>
      {closeButton}
    </Screen>
  );
}

function ReconnectBanner({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.reconnectRow}>
      <Text style={styles.reconnectText}>Reconnecting…</Text>
      <Button accessibilityLabel="Reconnect" onPress={onRetry} variant="text">
        Reconnect
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  centerState: {
    alignItems: "flex-start",
    gap: 18,
    paddingVertical: spacing.xxl,
  },
  inviteActive: {
    gap: 12,
  },
  inviteBlock: {
    borderTopColor: borders.color,
    borderTopWidth: borders.width,
    gap: 12,
    paddingTop: spacing.md,
  },
  inviteToken: {
    ...typography.caption,
    color: colors.textSecondary,
    letterSpacing: 0.4,
  },
  mutedLine: {
    color: colors.textMuted,
    marginTop: 2,
  },
  reconnectRow: {
    alignItems: "center",
    backgroundColor: colors.backgroundSoft,
    borderColor: borders.color,
    borderRadius: radii.sm,
    borderWidth: borders.width,
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
    paddingRight: spacing.sm,
    paddingLeft: spacing.base,
    paddingVertical: spacing.xs,
  },
  reconnectText: {
    ...typography.caption,
    color: colors.muted,
  },
  statusDot: {
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    height: 8,
    width: 8,
  },
  statusRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  statusText: {
    ...typography.label,
    color: colors.text,
  },
  systemLine: {
    ...typography.body,
    color: colors.accentHighlight,
    letterSpacing: 0.2,
  },
});