// Formato común de las fuentes devueltas a Nuvio.

import { UA } from "./http.js";

const FLAGS = { en: "🇬🇧", es: "🇪🇸", it: "🇮🇹" };
const LABEL = { en: "SUB EN", es: "SUB ESP", it: "SUB ITA" };

export function makeStream(ctx, opts) {
  const lang = opts.lang;
  const quality = normalizeQuality(opts.quality);
  const ep = ctx.isMovie ? "Película" : `Ep. ${ctx.episode}`;
  const where = ctx.isMovie || !ctx.season || !ctx.tmdbEpisode ? "" : ` · T${ctx.season}E${ctx.tmdbEpisode}`;
  const lines = [
    `${ctx.display}${where}`,
    `${FLAGS[lang]} ${LABEL[lang]} · ${quality} · ${opts.format === "mp4" ? "MP4" : "HLS"}`,
    `${opts.source}${opts.server ? " · " + opts.server : ""} · ${ep}`,
  ];
  const headers = Object.assign({ "User-Agent": UA }, opts.headers || {});
  const out = {
    // Nuvio ordena las fuentes de un scraper por nombre: el servidor va en el
    // nombre para que el orden sea alfabético por servidor (Zilla queda al final).
    name: `${FLAGS[lang]} ${opts.source}${opts.server ? " · " + opts.server : ""}`,
    title: lines.join("\n"),
    url: opts.url,
    quality,
    language: lang,
    type: opts.format === "mp4" ? "mp4" : "m3u8",
    headers,
    provider: opts.providerId,
  };
  if (opts.subtitles && opts.subtitles.length) {
    out.subtitles = opts.subtitles
      .filter((s) => s && s.url)
      .map((s) => ({ url: s.url, language: s.language || s.lang || "Unknown", name: s.name || s.label || s.language || "Sub" }));
  }
  return out;
}

export function normalizeQuality(q) {
  const s = String(q || "").toLowerCase();
  if (/2160|4k/.test(s)) return "2160p";
  if (/1080/.test(s)) return "1080p";
  if (/720/.test(s)) return "720p";
  if (/480/.test(s)) return "480p";
  if (/360/.test(s)) return "360p";
  return q ? String(q) : "Auto";
}

export function guessFormat(url) {
  return /\.mp4(\?|$)/i.test(url) ? "mp4" : "m3u8";
}

export function dedupe(list) {
  const seen = new Set();
  return list.filter((s) => {
    if (!s || !s.url || seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });
}
