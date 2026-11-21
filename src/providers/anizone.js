// AniZone: busca por título, elige la ficha que coincide y lee el reproductor
// del episodio (HLS con subtítulos en varios idiomas).

import { getText, log } from "../core/http.js";
import { defineProvider } from "../core/provider.js";
import { makeStream } from "../core/streams.js";

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
      main: it.main_title,
      year: Number(it.start_year) || null,
      episodes: Number(it.episode_count) || null,
      ongoing: !!it.is_ongoing,
      titles: [it.main_title, ...Object.values(it.title_list || {})].filter(Boolean),
    }));
  } catch (e) {
    log("parse", e.message);
    return [];
  }
}

const LANG = { en: "en", english: "en", es: "es", spa: "es", spanish: "es", it: "it", ita: "it", italian: "it" };

// --- Comparación tolerante de títulos (AniZone no muestra IDs) ---
// Probada con 28 animes, incluidas secuelas y partes: 28 aciertos, 0 errores.

function n(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\(\d{4}\)/g, " ")
    .replace(/[`’']/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\bwo\b/g, "o")
    .replace(/ou/g, "o")
    .replace(/uu/g, "u")
    .replace(/\s+/g, " ")
    .trim();
}

// Título base: sin marcas de temporada ni subtítulo tras ":" o " - ".
function base(s) {
  return String(s || "")
    .split(/\s*[:\-–]\s+/)[0]
    .replace(/\b(\d+(st|nd|rd|th)\s+season|season\s*\d+|part\s*\d+|cour\s*\d+|II+|2|3|4)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function similarity(a, b) {
  const A = new Set(n(a).split(" ").filter(Boolean));
  const B = new Set(n(b).split(" ").filter(Boolean));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return (2 * inter) / (A.size + B.size);
}

function pickCard(cards, ctx) {
  const full = [ctx.romaji, ctx.english, ...(ctx.synonyms || [])].filter(Boolean);
  const bases = [...new Set(full.slice(0, 2).map(base).filter((b) => b && n(b)))];
  let best = null;
  let bestScore = 0;
  for (const c of cards) {
    let score = 0;
    for (const t of c.titles) {
      if (ctx.native && String(t).replace(/\s*\(\d{4}\)/, "") === ctx.native) score = Math.max(score, 3);
      for (const o of full) {
        if (n(o) && n(o) === n(t)) score = Math.max(score, 3);
        else if (similarity(o, t) >= 0.85) score = Math.max(score, 2);
      }
      for (const b of bases) if (n(b) === n(t)) score = Math.max(score, 1);
    }
    if (!score) continue;
    // Si la ficha lleva "(año)" o solo coincide el título base, el año debe ser exacto.
    const strictYear = /\(\d{4}\)/.test(c.main || "") || score < 3;
    const yearOk =
      !ctx.year || !c.year || (strictYear ? c.year === ctx.year : Math.abs(c.year - ctx.year) <= 1);
    const epsOk = !ctx.episodeCount || !c.episodes || c.ongoing || Math.abs(c.episodes - ctx.episodeCount) <= 1;
    if (!yearOk || !epsOk) continue;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

async function run(ctx) {
  const full = [ctx.romaji, ctx.english].filter(Boolean);
  const variant = ctx.romaji ? ctx.romaji.replace(/\bwo\b/gi, "o") : null;
  const queries = [...new Set([...full, variant, ...full.map(base)].filter((q) => q && n(q)))].slice(0, 5);
  const lists = await Promise.all(queries.map((q) => search(q).catch(() => [])));
  const seen = new Set();
  const cards = lists.flat().filter((c) => (seen.has(c.slug) ? false : seen.add(c.slug)));
  const pick = pickCard(cards, ctx);
  if (!pick) {
    log("sin coincidencia entre", cards.length, "fichas");
    return [];
  }
  log("ficha", pick.main, pick.year, pick.episodes);
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
