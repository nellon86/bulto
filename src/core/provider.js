import { resolveAnime } from "./mapping.js";
import { setLogPrefix, log, withTimeout } from "./http.js";
import { dedupe } from "./streams.js";

// Envuelve un scraper: resuelve el anime, llama al scraper y nunca lanza error.
// `run(ctx)` devuelve una lista de fuentes ya formateadas.
export function defineProvider({ id, run, timeout = 45000 }) {
  async function getStreams(tmdbId, mediaType, season, episode) {
    setLogPrefix(`[${id}]`);
    try {
      log("pedido", tmdbId, mediaType, season, episode);
      const ctx = await withTimeout(resolveAnime(tmdbId, mediaType, season, episode), 20000, "mapping");
      if (!ctx) {
        log("sin mapeo");
        return [];
      }
      log("mapeo", ctx.anilistId, ctx.malId, "ep", ctx.episode, ctx.romaji);
      const streams = await withTimeout(Promise.resolve(run(ctx)), timeout, "scraper");
      const out = dedupe((streams || []).filter(Boolean));
      log("fuentes", out.length);
      return out;
    } catch (e) {
      log("error", e && e.message);
      return [];
    }
  }
  return getStreams;
}
