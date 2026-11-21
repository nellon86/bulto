// Generado desde src/ con tools/build.mjs. No editar a mano.

var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/providers/tioanime.js
var tioanime_exports = {};
__export(tioanime_exports, {
  getStreams: () => getStreams
});
module.exports = __toCommonJS(tioanime_exports);

// src/core/http.js
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout " + (label || ""))), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
async function request(url, opts = {}) {
  const headers = Object.assign({ "User-Agent": UA }, opts.headers || {});
  const init = { method: opts.method || "GET", headers };
  if (opts.body !== void 0) init.body = opts.body;
  if (opts.redirect) init.redirect = opts.redirect;
  return withTimeout(fetch(url, init), opts.timeout || 12e3, url);
}
async function getText(url, opts = {}) {
  const res = await request(url, opts);
  if (!res.ok && !opts.allowError) throw new Error("HTTP " + res.status + " " + url);
  return res.text();
}
async function getJson(url, opts = {}) {
  const text = await getText(url, opts);
  return JSON.parse(text);
}
async function tryJson(url, opts = {}) {
  try {
    return await getJson(url, opts);
  } catch (e) {
    log("tryJson", url, e && e.message);
    return null;
  }
}
var logPrefix = "[anime]";
function setLogPrefix(p) {
  logPrefix = p;
}
function log(...args) {
  try {
    console.log(logPrefix, ...args);
  } catch (_) {
  }
}
function origin(url) {
  const m = String(url).match(/^(https?:\/\/[^/]+)/i);
  return m ? m[1] : "";
}
function decodeHtml(s) {
  return String(s || "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#x27;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}
async function settle(promises) {
  const out = await Promise.all(promises.map((p) => Promise.resolve(p).catch((e) => {
    log("task failed", e && e.message);
    return null;
  })));
  return out;
}

// src/core/mapping.js
var TMDB = "https://api.themoviedb.org/3";
var FALLBACK_TMDB_KEY = "439c478a771f35c05022f9feabcca01c";
function tmdbKey() {
  try {
    if (typeof globalThis !== "undefined" && globalThis.TMDB_API_KEY) return globalThis.TMDB_API_KEY;
  } catch (_) {
  }
  return FALLBACK_TMDB_KEY;
}
function tmdb(path) {
  const sep = path.includes("?") ? "&" : "?";
  return tryJson(`${TMDB}${path}${sep}api_key=${tmdbKey()}`, { timeout: 8e3 });
}
function dayDiff(a, b) {
  if (!a || !b) return 99;
  const da = Date.parse(String(a).slice(0, 10) + "T00:00:00Z");
  const db = Date.parse(String(b).slice(0, 10) + "T00:00:00Z");
  if (isNaN(da) || isNaN(db)) return 99;
  return Math.abs(da - db) / 864e5;
}
async function aniZip(param, value) {
  return tryJson(`https://api.ani.zip/mappings?${param}=${encodeURIComponent(value)}`, { timeout: 8e3 });
}
async function anilistMedia(id) {
  const query = "query($id:Int){Media(id:$id,type:ANIME){id idMal format episodes seasonYear title{romaji english native} synonyms}}";
  try {
    const res = await getJson("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables: { id: Number(id) } }),
      timeout: 8e3
    });
    return res && res.data && res.data.Media || null;
  } catch (e) {
    log("anilist", e && e.message);
    return null;
  }
}
async function anilistSearch(search2, format) {
  const query = "query($s:String){Page(perPage:8){media(search:$s,type:ANIME){id idMal format episodes seasonYear title{romaji english native} synonyms}}}";
  try {
    const res = await getJson("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables: { s: search2 } }),
      timeout: 8e3
    });
    const list = res && res.data && res.data.Page && res.data.Page.media || [];
    if (format === "movie") {
      const movies = list.filter((m) => m.format === "MOVIE");
      if (movies.length) return movies;
    }
    return list;
  } catch (e) {
    log("anilist search", e && e.message);
    return [];
  }
}
function numericEpisodes(zip) {
  if (!zip || !zip.episodes) return [];
  return Object.keys(zip.episodes).filter((k) => /^\d+$/.test(k)).map((k) => Object.assign({ key: Number(k) }, zip.episodes[k])).sort((a, b) => a.key - b.key);
}
function uniq(list) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const v of list) {
    const s = v && String(v).trim();
    if (s && !seen.has(s.toLowerCase())) {
      seen.add(s.toLowerCase());
      out.push(s);
    }
  }
  return out;
}
async function buildContext(anilistId, malId, episode, zip, extra) {
  const media = await anilistMedia(anilistId);
  const z = zip && zip.titles || {};
  const romaji = media && media.title && media.title.romaji || z["x-jat"] || "";
  const english = media && media.title && media.title.english || z.en || "";
  const titles = uniq([
    romaji,
    english,
    ...media && media.synonyms ? media.synonyms : [],
    z["x-jat"],
    z.en,
    z.es,
    z["es-419"],
    z.it,
    extra.tmdbTitle,
    extra.tmdbOriginal
  ]).filter((t) => !/[぀-ヿ一-鿿가-힯]/.test(t));
  return {
    anilistId: Number(anilistId),
    malId: malId ? Number(malId) : media && media.idMal || null,
    episode: Number(episode) || 1,
    isMovie: !!extra.isMovie,
    format: media && media.format || null,
    year: media && media.seasonYear || extra.year || null,
    romaji,
    english,
    native: media && media.title && media.title.native || z.ja || "",
    titles,
    titleEs: z.es || z["es-419"] || "",
    titleIt: z.it || "",
    display: extra.tmdbTitle || english || romaji,
    season: extra.season,
    tmdbEpisode: extra.tmdbEpisode
  };
}
function parseSpecialId(raw) {
  const s = String(raw || "").trim();
  let m = s.match(/^(kitsu|mal|anilist):(\d+)(?::(\d+))?(?::(\d+))?$/i);
  if (m) {
    const ep = m[4] ? Number(m[4]) : m[3] ? Number(m[3]) : null;
    return { kind: m[1].toLowerCase(), id: m[2], episode: ep };
  }
  return null;
}
async function resolveAnime(rawId, mediaType, season, episode) {
  const isMovie = mediaType === "movie";
  const special = parseSpecialId(rawId);
  if (special) {
    const param = { kitsu: "kitsu_id", mal: "mal_id", anilist: "anilist_id" }[special.kind];
    const zip = await aniZip(param, special.id);
    const al = zip && zip.mappings && zip.mappings.anilist_id;
    if (!al) return null;
    return buildContext(al, zip.mappings.mal_id, isMovie ? 1 : special.episode || episode || 1, zip, {
      isMovie,
      season
    });
  }
  let tmdbId = String(rawId || "").trim();
  if (/^tt\d+$/i.test(tmdbId)) {
    const found = await tmdb(`/find/${tmdbId}?external_source=imdb_id`);
    const hit = found && ((isMovie ? found.movie_results : found.tv_results) || [])[0];
    if (!hit) return null;
    tmdbId = String(hit.id);
  }
  tmdbId = tmdbId.replace(/^tmdb:/, "");
  if (!/^\d+$/.test(tmdbId)) return null;
  const details = await tmdb(`/${isMovie ? "movie" : "tv"}/${tmdbId}`);
  if (!details) return null;
  const tmdbTitle = details.name || details.title || "";
  const tmdbOriginal = details.original_name || details.original_title || "";
  const year = Number(String(details.first_air_date || details.release_date || "").slice(0, 4)) || null;
  const isAnimation = (details.genres || []).some((g) => g.id === 16);
  const isAsian = ["ja", "zh", "ko"].includes(details.original_language);
  if (!isAnimation || !isAsian) {
    log("no parece anime:", tmdbTitle);
    return null;
  }
  const arm = await tryJson(`https://arm.haglund.dev/api/v2/themoviedb?id=${tmdbId}`, { timeout: 8e3 }) || [];
  let candidates = arm.filter((e) => e && e.anilist);
  if (isMovie) {
    let pick = candidates[0];
    if (!pick) {
      const found = await anilistSearch(tmdbOriginal || tmdbTitle, "movie");
      const byYear = found.find((m) => !year || !m.seasonYear || Math.abs(m.seasonYear - year) <= 1) || found[0];
      if (!byYear) return null;
      pick = { anilist: byYear.id, myanimelist: byYear.idMal };
    }
    const zip = await aniZip("anilist_id", pick.anilist);
    return buildContext(pick.anilist, pick.myanimelist, 1, zip, { isMovie, tmdbTitle, tmdbOriginal, year });
  }
  const S = Number(season) || 1;
  const E = Number(episode) || 1;
  let airDate = null;
  let dayIndex = 0;
  const seasonData = await tmdb(`/tv/${tmdbId}/season/${S}`);
  if (seasonData && Array.isArray(seasonData.episodes)) {
    const target = seasonData.episodes.find((e) => e.episode_number === E);
    if (target && target.air_date) {
      airDate = target.air_date;
      dayIndex = seasonData.episodes.filter((e) => e.air_date === airDate && e.episode_number < E).length;
    }
  }
  if (!candidates.length) {
    const found = await anilistSearch(tmdbOriginal || tmdbTitle, "tv");
    candidates = found.slice(0, 4).map((m) => ({ anilist: m.id, myanimelist: m.idMal }));
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => {
    const as = a["thetvdb-season"] === S ? 0 : 1;
    const bs = b["thetvdb-season"] === S ? 0 : 1;
    return as - bs;
  });
  candidates = candidates.slice(0, 6);
  const zips = await Promise.all(candidates.map((c) => aniZip("anilist_id", c.anilist)));
  const extra = { isMovie, tmdbTitle, tmdbOriginal, year, season: S, tmdbEpisode: E };
  if (airDate) {
    for (let i = 0; i < candidates.length; i++) {
      const eps = numericEpisodes(zips[i]);
      const sameDay = eps.filter((e) => dayDiff(e.airDate || e.airdate, airDate) <= 1);
      if (sameDay.length) {
        const hit = sameDay[Math.min(dayIndex, sameDay.length - 1)];
        return buildContext(candidates[i].anilist, candidates[i].myanimelist, hit.key, zips[i], extra);
      }
    }
  }
  for (let i = 0; i < candidates.length; i++) {
    const hit = numericEpisodes(zips[i]).find((e) => e.seasonNumber === S && e.episodeNumber === E);
    if (hit) return buildContext(candidates[i].anilist, candidates[i].myanimelist, hit.key, zips[i], extra);
  }
  for (let i = 0; i < candidates.length; i++) {
    const hit = numericEpisodes(zips[i]).find((e) => e.absoluteEpisodeNumber === E);
    if (hit && S === 1) return buildContext(candidates[i].anilist, candidates[i].myanimelist, hit.key, zips[i], extra);
  }
  const bySeason = candidates.find((c) => c["thetvdb-season"] === S) || candidates[0];
  const idx = candidates.indexOf(bySeason);
  return buildContext(bySeason.anilist, bySeason.myanimelist, E, zips[idx], extra);
}
function norm(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").replace(/\b(the|tv|season|part|cour)\b/g, " ").replace(/\s+/g, " ").trim();
}
function titleScore(siteTitle, ctx) {
  const t = norm(siteTitle);
  if (!t) return 0;
  let best = 0;
  for (const c of ctx.titles) {
    const n = norm(c);
    if (!n) continue;
    if (n === t) return 2;
    if (t.length > 4 && n.length > 4 && (t.startsWith(n) || n.startsWith(t))) {
      const diff = Math.abs(t.length - n.length);
      if (diff <= 3) best = Math.max(best, 1);
    }
  }
  return best;
}

