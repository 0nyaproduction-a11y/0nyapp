import { VideoView, type VideoPlayer } from "expo-video";
import { StyleSheet } from "react-native";

type VerticalVideoSurfaceProps = {
  player: VideoPlayer;
};

export function VerticalVideoSurface({ player }: VerticalVideoSurfaceProps) {
  return (
    <VideoView
      allowsPictureInPicture={false}
      contentFit="contain"
      nativeControls={false}
      player={player}
      style={styles.video}
      surfaceType="textureView"
    />
  );
}

const styles = StyleSheet.create({
  video: {
    ...StyleSheet.absoluteFill,
  },
});
