// AnimeWorld (italiano, SUB ITA). Comprueba el ID de AniList de la ficha y
// descarta las fichas dobladas "(ITA)". El vídeo es un MP4 directo.

import { getText, getJson, log, decodeHtml } from "../core/http.js";
import { defineProvider } from "../core/provider.js";
import { makeStream, guessFormat } from "../core/streams.js";
import { titleScore } from "../core/mapping.js";

const BASE = "https://www.animeworld.ac";
const HEADERS = { Referer: `${BASE}/` };

async function search(q) {
  const html = await getText(`${BASE}/search?keyword=${encodeURIComponent(q)}`, { headers: HEADERS });
  const out = [];
  const re = /<a href="(\/play\/[^"]+)"[^>]*data-jtitle="([^"]*)"[^>]*class="name">([^<]*)<\/a>/g;
  let m;
  while ((m = re.exec(html))) out.push({ href: m[1], jtitle: decodeHtml(m[2]), title: decodeHtml(m[3]) });
  if (!out.length) {
    const re2 = /<a[^>]+class="name"[^>]*>[^<]*<\/a>/g;
    let a;
    while ((a = re2.exec(html))) {
      const tag = a[0];
      const href = (tag.match(/href="([^"]+)"/) || [])[1];
      if (href) out.push({ href, jtitle: decodeHtml((tag.match(/data-jtitle="([^"]*)"/) || [])[1] || ""), title: decodeHtml(tag.replace(/<[^>]+>/g, "")) });
    }
  }
  // Fuera las versiones dobladas.
  return out.filter((x) => !/\(ITA\)/i.test(x.title) && !/\(ITA\)/i.test(x.jtitle) && !/-ita\./i.test(x.href));
}

async function findPage(ctx) {
  const queries = [ctx.romaji, ctx.english].filter(Boolean).slice(0, 2);
  const lists = await Promise.all(queries.map((q) => search(q).catch(() => [])));
  const seen = new Set();
  const ranked = lists
    .flat()
    .filter((r) => (seen.has(r.href) ? false : seen.add(r.href)))
    .map((r) => ({ ...r, score: Math.max(titleScore(r.title, ctx), titleScore(r.jtitle, ctx)) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
  // Abre las fichas candidatas en paralelo y se queda con la del ID correcto.
  const pages = await Promise.all(ranked.map((r) => getText(BASE + r.href, { headers: HEADERS }).catch(() => null)));
  for (const html of pages) {
    if (!html) continue;
    const al = (html.match(/anilist\.co\/anime\/(\d+)/) || [])[1];
    const mal = (html.match(/myanimelist\.net\/anime\/(\d+)/) || [])[1];
    if (Number(al) === ctx.anilistId || (ctx.malId && Number(mal) === ctx.malId)) return html;
  }
  return null;
}

async function run(ctx) {
  const html = await findPage(ctx);
  if (!html) return [];
  const ep = ctx.isMovie ? 1 : ctx.episode;
  const re = new RegExp(`data-episode-num="${ep}"[^>]*?data-id="([^"]+)"|data-id="([^"]+)"[^>]*?data-episode-num="${ep}"`);
  let m = html.match(re);
  let id = m && (m[1] || m[2]);
  if (!id) {
    // Las etiquetas pueden tener el orden de atributos distinto.
    const tags = html.match(/<a[^>]+data-episode-num="[^"]+"[^>]*>/g) || [];
    const tag = tags.find((t) => new RegExp(`data-episode-num="${ep}"`).test(t));
    id = tag && (tag.match(/data-id="([^"]+)"/) || [])[1];
  }
  if (!id) {
    log("episodio no encontrado", ep);
    return [];
  }
  const info = await getJson(`${BASE}/api/episode/info?id=${id}&alt=0`, { headers: HEADERS });
  const url = info && info.grabber;
  if (!url || !/^https?:/.test(url)) return [];
  return [
    makeStream(ctx, {
      lang: "it",
      source: "AnimeWorld",
      providerId: "animeworld",
      url,
      quality: /1080/.test(url) ? "1080p" : "720p",
      format: guessFormat(url),
      headers: HEADERS,
    }),
  ];
}

export const getStreams = defineProvider({ id: "animeworld", run });
