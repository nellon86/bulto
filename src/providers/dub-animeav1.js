// AnimeAV1: sección DUB (latino); si no hay doblaje extraíble, la versión SUB.
import { defineProvider } from "../core/provider.js";
import { findSlug, episodeHtml, serverList, toStreams } from "./animeav1.js";

async function run(ctx) {
  const slug = await findSlug(ctx);
  if (!slug) return [];
  const html = await episodeHtml(ctx, slug);
  const dub = await toStreams(ctx, serverList(html, "DUB"), "es-lat", "dub-animeav1");
  if (dub.length) return dub;
  return toStreams(ctx, serverList(html, "SUB"), "es", "dub-animeav1");
}

export const getStreams = defineProvider({ id: "dub-animeav1", run });
