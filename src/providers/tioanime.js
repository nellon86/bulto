// TioAnime (español, VOSE). Solo tiene versión subtitulada.

import { getText, log, settle, decodeHtml } from "../core/http.js";
import { defineProvider } from "../core/provider.js";
import { makeStream, guessFormat } from "../core/streams.js";
import { titleScore } from "../core/mapping.js";
import { extract, isSupported, hostRank } from "../core/extractors.js";

const BASE = "https://tioanime.com";

async function search(q) {
  const html = await getText(`${BASE}/directorio?q=${encodeURIComponent(q)}`);
  const out = [];
  const re = /<a href="\/anime\/([^"]+)">[\s\S]*?<h3 class="title">([^<]+)<\/h3>/g;
  let m;
  while ((m = re.exec(html))) out.push({ slug: m[1], title: decodeHtml(m[2]).trim() });
  return out;
}

async function findSlug(ctx) {
  const queries = [ctx.romaji, ctx.english].filter(Boolean).slice(0, 2);
  const lists = await Promise.all(queries.map((q) => search(q).catch(() => [])));
  for (const results of lists) {
    const ranked = results.map((r) => ({ ...r, score: titleScore(r.title, ctx) })).sort((a, b) => b.score - a.score);
    if (ranked[0] && ranked[0].score === 2) return ranked[0].slug;
    if (ranked.length === 1 && ranked[0].score === 1) return ranked[0].slug;
  }
  return null;
}

export async function runFor(ctx, providerId) {
  const slug = await findSlug(ctx);
  if (!slug) return [];
  const html = await getText(`${BASE}/ver/${slug}-${ctx.isMovie ? 1 : ctx.episode}`);
  const m = html.match(/var videos = (\[[\s\S]*?\]);/);
  if (!m) return [];
  let videos = [];
  try {
    videos = JSON.parse(m[1]);
  } catch (e) {
    log("videos", e.message);
    return [];
  }
  const servers = videos.map((v) => ({ server: v[0], url: v[1] })).filter((s) => isSupported(s.url))
    .sort((a, b) => hostRank(a.url) - hostRank(b.url));
  const results = await settle(
    servers.map(async (s) => {
      const r = await extract(s.url, `${BASE}/`);
      if (!r) return null;
      return makeStream(ctx, {
        lang: "es",
        source: "TioAnime",
        server: s.server,
        providerId,
        url: r.url,
        quality: r.quality,
        format: r.format || guessFormat(r.url),
        headers: r.headers,
      });
    })
  );
  return results.filter(Boolean);
}

export const getStreams = defineProvider({ id: "tioanime", run: (ctx) => runFor(ctx, "tioanime") });
