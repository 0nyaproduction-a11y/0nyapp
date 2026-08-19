export type ContentFormat = "Series" | "Mini" | "Short";

export type Episode = {
  number: number;
  title: string;
  description: string;
  runtime: string;
  isFree: boolean;
  isLocked: boolean;
  progress?: number;
};

export type ContentItem = {
  id: string;
  title: string;
  slug: string;
  genre: string;
  format: ContentFormat;
  episodeCount: number;
  episodeDuration: string;
  synopsis: string;
  poster: string;
  accent: string;
  episodes: Episode[];
  isFree?: boolean;
  isLocked?: boolean;
  progress?: number;
  currentEpisode?: string;
};

const artwork = "/logo-og.jpg";

const aadhaTakiyaEpisodes: Episode[] = [
  {
    number: 1,
    title: "Half a Pillow",
    description:
      "A cramped Mumbai room forces Meera and Kabir into a truce neither of them expected.",
    runtime: "1:42",
    isFree: true,
    isLocked: false,
    progress: 100,
  },
  {
    number: 2,
    title: "Rent Due",
    description:
      "A missing envelope turns their fragile arrangement into a night of quiet accusations.",
    runtime: "1:55",
    isFree: true,
    isLocked: false,
    progress: 72,
  },
  {
    number: 3,
    title: "One Cup Chai",
    description:
      "Kabir learns why Meera never takes calls after dinner, and chooses not to ask.",
    runtime: "1:48",
    isFree: true,
    isLocked: false,
  },
  {
    number: 4,
    title: "The Other Key",
    description:
      "A second key appears under the mattress, and the room stops feeling like a coincidence.",
    runtime: "2:00",
    isFree: false,
    isLocked: true,
  },
  {
    number: 5,
    title: "Sunday Silence",
    description:
      "The city rests, but an old voice note makes Meera question who Kabir is protecting.",
    runtime: "1:36",
    isFree: false,
    isLocked: true,
  },
  {
    number: 6,
    title: "Borrowed Shirt",
    description:
      "A small domestic lie spills into the office, where everyone already knows too much.",
    runtime: "1:58",
    isFree: false,
    isLocked: true,
  },
  {
    number: 7,
    title: "No Visitors",
    description:
      "Their landlord arrives early, and the room has to pretend it belongs to only one life.",
    runtime: "1:44",
    isFree: false,
    isLocked: true,
  },
  {
    number: 8,
    title: "Full Pillow",
    description:
      "A choice made in the rain changes the agreement from temporary shelter to confession.",
    runtime: "1:52",
    isFree: false,
    isLocked: true,
  },
];

const placeholderEpisodes = (
  count: number,
  duration: string,
  titlePrefix: string,
): Episode[] =>
  Array.from({ length: Math.min(count, 8) }, (_, index) => {
    const number = index + 1;

    return {
      number,
      title: `${titlePrefix} ${number}`,
      description: "A compact vertical episode placeholder for the 0nya mock catalogue.",
      runtime: duration.replace(" min episodes", ":00"),
      isFree: number <= 3,
      isLocked: number > 3,
    };
  });

