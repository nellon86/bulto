import { resolveAnime } from "./mapping.js";
import { setLogPrefix, log, withTimeout, getText } from "./http.js";
import { dedupe, pickBestVariant } from "./streams.js";

// Envuelve un scraper: resuelve el anime, llama al scraper y nunca lanza error.
// `run(ctx)` devuelve una lista de fuentes ya formateadas.
// `titles: false` para scrapers que solo usan IDs (no consulta AniList).
export function defineProvider({ id, run, timeout = 25000, titles = true }) {
  async function getStreams(tmdbId, mediaType, season, episode) {
    setLogPrefix(`[${id}]`);
    const t0 = Date.now();
    try {
      log("pedido", tmdbId, mediaType, season, episode);
      const ctx = await withTimeout(resolveAnime(tmdbId, mediaType, season, episode, { titles }), 15000, "mapping");
      const tMap = Date.now() - t0;
      if (!ctx) {
        log(`sin mapeo (${tMap} ms)`);
        return [];
      }
      log(`mapeo ${ctx.anilistId}/${ctx.malId} ep ${ctx.episode} ${ctx.romaji || ""} (${tMap} ms)`);
      const streams = await withTimeout(Promise.resolve(run(ctx)), timeout, "scraper");
      // Siempre la máxima calidad disponible en las listas HLS con varias calidades.
      const best = await Promise.all(
        (streams || []).filter(Boolean).map((st) =>
          pickBestVariant(st, (u, h) => getText(u, { headers: h, timeout: 4000 })).catch(() => st)
        )
      );
      const out = dedupe(best);
      log(`fuentes ${out.length} en ${Date.now() - t0} ms (scraper ${Date.now() - t0 - tMap} ms)`);
      return out;
    } catch (e) {
      log(`error ${e && e.message} (${Date.now() - t0} ms)`);
      return [];
    }
  }
  return getStreams;
}
