// LatAnime: doblaje en castellano y latino (cada doblaje es una ficha aparte,
// "... Castellano" / "... Latino"); las fichas sin sufijo son subtituladas.
// Algunas fichas juntan todas las temporadas con numeración continua.

import { getText, log, settle, decodeHtml } from "../core/http.js";
import { makeStream, guessFormat } from "../core/streams.js";
import { titleScore, norm } from "../core/mapping.js";
import { extract, isSupported, hostRank } from "../core/extractors.js";

const BASE = "https://latanime.org";
const HEADERS = { Referer: `${BASE}/` };

function langOf(badge, title) {
  const s = `${badge} ${title}`.toLowerCase();
  if (/castellano/.test(s)) return "es-cast";
  if (/latino/.test(s)) return "es-lat";
  if (/catal/.test(s)) return "ca";
  return "es"; // subtitulado
}

// Separa "Spy x Family S2 Castellano" en título base y temporada.
function parseTitle(raw) {
  let t = String(raw).replace(/\s+(castellano|latino|catal[aá]n)\s*$/i, "").trim();
  let season = null;
  const m = t.match(/\s+(?:s|temporada\s*|season\s*)(\d+)$/i) || t.match(/\s+(\d+)(?:st|nd|rd|th)\s+season$/i);
  if (m) {
    season = Number(m[1]);
    t = t.slice(0, m.index).trim();
  }
  return { base: t, season };
}

async function search(q) {
  const html = await getText(`${BASE}/buscar?q=${encodeURIComponent(q)}`, { headers: HEADERS });
  const out = [];
  const re = /<a href="https:\/\/latanime\.org\/anime\/([^"]+)">[\s\S]*?<h3[^>]*>([^<]+)<\/h3>[\s\S]*?<span class="opacity-75">([^<]*)<\/span>/g;
  let m;
  while ((m = re.exec(html))) {
    const title = decodeHtml(m[2]).trim();
    const p = parseTitle(title);
    out.push({ slug: m[1], title, badge: m[3].trim(), lang: langOf(m[3], title), base: p.base, season: p.season });
  }
  return out;
}

async function servers(slug, ep) {
  const html = await getText(`${BASE}/ver/${slug}-episodio-${ep}`, { headers: HEADERS }).catch(() => null);
  if (!html) return [];
  const out = [];
  const tags = html.match(/<a[^>]+data-player="[^"]+"[^>]*>/g) || [];
  for (const tag of tags) {
    if (!/play-video/.test(tag)) continue;
    try {
      const url = atob((tag.match(/data-player="([^"]+)"/) || [])[1]).trim();
      if (/^https?:\/\//.test(url) && isSupported(url)) out.push(url);
    } catch (_) {}
  }
  return out.sort((a, b) => hostRank(a) - hostRank(b));
}

// Elige la ficha de un idioma y el número de episodio que le corresponde.
function choose(cards, ctx) {
  const S = ctx.season || 1;
  const matching = cards.filter((c) => c.ok);
  if (ctx.isMovie) return matching.length ? [{ card: matching[0], ep: 1 }] : [];
  const tries = [];
  const bySeason = matching.find((c) => c.season === S);
  if (bySeason) tries.push({ card: bySeason, ep: ctx.episode });
  const base = matching.find((c) => !c.season);
  if (base) {
    if (S <= 1) tries.push({ card: base, ep: ctx.episode });
    else tries.push({ card: base, ep: ctx.absoluteEpisode }, { card: base, ep: ctx.episode });
  }
  return tries;
}

async function streamsFor(ctx, cards, lang, providerId) {
  for (const t of choose(cards, ctx)) {
    const urls = await servers(t.card.slug, t.ep);
    if (!urls.length) continue;
    log("ficha", t.card.slug, "ep", t.ep, urls.length, "servidores");
    const results = await settle(
      urls.map(async (u) => {
        const r = await extract(u, `${BASE}/`);
        if (!r) return null;
        return makeStream(ctx, {
          lang,
          source: "LatAnime",
          server: r.server,
          providerId,
          url: r.url,
          quality: r.quality,
          format: r.format || guessFormat(r.url),
          headers: r.headers,
        });
      })
    );
    const ok = results.filter(Boolean);
    if (ok.length) return ok;
  }
  return [];
}

// Doblajes (castellano y latino); si no hay ninguno, la versión subtitulada.
export async function runDub(ctx, providerId) {
  // El buscador no tolera signos: "Your Name." no encuentra nada y "Your Name" sí.
  const clean = (q) => String(q).replace(/×/g, " x ").replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
  const queries = [ctx.titleEs, ctx.titleEsLat, ctx.english, ctx.romaji].filter(Boolean).map(clean).filter(Boolean);
  const unique = [...new Set(queries)].slice(0, 4);
  const lists = await Promise.all(unique.map((q) => search(q).catch(() => [])));
  const seen = new Set();
  const cards = lists.flat().filter((c) => (seen.has(c.slug) ? false : seen.add(c.slug)));
  // Una ficha vale si su título coincide o si es otra versión (castellano,
  // latino, sub) de una ficha que coincide: los títulos de España y
  // Latinoamérica a menudo difieren ("Tras finalizar el viaje" / "Más allá...").
  const family = (slug) => slug.replace(/-(castellano|latino|catalan)$/, "");
  const ok = cards.filter((c) => titleScore(c.base, ctx) > 0 || titleScore(c.title, ctx) > 0);
  const fams = new Set(ok.map((c) => family(c.slug)));
  const bases = new Set(ok.map((c) => norm(c.base)));
  for (const c of cards) c.ok = fams.has(family(c.slug)) || bases.has(norm(c.base));
  log("fichas", cards.filter((c) => c.ok).map((c) => `${c.slug}[${c.lang}${c.season ? " T" + c.season : ""}]`).join(" ") || "ninguna");
  const [cast, lat] = await Promise.all([
    streamsFor(ctx, cards.filter((c) => c.lang === "es-cast"), "es-cast", providerId),
    streamsFor(ctx, cards.filter((c) => c.lang === "es-lat"), "es-lat", providerId),
  ]);
  if (cast.length || lat.length) return [...cast, ...lat];
  return streamsFor(ctx, cards.filter((c) => c.lang === "es"), "es", providerId);
}
