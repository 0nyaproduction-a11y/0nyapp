"use server";

import { redirect } from "next/navigation";
import { purchaseEpisodeWithCoins } from "@/lib/purchases";

function getSafeRedirect(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

export async function buyEpisodeWithCoins(formData: FormData) {
  const episodeId = formData.get("episodeId");
  const returnTo = getSafeRedirect(formData.get("returnTo"));

  if (typeof episodeId !== "string" || !episodeId) {
    redirect(`${returnTo}?purchase=invalid_episode`);
  }

  const result = await purchaseEpisodeWithCoins(episodeId);

  redirect(`${returnTo}?purchase=${result.status}`);
}
