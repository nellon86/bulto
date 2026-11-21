// AniZone: busca por título, elige la ficha que coincide y lee el reproductor
// del episodio (HLS con subtítulos en varios idiomas).

import { getText, log } from "../core/http.js";
import { defineProvider } from "../core/provider.js";
import { makeStream } from "../core/streams.js";
import { titleScore } from "../core/mapping.js";

const BASE = "https://anizone.to";
const HEADERS = { Referer: `${BASE}/` };

function parseJsonParse(raw) {
  const s = raw
    .replace(/\\u0022/g, '"')
    .replace(/\\u0026/g, "&")
    .replace(/\\'/g, "'")
    .replace(/\\\//g, "/")
    .replace(/\\\\/g, "\\")
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, h) => "\\u00" + h)
    .replace(/\\(?!["\\/bfnrtu])/g, "");
  return JSON.parse(s);
}

async function search(query) {
  const html = await getText(`${BASE}/anime?search=${encodeURIComponent(query)}&sort=title-asc`, { headers: HEADERS });
  const m = html.match(/items:\s*JSON\.parse\('((?:[^'\\]|\\.)*)'\)/);
  if (!m) return [];
  try {
    const items = parseJsonParse(m[1]);
    return (Array.isArray(items) ? items : []).map((it) => ({
      slug: it.slug,
      titles: [it.main_title, ...Object.values(it.title_list || {})].filter(Boolean),
    }));
  } catch (e) {
    log("parse", e.message);
    return [];
  }
}

const LANG = { en: "en", english: "en", es: "es", spa: "es", spanish: "es", it: "it", ita: "it", italian: "it" };

async function run(ctx) {
  const queries = [ctx.romaji, ctx.english].filter(Boolean);
  let pick = null;
  for (const q of queries) {
    const cards = await search(q).catch(() => []);
    let best = 0;
    for (const c of cards) {
      const score = Math.max(...c.titles.map((t) => titleScore(t, ctx)));
      if (score > best) {
        best = score;
        pick = c;
      }
    }
    if (pick && best === 2) break;
  }
  if (!pick) return [];
  const url = `${BASE}/anime/${pick.slug}/${ctx.episode}`;
  const html = await getText(url, { headers: HEADERS });
  const m = html.match(/vidstackPlayer\(JSON\.parse\('((?:[^'\\]|\\.)*)'\)\)/);
  let src = null;
  let subs = [];
  if (m) {
    const data = parseJsonParse(m[1]);
    src = data.src ? String(data.src).replace(/\\/g, "") : null;
    subs = (data.subtitles || []).map((s) => ({
      url: String(s.file || "").replace(/\\/g, ""),
      name: s.title || s.language || "Sub",
      language: s.language || "und",
    }));
  }
  if (!src) src = (html.match(/https:\/\/[^"']+\/master\.m3u8/) || [])[0];
  if (!src) return [];
  // Solo vale si hay subtítulos (si no, sería un doblaje sin subtítulos).
  const langs = new Set(subs.map((s) => LANG[String(s.language).toLowerCase()] || null).filter(Boolean));
  if (!subs.length) return [];
  // Una sola fuente: el idioma principal es el primero disponible de ES, IT, EN.
  const lang = ["es", "it", "en"].find((l) => langs.has(l)) || "en";
  const list = ["es", "it", "en"].filter((l) => langs.has(l)).map((l) => l.toUpperCase());
  return [
    makeStream(ctx, {
      lang,
      source: "AniZone",
      server: list.length ? "Subs " + list.join("/") : null,
      providerId: "anizone",
      url: src,
      quality: "1080p",
      format: "m3u8",
      headers: HEADERS,
      subtitles: subs,
    }),
  ];
}

export const getStreams = defineProvider({ id: "anizone", run });
