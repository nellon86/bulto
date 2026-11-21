// Formato común de las fuentes devueltas a Nuvio.

import { UA } from "./http.js";

const FLAGS = { en: "🇬🇧", es: "🇪🇸", it: "🇮🇹", "es-cast": "🇪🇸", "es-lat": "🇲🇽", "it-dub": "🇮🇹" };
const LABEL = {
  en: "SUB EN",
  es: "SUB ESP",
  it: "SUB ITA",
  "es-cast": "DOBLAJE CASTELLANO",
  "es-lat": "DOBLAJE LATINO",
  "it-dub": "DOPPIAGGIO ITA",
};
const LANG_CODE = { en: "en", es: "es", it: "it", "es-cast": "es", "es-lat": "es", "it-dub": "it" };

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
    language: LANG_CODE[lang] || lang,
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

// Si el enlace es una lista HLS "maestra" con varias calidades, la cambia por
// la de mayor resolución (1080p cuando existe), para que el reproductor no
// empiece en una calidad baja. Si el audio va en pistas aparte
// (EXT-X-MEDIA TYPE=AUDIO con URI) se deja la maestra: la variante sola no
// tendría sonido.
export async function pickBestVariant(stream, fetchText) {
  if (!stream || stream.type !== "m3u8") return stream;
  // VidHide/Voe marcan las calidades en la ruta ("_n", ",n,"): una sola letra
  // = una sola calidad, no hay nada que elegir (y su CDN a veces tarda).
  if (/_n\/master\.m3u8|_,n,\.urlset/.test(stream.url)) return stream;
  let text;
  try {
    text = await fetchText(stream.url, stream.headers);
  } catch (_) {
    return stream;
  }
  if (!text || !/#EXT-X-STREAM-INF/i.test(text)) return stream;
  // Pistas de audio o subtítulos aparte: se perderían al elegir una variante.
  if (/#EXT-X-MEDIA:[^\n]*TYPE=(AUDIO|SUBTITLES)[^\n]*URI=/i.test(text)) return stream;
  const lines = text.split(/\r?\n/);
  let best = null;
  for (let i = 0; i < lines.length; i++) {
    if (!/^#EXT-X-STREAM-INF/i.test(lines[i])) continue;
    let uri = "";
    for (let j = i + 1; j < lines.length; j++) {
      const l = lines[j].trim();
      if (l && !l.startsWith("#")) {
        uri = l;
        break;
      }
    }
    if (!uri) continue;
    const h = Number((lines[i].match(/RESOLUTION=\d+x(\d+)/i) || [])[1] || 0);
    const bw = Number((lines[i].match(/[^-]BANDWIDTH=(\d+)/i) || [])[1] || 0);
    if (!best || h > best.h || (h === best.h && bw > best.bw)) best = { h, bw, uri };
  }
  if (!best) return stream;
  const url = resolveUrl(stream.url, best.uri);
  const quality = best.h ? normalizeQuality(`${best.h}p`) : stream.quality;
  const title = stream.title && stream.quality ? stream.title.replace(` · ${stream.quality} · `, ` · ${quality} · `) : stream.title;
  return Object.assign({}, stream, { url, quality, title });
}

// Resuelve una ruta relativa de una lista HLS (sin depender de URL, que el
// motor de Nuvio TV puede no tener).
function resolveUrl(base, uri) {
  if (/^https?:\/\//i.test(uri)) return uri;
  if (uri.startsWith("//")) return base.split(":")[0] + ":" + uri;
  const origin = (base.match(/^https?:\/\/[^/]+/i) || [""])[0];
  if (uri.startsWith("/")) return origin + uri;
  const dir = base.split("?")[0].replace(/[^/]*$/, "");
  const parts = (dir.slice(origin.length) + uri).split("/");
  const out = [];
  for (const p of parts) {
    if (p === "..") out.pop();
    else if (p !== ".") out.push(p);
  }
  return origin + out.join("/").replace(/^\/?/, "/");
}
