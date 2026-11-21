// JKAnime (español, VOSE). Su servidor propio ("Desu"/"Magi") da HLS directo
// en décimas de segundo; además se aprovechan MP4Upload, VidHide y Voe.
// Solo se usan los servidores marcados como subtitulados (lang 1 / lg_1).

import { getText, log, settle, decodeHtml } from "../core/http.js";
import { defineProvider } from "../core/provider.js";
import { makeStream, guessFormat } from "../core/streams.js";
import { pickByTitle, searchQueries } from "../core/mapping.js";
import { extract, isSupported, hostRank } from "../core/extractors.js";

const BASE = "https://jkanime.net";
const HEADERS = { Referer: `${BASE}/` };

async function search(q) {
  const html = await getText(`${BASE}/buscar/${encodeURIComponent(q)}/`, { headers: HEADERS });
  const out = [];
  const re = /<h5>\s*<a\s+href="https:\/\/jkanime\.net\/([^"/]+)\/"[^>]*>([^<]+)<\/a>/g;
  let m;
  while ((m = re.exec(html))) out.push({ slug: m[1], title: decodeHtml(m[2]).trim() });
  return out;
}

async function findSlug(ctx) {
  const lists = await Promise.all(searchQueries(ctx).map((q) => search(q).catch(() => [])));
  const { slug, ranked } = pickByTitle(lists, ctx);
  log("candidatos", ranked.map((r) => `${r.slug}(${r.score})`).join(" ") || "ninguno", "→", slug || "-");
  return slug;
}

// Servidor propio: la página del reproductor trae el enlace m3u8.
async function ownPlayer(url, page) {
  const html = await getText(url, { headers: { Referer: page }, timeout: 6000 });
  const m = html.match(/https?:\/\/[^"'\s<>\\]+\.m3u8[^"'\s<>\\]*/);
  return m ? { url: m[0], headers: HEADERS, quality: "1080p", format: "m3u8" } : null;
}

async function run(ctx) {
  const slug = await findSlug(ctx);
  if (!slug) return [];
  const page = `${BASE}/${slug}/${ctx.isMovie ? 1 : ctx.episode}/`;
  const html = await getText(page, { headers: HEADERS });

  // Pestañas: <a data-id="N" class="... lg_1 ...">Nombre</a> ↔ video[N] = '<iframe src="...">'
  const tabs = {};
  for (const m of html.matchAll(/data-id="(\d+)"\s+class="[^"]*\blg_(\d+)[^"]*"[^>]*>([^<]+)</g)) tabs[m[1]] = { lang: m[2], name: m[3].trim() };
  const own = [];
  for (const m of html.matchAll(/video\[(\d+)\]\s*=\s*'<iframe[^>]+src="(https:\/\/jkanime\.net\/jkplayer\/umv?\?[^"]+)"/g)) {
    const t = tabs[m[1]];
    if (!t || t.lang === "1") own.push({ name: (t && t.name) || "JK", url: m[2] });
  }

  // Servidores externos (JSON en "var servers").
  let external = [];
  const sv = html.match(/var servers = (\[[\s\S]*?\]);/);
  if (sv) {
    try {
      external = JSON.parse(sv[1])
        .filter((s) => Number(s.lang) === 1)
        .map((s) => ({ name: s.server, url: atob(s.remote).trim() }))
        .filter((s) => isSupported(s.url))
        .sort((a, b) => hostRank(a.url) - hostRank(b.url));
    } catch (e) {
      log("servers", e.message);
    }
  }
  log("servidores", [...own, ...external].map((s) => s.name).join(",") || "ninguno");

  const results = await settle([
    ...own.map(async (s) => {
      const r = await ownPlayer(s.url, page);
      return r && { ...r, server: s.name };
    }),
    ...external.map((s) => extract(s.url, page)),
  ]);
  const seen = new Set();
  return results
    .filter((r) => r && r.url && !seen.has(r.url.split("?")[0]) && seen.add(r.url.split("?")[0]))
    .map((r) =>
      makeStream(ctx, {
        lang: "es",
        source: "JKAnime",
        server: r.server,
        providerId: "jkanime",
        url: r.url,
        quality: r.quality,
        format: r.format || guessFormat(r.url),
        headers: r.headers,
      })
    );
}

export const getStreams = defineProvider({ id: "jkanime", run });
