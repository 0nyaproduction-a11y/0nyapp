"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import type { ContentItem, Episode } from "@/data/content";
import { EpisodeComplete } from "@/components/player/EpisodeComplete";
import { PlayerControls } from "@/components/player/PlayerControls";

type VerticalPlayerProps = {
  series: ContentItem;
  episode: Episode;
  nextEpisode?: Episode;
};

function formatProgress(progress: number, runtime: string) {
  const [minutes = "0", seconds = "0"] = runtime.split(":");
  const totalSeconds = Number(minutes) * 60 + Number(seconds);
  const currentSeconds = Math.floor((totalSeconds * progress) / 100);
  const currentMinutes = Math.floor(currentSeconds / 60);
  const remainingSeconds = `${currentSeconds % 60}`.padStart(2, "0");

  return `${currentMinutes}:${remainingSeconds}`;
}

export function VerticalPlayer({ series, episode, nextEpisode }: VerticalPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(Math.min(episode.progress ?? 8, 88));
  const isComplete = progress >= 100;
  const currentTime = useMemo(
    () => formatProgress(progress, episode.runtime),
    [episode.runtime, progress],
  );

  useEffect(() => {
    if (!isPlaying || isComplete) {
      return;
    }

    const timer = window.setInterval(() => {
      setProgress((value) => Math.min(100, value + 2));
    }, 450);

    return () => window.clearInterval(timer);
  }, [isComplete, isPlaying]);

  return (
    <section className="min-h-screen bg-deep text-bone">
      <div className="mx-auto grid min-h-screen max-w-6xl gap-5 px-4 py-5 sm:px-6 md:grid-cols-[minmax(180px,0.72fr)_auto_minmax(180px,0.72fr)] md:items-center md:gap-7 lg:gap-9 lg:px-8">
        <aside className="hidden self-center justify-self-end md:block">
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.2em] text-teal/80">
            {series.title}
          </p>
          <h1 className="mt-3 max-w-[15rem] font-display text-5xl font-light leading-[0.92] text-bone">
            Episode {episode.number}
          </h1>
          <p className="mt-4 max-w-[16rem] text-sm leading-6 text-muted">
            {episode.title}
          </p>
        </aside>
        <div className="mx-auto flex min-h-[calc(100svh-2.5rem)] w-full max-w-[430px] flex-col justify-center md:min-h-0 md:w-[min(480px,calc((100svh-4rem)*9/16))] md:max-w-none">
          <div className="relative aspect-[9/16] w-full overflow-hidden border border-bone/10 bg-black shadow-[0_0_90px_rgba(13,209,188,0.08)]">
            <Image
              src={series.poster}
              alt=""
              fill
              priority
              sizes="(max-width: 768px) 94vw, (max-height: 840px) calc((100vh - 4rem) * 9 / 16), 480px"
              className="object-cover opacity-[0.18]"
            />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(13,209,188,0.08),transparent_38%),linear-gradient(180deg,rgba(5,5,5,0.35),rgba(5,5,5,0.9))]" />
            <div className="absolute left-4 right-4 top-4 z-10">
              <p className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-teal/85">
                {series.title}
              </p>
              <h2 className="mt-1 font-display text-3xl font-light leading-none text-bone">
                {episode.title}
              </h2>
            </div>
            <div className="absolute inset-0 grid place-items-center">
              <div className="grid size-20 place-items-center border border-bone/10 bg-black/40 text-bone/80">
                {isPlaying ? "Playing" : "Paused"}
              </div>
            </div>
            <PlayerControls
              backHref={`/series/${series.slug}`}
              currentTime={currentTime}
              duration={episode.runtime}
              isMuted={isMuted}
              isPlaying={isPlaying}
              nextHref={nextEpisode ? `/watch/${series.slug}/${nextEpisode.number}` : undefined}
              onMuteToggle={() => setIsMuted((value) => !value)}
              onPlayToggle={() => setIsPlaying((value) => !value)}
              progress={progress}
            />
            {isComplete ? (
              <EpisodeComplete series={series} nextEpisode={nextEpisode} />
            ) : null}
          </div>
          <div className="mt-4 md:hidden">
            <p className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-bone/58">
              Episode {episode.number} / {episode.runtime}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted">
              {episode.description}
            </p>
          </div>
        </div>
        <aside className="hidden self-center justify-self-start md:block">
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-bone/54">
            {episode.runtime}
          </p>
          <p className="mt-4 max-w-[16rem] text-sm leading-6 text-muted">
            {episode.description}
          </p>
        </aside>
      </div>
    </section>
  );
}
