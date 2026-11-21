import { resolveAnime } from "./mapping.js";
import { setLogPrefix, log, withTimeout, getText, startCapture, stopCapture, HAS_TIMERS, startBudget } from "./http.js";
import { dedupe, pickBestVariant } from "./streams.js";

// Envuelve un scraper: resuelve el anime, llama al scraper y nunca lanza error.
// `run(ctx)` devuelve una lista de fuentes ya formateadas.
// `titles: false` para scrapers que solo usan IDs (no consulta AniList).
export function defineProvider({ id, run, timeout = 25000, titles = true }) {
  // Botón "Probar" de Nuvio: usa Matrix (TMDB 603), que no es anime. En ese
  // caso se prueba un anime real y se devuelve el registro como resultados,
  // para poder ver en la tele en qué paso falla cada scraper.
  async function diagnose() {
    startCapture();
    const t0 = Date.now();
    let out = [];
    try {
      out = await getStreamsReal("303272", "tv", 1, 7);
    } catch (e) {
      log("excepción", e && e.message);
    }
    const lines = stopCapture().map((l) => l.replace(`[${id}] `, ""));
    const pick = (re) => lines.filter((l) => re.test(l));
    // La pantalla de prueba de Nuvio TV enseña solo 3 resultados.
    const rows = [
      `1 ${HAS_TIMERS ? "timers" : "sin timers"} · ${pick(/^mapeo|^sin mapeo/).join(" ") || "sin línea de mapeo"}`,
      `2 ${pick(/candidatos|servidores|ficha/).join(" | ") || "sin búsqueda"}`,
      `3 fuentes ${out.length} en ${Date.now() - t0} ms · ${pick(/error|failed|falla|tryText|tryJson|extractor|excepción|HTTP|timeout/).slice(0, 4).join(" | ") || "sin errores"}`,
    ];
    return rows.map((t, i) => ({
      name: `Diagnóstico ${i + 1}`,
      title: t.slice(0, 400),
      url: `https://example.com/diagnostico/${id}/${i + 1}`,
      quality: i === 2 ? `${out.length} fuentes` : "diag",
      type: "mp4",
    }));
  }

  async function getStreams(tmdbId, mediaType, season, episode) {
    if (String(tmdbId) === "603" && mediaType === "movie") return diagnose();
    return getStreamsReal(tmdbId, mediaType, season, episode);
  }

  async function getStreamsReal(tmdbId, mediaType, season, episode) {
    setLogPrefix(`[${id}]`);
    // Sin temporizadores (TV): no empezar peticiones pasados 25 s, para que
    // una conexión colgada (30 s) termine antes del límite de 60 s de Nuvio.
    startBudget(25000);
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
