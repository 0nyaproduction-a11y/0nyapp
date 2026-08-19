type IconName =
  | "home"
  | "browse"
  | "search"
  | "profile"
  | "coin"
  | "info"
  | "play"
  | "pause"
  | "mute"
  | "volume"
  | "fullscreen"
  | "back"
  | "next"
  | "lock";

type IconProps = {
  name: IconName;
  className?: string;
};

const paths: Record<IconName, string> = {
  home: "M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3V10.5Z",
  browse: "M4 5h7v7H4V5Zm9 0h7v7h-7V5ZM4 14h7v5H4v-5Zm9 0h7v5h-7v-5Z",
  search: "m21 21-4.2-4.2M10.8 18a7.2 7.2 0 1 1 0-14.4 7.2 7.2 0 0 1 0 14.4Z",
  profile: "M12 12.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 21a7.5 7.5 0 0 1 15 0",
  coin: "M12 21c4.97 0 9-2.01 9-4.5S16.97 12 12 12s-9 2.01-9 4.5S7.03 21 12 21Zm0-9c4.97 0 9-2.01 9-4.5S16.97 3 12 3 3 5.01 3 7.5 7.03 12 12 12Z",
  info: "M12 17v-6m0-4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  play: "M7 4.5v15l12-7.5L7 4.5Z",
  pause: "M8 5h3v14H8V5Zm5 0h3v14h-3V5Z",
  mute: "M5 9v6h4l5 4V5L9 9H5Zm12 1 4 4m0-4-4 4",
  volume: "M5 9v6h4l5 4V5L9 9H5Zm12.5-.5a5 5 0 0 1 0 7",
  fullscreen: "M4 9V4h5m11 5V4h-5M4 15v5h5m11-5v5h-5",
  back: "M19 12H5m6-6-6 6 6 6",
  next: "M5 5l9 7-9 7V5Zm10 0h3v14h-3V5Z",
  lock: "M7 10V7a5 5 0 0 1 10 0v3m-9 0h8a2 2 0 0 1 2 2v7H6v-7a2 2 0 0 1 2-2Z",
};

export function Icon({ name, className = "h-5 w-5" }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
    >
      <path d={paths[name]} />
    </svg>
  );
}
