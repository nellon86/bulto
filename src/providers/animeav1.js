// AnimeAV1 (español, VOSE). Identifica la serie por su ID de MAL y extrae
// solo los servidores de la sección SUB.

import { getText, getJson, log, settle } from "../core/http.js";
import { defineProvider } from "../core/provider.js";
import { makeStream, guessFormat } from "../core/streams.js";
import { titleScore } from "../core/mapping.js";
import { extract, isSupported, hostRank } from "../core/extractors.js";

const BASE = "https://animeav1.com";

async function search(q) {
  const html = await getText(`${BASE}/catalogo?search=${encodeURIComponent(q)}`);
  const out = [];
  const re = /<h3[^>]*>([^<]+)<\/h3><\/header>\s*<a[^>]+href="\/media\/([^"/]+)"/g;
  let m;
  while ((m = re.exec(html))) out.push({ title: m[1].trim(), slug: m[2] });
  if (!out.length) {
    const re2 = /href="\/media\/([^"/]+)"/g;
    while ((m = re2.exec(html))) out.push({ title: m[1].replace(/-/g, " "), slug: m[1] });
  }
  const seen = new Set();
  return out.filter((x) => (seen.has(x.slug) ? false : seen.add(x.slug)));
}

// Lee el malId de la ficha (formato de datos de SvelteKit).
async function malIdOf(slug) {
  const json = await getJson(`${BASE}/media/${slug}/__data.json`);
  const node = (json.nodes || []).find((n) => n && n.data && n.data[0] && n.data[0].media !== undefined);
  if (!node) return null;
  const d = node.data;
  const media = d[d[0].media];
  return media && media.malId !== undefined ? d[media.malId] : null;
}

export async function findSlug(ctx) {
  const queries = [ctx.romaji, ctx.english].filter(Boolean).slice(0, 2);
  const lists = await Promise.all(queries.map((q) => search(q).catch(() => [])));
  const seen = new Set();
  const ranked = lists
    .flat()
    .filter((r) => (seen.has(r.slug) ? false : seen.add(r.slug)))
    .map((r) => ({ ...r, score: titleScore(r.title, ctx) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
  if (!ctx.malId) return ranked[0] && ranked[0].score === 2 ? ranked[0].slug : null;
  // Comprueba el MAL de los candidatos en paralelo.
  const mals = await Promise.all(ranked.map((r) => malIdOf(r.slug).catch(() => null)));
  const i = mals.findIndex((m) => Number(m) === Number(ctx.malId));
  return i >= 0 ? ranked[i].slug : null;
}

// Lista de servidores de un bloque ("SUB" o "DUB") del script de la página.
export function serverList(html, lang) {
  const block = (html.match(/embeds:\s?\{((?:\w+:\s?\[.*?\],?)*)\}/) || [])[1];
  const list = block && (block.match(new RegExp("\\b" + lang + ":\\s?(\\[.*?\\])")) || [])[1];
  if (!list) return [];
  const out = [];
  const re = /server:"([^"]+)",url:"([^"]+)"/g;
  let m;
  while ((m = re.exec(list))) out.push({ server: m[1], url: m[2] });
  return out.filter((s) => isSupported(s.url)).sort((a, b) => hostRank(a.url) - hostRank(b.url));
}

export async function episodeHtml(ctx, slug) {
  return getText(ctx.isMovie ? `${BASE}/media/${slug}/1` : `${BASE}/media/${slug}/${ctx.episode}`);
}

// Extrae los enlaces de una lista de servidores y les da formato.
export async function toStreams(ctx, servers, lang, providerId) {
  log("servidores", lang, servers.map((s) => s.server).join(","));
  const results = await settle(
    servers.map(async (s) => {
      const r = await extract(s.url, `${BASE}/`);
      if (!r) return null;
      return makeStream(ctx, {
        lang,
        source: "AnimeAV1",
        server: r.server || s.server,
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

async function run(ctx) {
  const slug = await findSlug(ctx);
  if (!slug) return [];
  const html = await episodeHtml(ctx, slug);
  return toStreams(ctx, serverList(html, "SUB"), "es", "animeav1");
}

export const getStreams = defineProvider({ id: "animeav1", run });
