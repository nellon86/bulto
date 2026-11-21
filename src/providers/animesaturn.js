// AnimeSaturn (italiano, SUB ITA). Comprueba el ID de AniList de la ficha y
// descifra la lista de reproducción de su reproductor (saturncdn).

import { getText, getJson, log, decodeHtml } from "../core/http.js";
import { defineProvider } from "../core/provider.js";
import { makeStream, guessFormat } from "../core/streams.js";
import { titleScore } from "../core/mapping.js";

const BASE = "https://www.animesaturn.net";
const HEADERS = { Referer: `${BASE}/` };

async function search(q) {
  const html = await getText(`${BASE}/filter?key=${encodeURIComponent(q)}`, { headers: HEADERS });
  const out = [];
  const re = /<a href="(\/anime\/[^"]+)" class="ac[^"]*">[\s\S]*?alt="([^"]*)"/g;
  let m;
  while ((m = re.exec(html))) out.push({ href: m[1], title: decodeHtml(m[2]) });
  const seen = new Set();
  // Fuera las fichas dobladas (terminan en "-ita-XXXXX").
  return out.filter((x) => !/-ita-[A-Za-z0-9]+$/.test(x.href) && (seen.has(x.href) ? false : seen.add(x.href)));
}

async function findAnime(ctx) {
  const tried = new Set();
  for (const q of [ctx.romaji, ctx.english].filter(Boolean)) {
    const results = await search(q).catch(() => []);
    const ranked = results
      .map((r) => ({ ...r, score: titleScore(r.title, ctx) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    for (const r of ranked) {
      if (tried.has(r.href)) continue;
      tried.add(r.href);
      const html = await getText(BASE + r.href, { headers: HEADERS }).catch(() => null);
      if (!html) continue;
      const al = (html.match(/anilist\.co\/anime\/(\d+)/) || [])[1];
      const mal = (html.match(/myanimelist\.net\/anime\/(\d+)/) || [])[1];
      if (Number(al) === ctx.anilistId || (ctx.malId && Number(mal) === ctx.malId)) return r.href;
    }
  }
  return null;
}

function xorDecode(b64, key) {
  const raw = atob(b64);
  let out = "";
  for (let i = 0; i < raw.length; i++) out += String.fromCharCode(raw.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  return out;
}

async function run(ctx) {
  const href = await findAnime(ctx);
  if (!href) return [];
  const page = await getText(`${BASE}${href}/ep-${ctx.isMovie ? 1 : ctx.episode}`, { headers: HEADERS });
  const iframe = (page.match(/id="watch-iframe"\s+src="([^"]+)"/) || [])[1];
  if (!iframe) {
    log("sin reproductor");
    return [];
  }
  const embedUrl = decodeHtml(iframe);
  const embedOrigin = (embedUrl.match(/^(https?:\/\/[^/]+)/) || [])[1];
  const embed = await getText(embedUrl, { headers: HEADERS });
  const e = embed.match(/window\.__E=\{i:(\d+),k:"([0-9a-f]+)",e:(\d+)\}/);
  if (!e) {
    log("sin datos del reproductor");
    return [];
  }
  const [, id, key, exp] = e;
  const pl = await getJson(`${embedOrigin}/embed/${id}/playlist?token=${encodeURIComponent(key)}&expires=${exp}`, {
    headers: { Referer: embedUrl },
  });
  const src = pl && pl.d ? xorDecode(pl.d, key) : null;
  if (!src || !/^https?:/.test(src)) {
    log("sin enlace", src);
    return [];
  }
  return [
    makeStream(ctx, {
      lang: "it",
      source: "AnimeSaturn",
      providerId: "animesaturn",
      url: src,
      quality: "1080p",
      format: guessFormat(src),
      headers: { Referer: `${embedOrigin}/`, Origin: embedOrigin },
    }),
  ];
}

export const getStreams = defineProvider({ id: "animesaturn", run });