export const featuredSeries: ContentItem = {
  id: "aadha-takiya",
  title: "Aadha Takiya",
  slug: "aadha-takiya",
  genre: "Romantic drama",
  format: "Series",
  episodeCount: 45,
  episodeDuration: "90-120 sec episodes",
  synopsis:
    "Two paying guests in Mumbai split a room, a pillow, and a silence neither of them can afford to break.",
  poster: artwork,
  accent: "#0DD1BC",
  episodes: aadhaTakiyaEpisodes,
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
    episodeCount: 18,
    episodeDuration: "7 min episodes",
    synopsis:
      "A wedding gift arrives with an old embroidered name, reopening the one story everyone agreed to bury.",
    poster: artwork,
    accent: "#7C6A52",
    episodes: placeholderEpisodes(18, "7 min episodes", "Thread"),
    progress: 34,
    currentEpisode: "Episode 4",
  },
  {
    id: "doosri-rasoi",
    title: "Doosri Rasoi",
    slug: "doosri-rasoi",
    genre: "Domestic thriller",
    format: "Series",
    episodeCount: 32,
    episodeDuration: "8 min episodes",
    synopsis:
      "Every afternoon, a locked kitchen in Jaipur serves a meal for someone who should not exist.",
    poster: artwork,
    accent: "#8D2430",
    episodes: placeholderEpisodes(32, "8 min episodes", "Course"),
    isLocked: true,
  },
  {
    id: "mute-button",
    title: "Mute Button",
    slug: "mute-button",
    genre: "Office romance",
    format: "Short",
    episodeCount: 15,
    episodeDuration: "6 min episodes",
    synopsis:
      "A support agent discovers the voice she has been training belongs to the man who ghosted her.",
    poster: artwork,
    accent: "#334F45",
    episodes: placeholderEpisodes(15, "6 min episodes", "Call"),
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
    episodeCount: 21,
    episodeDuration: "9 min episodes",
    synopsis:
      "At 3:00 every morning, a Kolkata lift stops on a floor missing from the building plan.",
    poster: artwork,
    accent: "#283D52",
    episodes: placeholderEpisodes(21, "9 min episodes", "Floor"),
    isLocked: true,
  },
  {
    id: "baarish-receipt",
    title: "Baarish Receipt",
    slug: "baarish-receipt",
    genre: "Second chance",
    format: "Mini",
    episodeCount: 12,
    episodeDuration: "8 min episodes",
    synopsis:
      "A faded cafe bill from one monsoon night becomes the map back to a love left unfinished.",
    poster: artwork,
    accent: "#56604B",
    episodes: placeholderEpisodes(12, "8 min episodes", "Receipt"),
    isFree: true,
  },
  {
    id: "aakhri-local",
    title: "Aakhri Local",
    slug: "aakhri-local",
    genre: "Mumbai noir",
    format: "Series",
    episodeCount: 26,
    episodeDuration: "10 min episodes",
    synopsis:
      "The last Virar local carries a witness, a runaway bride, and one inspector out of time.",
    poster: artwork,
    accent: "#3F3940",
    episodes: placeholderEpisodes(26, "10 min episodes", "Station"),
    progress: 19,
    currentEpisode: "Episode 2",
  },
  {
    id: "silver-tiffin",
    title: "Silver Tiffin",
    slug: "silver-tiffin",
    genre: "Inheritance drama",
    format: "Mini",
    episodeCount: 16,
    episodeDuration: "7 min episodes",
    synopsis:
      "Three sisters inherit one tiffin carrier and a set of instructions that changes who gets the house.",
    poster: artwork,
    accent: "#6A614F",
    episodes: placeholderEpisodes(16, "7 min episodes", "Layer"),
    isLocked: true,
  },
  {
    id: "seen-zone",
    title: "Seen Zone",
    slug: "seen-zone",
    genre: "Digital thriller",
    format: "Short",
    episodeCount: 20,
    episodeDuration: "5 min episodes",
    synopsis:
      "A deleted message keeps appearing on phones across one Delhi apartment block.",
    poster: artwork,
    accent: "#1F5B53",
    episodes: placeholderEpisodes(20, "5 min episodes", "Message"),
    isFree: true,
  },
  {
    id: "nimbu-mirchi",
    title: "Nimbu Mirchi",
    slug: "nimbu-mirchi",
    genre: "Dark comedy",
    format: "Series",
    episodeCount: 22,
    episodeDuration: "8 min episodes",
    synopsis:
      "A superstition seller at a traffic signal becomes the city councillor's most inconvenient witness.",
    poster: artwork,
    accent: "#625622",
    episodes: placeholderEpisodes(22, "8 min episodes", "Signal"),
    isLocked: true,
  },
];

export const continueWatching = contentItems.filter((item) => item.progress);
export const startHere = contentItems.slice(0, 6);
export const trending = [
  contentItems[3],
  contentItems[1],
  contentItems[6],
  contentItems[8],
  contentItems[2],
  contentItems[9],
];
export const newReleases = [
  contentItems[9],
  contentItems[7],
  contentItems[5],
  contentItems[4],
  contentItems[8],
  contentItems[2],
];

export function getSeriesBySlug(slug: string) {
  return contentItems.find((item) => item.slug === slug);
}

export function getEpisode(seriesSlug: string, episodeNumber: number) {
  return getSeriesBySlug(seriesSlug)?.episodes.find(
    (episode) => episode.number === episodeNumber,
  );
}

export function getNextEpisode(seriesSlug: string, episodeNumber: number) {
  return getSeriesBySlug(seriesSlug)?.episodes.find(
    (episode) => episode.number === episodeNumber + 1,
  );
}
