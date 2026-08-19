export type ContentFormat = "Series" | "Mini" | "Short";

export type ContentItem = {
  id: string;
  title: string;
  slug: string;
  genre: string;
  format: ContentFormat;
  episodes: number;
  runtime: string;
  synopsis: string;
  poster: string;
  accent: string;
  isFree?: boolean;
  isLocked?: boolean;
  progress?: number;
  currentEpisode?: string;
};

const artwork = "/logo-og.jpg";

export const featuredSeries: ContentItem = {
  id: "aadha-takiya",
  title: "Aadha Takiya",
  slug: "aadha-takiya",
  genre: "Romantic drama",
  format: "Series",
  episodes: 24,
  runtime: "9 min episodes",
  synopsis:
    "Two paying guests in Mumbai split a room, a pillow, and a silence neither of them can afford to break.",
  poster: artwork,
  accent: "#0DD1BC",
  isFree: true,
  progress: 62,
  currentEpisode: "Episode 8",
};

export const contentItems: ContentItem[] = [
  featuredSeries,
  {
    id: "chaadar",
    title: "Chaadar",
    slug: "chaadar",
    genre: "Family secret",
    format: "Mini",
    episodes: 18,
    runtime: "7 min episodes",
    synopsis:
      "A wedding gift arrives with an old embroidered name, reopening the one story everyone agreed to bury.",
    poster: artwork,
    accent: "#7C6A52",
    progress: 34,
    currentEpisode: "Episode 4",
  },
  {
    id: "doosri-rasoi",
    title: "Doosri Rasoi",
    slug: "doosri-rasoi",
    genre: "Domestic thriller",
    format: "Series",
    episodes: 32,
    runtime: "8 min episodes",
    synopsis:
      "Every afternoon, a locked kitchen in Jaipur serves a meal for someone who should not exist.",
    poster: artwork,
    accent: "#8D2430",
    isLocked: true,
  },
  {
    id: "mute-button",
    title: "Mute Button",
    slug: "mute-button",
    genre: "Office romance",
    format: "Short",
    episodes: 15,
    runtime: "6 min episodes",
    synopsis:
      "A support agent discovers the voice she has been training belongs to the man who ghosted her.",
    poster: artwork,
    accent: "#334F45",
    isFree: true,
    progress: 78,
    currentEpisode: "Episode 11",
  },
  {
    id: "teen-baje",
    title: "Teen Baje",
    slug: "teen-baje",
    genre: "Mystery",
    format: "Series",
    episodes: 21,
    runtime: "9 min episodes",
    synopsis:
      "At 3:00 every morning, a Kolkata lift stops on a floor missing from the building plan.",
    poster: artwork,
    accent: "#283D52",
    isLocked: true,
  },
  {
    id: "baarish-receipt",
    title: "Baarish Receipt",
    slug: "baarish-receipt",
    genre: "Second chance",
    format: "Mini",
    episodes: 12,
    runtime: "8 min episodes",
    synopsis:
      "A faded cafe bill from one monsoon night becomes the map back to a love left unfinished.",
    poster: artwork,
    accent: "#56604B",
    isFree: true,
  },
  {
    id: "aakhri-local",
    title: "Aakhri Local",
    slug: "aakhri-local",
    genre: "Mumbai noir",
    format: "Series",
    episodes: 26,
    runtime: "10 min episodes",
    synopsis:
      "The last Virar local carries a witness, a runaway bride, and one inspector out of time.",
    poster: artwork,
    accent: "#3F3940",
    progress: 19,
    currentEpisode: "Episode 2",
  },
  {
    id: "silver-tiffin",
    title: "Silver Tiffin",
    slug: "silver-tiffin",
    genre: "Inheritance drama",
    format: "Mini",
    episodes: 16,
    runtime: "7 min episodes",
    synopsis:
      "Three sisters inherit one tiffin carrier and a set of instructions that changes who gets the house.",
    poster: artwork,
    accent: "#6A614F",
    isLocked: true,
  },
  {
    id: "seen-zone",
    title: "Seen Zone",
    slug: "seen-zone",
    genre: "Digital thriller",
    format: "Short",
    episodes: 20,
    runtime: "5 min episodes",
    synopsis:
      "A deleted message keeps appearing on phones across one Delhi apartment block.",
    poster: artwork,
    accent: "#1F5B53",
    isFree: true,
  },
  {
    id: "nimbu-mirchi",
    title: "Nimbu Mirchi",
    slug: "nimbu-mirchi",
    genre: "Dark comedy",
    format: "Series",
    episodes: 22,
    runtime: "8 min episodes",
    synopsis:
      "A superstition seller at a traffic signal becomes the city councillor's most inconvenient witness.",
    poster: artwork,
    accent: "#625622",
    isLocked: true,
  },
];

export const continueWatching = contentItems.filter((item) => item.progress);
export const startHere = contentItems.slice(0, 6);
export const trending = [contentItems[3], contentItems[1], contentItems[6], contentItems[8], contentItems[2], contentItems[9]];
export const newReleases = [contentItems[9], contentItems[7], contentItems[5], contentItems[4], contentItems[8], contentItems[2]];
