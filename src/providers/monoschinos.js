// MonosChinos (español, VOSE). Las fichas siguen las entradas de AniList
// (cada temporada aparte); los servidores salen de una llamada AJAX.

import { getText, request, log, settle, decodeHtml } from "../core/http.js";
import { defineProvider } from "../core/provider.js";
import { makeStream, guessFormat } from "../core/streams.js";
import { titleScore, searchQueries } from "../core/mapping.js";
import { extract, isSupported, hostRank } from "../core/extractors.js";

const BASE = "https://vww.monoschinos2.net";
const HEADERS = { Referer: `${BASE}/` };

async function search(q) {
  const html = await getText(`${BASE}/animes?buscar=${encodeURIComponent(q).replace(/%20/g, "+")}`, { headers: HEADERS });
  const out = [];
  for (const m of html.matchAll(/ficha_efecto["'][^>]*>([\s\S]*?)<\/li>/gi)) {
    const title = decodeHtml((m[1].match(/title=["']([^"']*)["']/) || [])[1] || "")
      .replace(/^Ver Anime\s+/i, "")
      .replace(/\s+Online Gratis$/i, "")
      .trim();
    const slug = (m[1].match(/href=["'](?:\.|https?:\/\/[^/]+)?\/anime\/([^"'/]+)["']/) || [])[1];
    if (title && slug && !/latino|castellano|doblaje/i.test(title + slug)) out.push({ slug, title });
  }
  return out;
}

async function findSlug(ctx) {
  const lists = await Promise.all(searchQueries(ctx).map((q) => search(q).catch(() => [])));
  const seen = new Set();
  const ranked = lists
    .flat()
    .filter((r) => (seen.has(r.slug) ? false : seen.add(r.slug)))
    .map((r) => ({ ...r, score: titleScore(r.title, ctx) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
  log("candidatos", ranked.map((r) => `${r.slug}(${r.score})`).join(" ") || "ninguno");
  if (ranked[0] && ranked[0].score === 2) return ranked[0].slug;
  return ranked.length === 1 ? ranked[0].slug : null;
}

async function run(ctx) {
  const slug = await findSlug(ctx);
  if (!slug) return [];
  const page = `${BASE}/ver/${slug}-episodio-${ctx.isMovie ? 1 : ctx.episode}`;
  const html = await getText(page, { headers: HEADERS });
  const enc = (html.match(/data-encrypt=["']([^"']+)["']/) || [])[1];
  if (!enc) return [];
  const res = await request(`${BASE}/ajax_pagination`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Requested-With": "XMLHttpRequest", Referer: page },
    body: `acc=opt&i=${encodeURIComponent(enc)}`,
  });
  const opt = await res.text();
  const urls = [];
  for (const m of opt.matchAll(/data-player=["']([^"']+)["']/g)) {
    try {
      const u = atob(m[1]).trim().replace(/^https?:\/\/monoschinos2\.com\/reproductor\?url=/, "");
      if (/^https?:\/\//.test(u) && isSupported(u) && !urls.includes(u)) urls.push(u);
    } catch (_) {}
  }
  urls.sort((a, b) => hostRank(a) - hostRank(b));
  log("servidores", urls.length);
  const results = await settle(urls.map((u) => extract(u, page)));
  return results.filter(Boolean).map((r) =>
    makeStream(ctx, {
      lang: "es",
      source: "MonosChinos",
      server: r.server,
      providerId: "monoschinos",
      url: r.url,
      quality: r.quality,
      format: r.format || guessFormat(r.url),
      headers: r.headers,
    })
  );
}

export const getStreams = defineProvider({ id: "monoschinos", run });
