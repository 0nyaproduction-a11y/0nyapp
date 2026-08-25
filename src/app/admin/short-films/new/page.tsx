import { redirect } from "next/navigation";
import Link from "next/link";
import { ShortFilmMetadataForm } from "@/components/cms/ShortFilmMetadataForm";
import { requireCmsAdmin } from "@/lib/cms/auth";
import { createShortFilm } from "@/lib/cms/short-films";
import { errorsToRecord, parseShortFilmFormData, type ShortFilmFormState } from "@/lib/cms/short-film-form";
import { shortFilmEditPath, shortFilmListPath, shortFilmNewPath } from "@/lib/routes";

export default async function NewShortFilmPage() {
  const context = await requireCmsAdmin(shortFilmNewPath);

  if (context.status === "forbidden") {
    return (
      <main className="min-h-screen bg-deep px-4 py-10 text-bone">
        <div className="mx-auto max-w-md text-center">
          <h1 className="text-xl font-semibold">Access denied</h1>
          <p className="mt-2 text-sm text-bone/70">You are not authorized for CMS access.</p>
        </div>
      </main>
    );
  }

  async function createShortFilmAction(
    _prevState: ShortFilmFormState,
    formData: FormData,
  ): Promise<ShortFilmFormState> {
    "use server";

    const guard = await requireCmsAdmin(shortFilmNewPath);

    if (guard.status === "forbidden") {
      return { errors: { form: "You are not authorized to manage content." } };
    }

    const input = parseShortFilmFormData(formData);
    const result = await createShortFilm(input);

    if (!result.success) {
      return { errors: errorsToRecord(result.errors) };
    }

    redirect(shortFilmEditPath(result.shortFilm.id));
  }

  return (
    <main className="min-h-screen bg-deep px-4 py-10 text-bone">
      <div className="mx-auto max-w-3xl">
        <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-bone/60">0nya CMS</p>
        <h1 className="mt-2 text-2xl font-semibold">New short film</h1>
        <Link href={shortFilmListPath} className="mt-1 inline-block text-sm text-teal">
          ← Back to short films
        </Link>
        <div className="mt-8">
          <ShortFilmMetadataForm action={createShortFilmAction} submitLabel="Create short film" />
        </div>
      </div>
    </main>
  );
}