// src/core/streams.js
var FLAGS = { en: "\u{1F1EC}\u{1F1E7}", es: "\u{1F1EA}\u{1F1F8}", it: "\u{1F1EE}\u{1F1F9}" };
var LABEL = { en: "SUB EN", es: "SUB ESP", it: "SUB ITA" };
function makeStream(ctx, opts) {
  const lang = opts.lang;
  const quality = normalizeQuality(opts.quality);
  const ep = ctx.isMovie ? "Pel\xEDcula" : `Ep. ${ctx.episode}`;
  const where = ctx.isMovie || !ctx.season || !ctx.tmdbEpisode ? "" : ` \xB7 T${ctx.season}E${ctx.tmdbEpisode}`;
  const lines = [
    `${ctx.display}${where}`,
    `${FLAGS[lang]} ${LABEL[lang]} \xB7 ${quality} \xB7 ${opts.format === "mp4" ? "MP4" : "HLS"}`,
    `${opts.source}${opts.server ? " \xB7 " + opts.server : ""} \xB7 ${ep}`
  ];
  const headers = Object.assign({ "User-Agent": UA }, opts.headers || {});
  const out = {
    name: `${FLAGS[lang]} ${opts.source}`,
    title: lines.join("\n"),
    url: opts.url,
    quality,
    language: lang,
    type: opts.format === "mp4" ? "mp4" : "m3u8",
    headers,
    provider: opts.providerId
  };
  if (opts.subtitles && opts.subtitles.length) {
    out.subtitles = opts.subtitles.filter((s) => s && s.url).map((s) => ({ url: s.url, language: s.language || s.lang || "Unknown", name: s.name || s.label || s.language || "Sub" }));
  }
  return out;
}
function normalizeQuality(q) {
  const s = String(q || "").toLowerCase();
  if (/2160|4k/.test(s)) return "2160p";
  if (/1080/.test(s)) return "1080p";
  if (/720/.test(s)) return "720p";
  if (/480/.test(s)) return "480p";
  if (/360/.test(s)) return "360p";
  return q ? String(q) : "Auto";
}
function guessFormat(url) {
  return /\.mp4(\?|$)/i.test(url) ? "mp4" : "m3u8";
}
function dedupe(list) {
  const seen = /* @__PURE__ */ new Set();
  return list.filter((s) => {
    if (!s || !s.url || seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });
}

// src/core/provider.js
function defineProvider({ id, run: run2, timeout = 45e3 }) {
  async function getStreams2(tmdbId, mediaType, season, episode) {
    setLogPrefix(`[${id}]`);
    try {
      log("pedido", tmdbId, mediaType, season, episode);
      const ctx = await withTimeout(resolveAnime(tmdbId, mediaType, season, episode), 2e4, "mapping");
      if (!ctx) {
        log("sin mapeo");
        return [];
      }
      log("mapeo", ctx.anilistId, ctx.malId, "ep", ctx.episode, ctx.romaji);
      const streams = await withTimeout(Promise.resolve(run2(ctx)), timeout, "scraper");
      const out = dedupe((streams || []).filter(Boolean));
      log("fuentes", out.length);
      return out;
    } catch (e) {
      log("error", e && e.message);
      return [];
    }
  }
  return getStreams2;
}

// src/core/extractors.js
function unpack(source) {
  const m = source.match(/}\s*\(\s*(['"])([\s\S]*?)\1\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(['"])([\s\S]*?)\5\.split\(\s*['"]\|['"]\s*\)/);
  if (!m) return null;
  let p = m[2].replace(/\\'/g, "'").replace(/\\"/g, '"');
  const a = parseInt(m[3], 10);
  let c = parseInt(m[4], 10);
  const k = m[6].split("|");
  const enc = (n) => (n < a ? "" : enc(Math.floor(n / a))) + ((n = n % a) > 35 ? String.fromCharCode(n + 29) : n.toString(36));
  const dict = {};
  while (c--) dict[enc(c)] = k[c] || enc(c);
  return p.replace(/\b\w+\b/g, (w) => dict[w] !== void 0 ? dict[w] : w);
}
function firstMedia(text) {
  const m3u8 = text.match(/https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*/);
  if (m3u8) return m3u8[0];
  const mp4 = text.match(/https?:\/\/[^"'\s\\]+\.mp4[^"'\s\\]*/);
  return mp4 ? mp4[0] : null;
}
async function yourUpload(url, referer) {
  const html = await getText(url, { headers: { Referer: referer || "https://www.yourupload.com/" } });
  const m = html.match(/og:video"\s+content="([^"]+)"/) || html.match(/file:\s*'([^']+\.mp4[^']*)'/);
  if (!m || !/^https?:\/\//.test(m[1]) || /novideo/i.test(m[1])) return null;
  return { url: m[1], headers: { Referer: "https://www.yourupload.com/" }, quality: "HD" };
}
async function mp4Upload(url) {
  const html = await getText(url, { headers: { Referer: "https://www.mp4upload.com/" } });
  const m = html.match(/src:\s*"(https?:\/\/[^"]+\.mp4[^"]*)"/);
  if (!m) return null;
  return { url: m[1], headers: { Referer: "https://www.mp4upload.com/" }, quality: "HD" };
}
async function zilla(url) {
  const id = (url.match(/\/play\/([a-f0-9]{32})/) || [])[1];
  if (!id) return null;
  return {
    url: `https://player.zilla-networks.com/m3u8/${id}`,
    headers: { Referer: "https://player.zilla-networks.com/" },
    quality: "1080p",
    format: "m3u8"
  };
}
async function packedPlayer(url, referer) {
  const html = await getText(url, { headers: { Referer: referer || origin(url) + "/" } });
  let text = html;
  const i = html.indexOf("eval(function(p,a,c,k,e,d)");
  if (i >= 0) {
    const unpacked = unpack(html.slice(i));
    if (unpacked) text = unpacked;
  }
  const links = text.match(/https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*/g) || [];
  let media = links.find((l) => /master|index/.test(l)) || links[0];
  if (!media) {
    const rel = text.match(/["'](\/[^"']+\.m3u8[^"']*)["']/);
    if (rel) media = origin(url) + rel[1];
  }
  if (!media) media = firstMedia(text);
  if (!media) return null;
  return { url: media, headers: { Referer: origin(url) + "/", Origin: origin(url) }, quality: "HD", format: "m3u8" };
}
var HOSTS = [
  { re: /yourupload\.com/i, name: "YourUpload", fn: yourUpload },
  { re: /mp4upload\.com/i, name: "MP4Upload", fn: mp4Upload },
  { re: /zilla-networks\.com/i, name: "HLS", fn: zilla },
  {
    re: /(vidhide|ryderjet|callistanise|filelions|streamwish|swdyu|wishembed|strwish|playerwish|dhcplay|hlswish|mivalyo|dinisglows|vidhidepro|vidhidevip|cdnwish)/i,
    name: "VidHide",
    fn: packedPlayer
  }
];
function hostRank(url) {
  const order = ["HLS", "YourUpload", "MP4Upload", "VidHide"];
  const name = hostName(url);
  const i = order.indexOf(name);
  return i < 0 ? 99 : i;
}
function hostName(url) {
  const h = HOSTS.find((x) => x.re.test(url));
  return h ? h.name : null;
}
function isSupported(url) {
  return !!hostName(url);
}
async function extract(url, referer) {
  const h = HOSTS.find((x) => x.re.test(url));
  if (!h) return null;
  try {
    const res = await h.fn(url, referer);
    if (res) res.server = h.name;
    return res;
  } catch (e) {
    log("extractor", h.name, e && e.message);
    return null;
  }
}

// src/providers/tioanime.js
var BASE = "https://tioanime.com";
async function search(q) {
  const html = await getText(`${BASE}/directorio?q=${encodeURIComponent(q)}`);
  const out = [];
  const re = /<a href="\/anime\/([^"]+)">[\s\S]*?<h3 class="title">([^<]+)<\/h3>/g;
  let m;
  while (m = re.exec(html)) out.push({ slug: m[1], title: decodeHtml(m[2]).trim() });
  return out;
}
async function findSlug(ctx) {
  for (const q of [ctx.romaji, ctx.english].filter(Boolean)) {
    const results = await search(q).catch(() => []);
    const ranked = results.map((r) => ({ ...r, score: titleScore(r.title, ctx) })).sort((a, b) => b.score - a.score);
    if (ranked[0] && ranked[0].score === 2) return ranked[0].slug;
    if (ranked.length === 1 && ranked[0].score === 1) return ranked[0].slug;
  }
  return null;
}
async function run(ctx) {
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
  const servers = videos.map((v) => ({ server: v[0], url: v[1] })).filter((s) => isSupported(s.url)).sort((a, b) => hostRank(a.url) - hostRank(b.url));
  const results = await settle(
    servers.map(async (s) => {
      const r = await extract(s.url, `${BASE}/`);
      if (!r) return null;
      return makeStream(ctx, {
        lang: "es",
        source: "TioAnime",
        server: s.server,
        providerId: "tioanime",
        url: r.url,
        quality: r.quality,
        format: r.format || guessFormat(r.url),
        headers: r.headers
      });
    })
  );
  return results.filter(Boolean);
}
var getStreams = defineProvider({ id: "tioanime", run });
