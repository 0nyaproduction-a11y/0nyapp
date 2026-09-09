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
  | "lock"
  | "chevron-down"
  | "chevron-right"
  | "alert-triangle"
  | "plus"
  | "trash"
  | "edit"
  | "check"
  | "x"
  | "grip-vertical"
  | "eye"
  | "eye-off"
  | "save"
  | "spinner";

type IconProps = {
  name: IconName;
  className?: string;
  "data-testid"?: string;
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
  "chevron-down": "M6 9l6 6 6-6",
  "chevron-right": "M9 6l6 6-6 6",
  "alert-triangle": "M10.29 4.22L4.29 16.83A2 2 0 0 0 6 20h12a2 2 0 0 0 1.71-2.99l-6-11a2 2 0 0 0-3.42 0Z",
  plus: "M12 5v14m7-7H5",
  trash: "M3 6h18M9 11v10h6V11M6 6V4a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v2m-9 0h6",
  edit: "M11 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7m-5.5-9.5A2.5 2.5 0 0 1 14.5 5 2.5 2.5 0 1 1 7.5 5H9m-3.5 3.5v10h11v-10",
  check: "M20 6 9 17l-4-4",
  x: "M18 6 6 18M6 6l12 12",
  "grip-vertical": "M9 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm0 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm0 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm8-12a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm0 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm0 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z",
  eye: "M2.05 11.01A10.9 10.9 0 0 1 12 5c2.66 0 5.06.95 6.95 2.51a1 1 0 0 1-.04 1.74 7 7 0 0 0-13.82 0 1 1 0 1.48 3.65 3.65 0 0 1 0-.22Z",
  "eye-off": "M10.5 5c.17 0 .34.01.5.03A9 9 0 0 1 21 12c0 .77-.14 1.5-.39 2.19l1.24 1.24A13.14 13.14 0 0 0 23 12c0-1.4-.27-2.72-.75-3.97a15.14 15.14 0 0 0-2.63-5.24 1 1 0 0 0-1.42 0L3.46 5.3a1 1 0 0 0 0 1.42l1.24 1.24A8.85 8.85 0 0 1 12 3c.17 0 .33.01.5.03Z",
  save: "M12 21H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.17l1 1H12m-6 9h12M9 9V5h6v4m-6 10v-4h6v4",
  spinner: "M12 2v4m8.66 0a10 10 0 0 1-12.62 4 10 10 0 0 1 0-12.62",
};

export function Icon({ name, className = "h-5 w-5", "data-testid": testId }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      data-testid={testId}
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
