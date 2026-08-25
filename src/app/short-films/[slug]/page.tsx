import { notFound } from "next/navigation";
import Image from "next/image";
import { Header } from "@/components/layout/Header";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { Button, ButtonLink } from "@/components/ui/Button";
import { getShortFilmBySlug } from "@/lib/catalog";

type ShortFilmPageProps = {
  params: Promise<{ slug: string }>;
};

function formatClassification(
  contentRating: string | null,
  contentDescriptors: string[],
) {
  if (!contentRating) {
    return null;
  }

  return contentDescriptors.length
    ? `${contentRating} • ${contentDescriptors.join(", ")}`
    : contentRating;
}

export default async function ShortFilmPage({ params }: ShortFilmPageProps) {
  const { slug } = await params;
  const shortFilm = await getShortFilmBySlug(slug);

  if (!shortFilm) {
    notFound();
  }

  const classification = formatClassification(
    shortFilm.contentRating,
    shortFilm.contentDescriptors,
  );

  return (
    <div className="min-h-screen bg-background text-bone">
      <Header />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <section className="grid gap-6 md:grid-cols-[minmax(0,320px)_1fr]">
          <div className="overflow-hidden border border-bone/10 bg-surface">
            <Image
              alt={`${shortFilm.title} poster`}
              className="h-full w-full object-cover"
              height={960}
              priority
              src={shortFilm.poster}
              width={640}
            />
          </div>

          <div className="flex flex-col gap-4">
            <div className="space-y-2">
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-teal/80">
                Short Film
              </p>
              <h1 className="font-display text-4xl font-light leading-none text-bone sm:text-5xl">
                {shortFilm.title}
              </h1>
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-bone/70">
                {shortFilm.durationLabel}
                {shortFilm.language ? ` • ${shortFilm.language}` : ""}
              </p>
              {classification ? <p className="text-[0.95rem] leading-7 text-bone/75">{classification}</p> : null}
              {shortFilm.creatorReference ? (
                <p className="text-[0.95rem] leading-7 text-bone/75">{shortFilm.creatorReference}</p>
              ) : null}
            </div>

            <p className="text-[0.95rem] leading-7 text-bone/75">{shortFilm.synopsis}</p>

            <div className="flex flex-wrap gap-3">
              <Button disabled variant="primary">
                Play
              </Button>
              <ButtonLink href={shortFilm.sharePath} variant="secondary">
                Share
              </ButtonLink>
            </div>

            {shortFilm.ageVerificationRequired ? (
              <section className="border border-bone/10 bg-surface p-4">
                <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-teal/80">
                  Age verification
                </p>
                <p className="mt-2 text-[0.95rem] leading-7 text-bone/75">
                  Age verification is not available yet, so this film stays blocked.
                </p>
              </section>
            ) : shortFilm.playbackReady ? (
              <section className="border border-bone/10 bg-surface p-4">
                <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-teal/80">
                  Playback
                </p>
                <p className="mt-2 text-[0.95rem] leading-7 text-bone/75">
                  Playback is not wired on web yet.
                </p>
              </section>
            ) : (
              <section className="border border-bone/10 bg-surface p-4">
                <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-teal/80">
                  Playback
                </p>
                <p className="mt-2 text-[0.95rem] leading-7 text-bone/75">
                  This short film is not ready to play yet.
                </p>
              </section>
            )}
          </div>
        </section>
      </main>
      <MobileBottomNav />
    </div>
  );
}
