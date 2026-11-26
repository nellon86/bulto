// Generado desde src/ con tools/build.mjs. No editar a mano.

var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/providers/megaplay.js
var megaplay_exports = {};
__export(megaplay_exports, {
  getStreams: () => getStreams
});
module.exports = __toCommonJS(megaplay_exports);
var import_crypto_js = __toESM(require("crypto-js"), 1);

// src/core/http.js
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
var HAS_TIMERS = typeof setTimeout === "function";
function withTimeout(promise, ms, label) {
  if (!HAS_TIMERS) return Promise.resolve(promise);
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout " + (label || ""))), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
var deadline = 0;
var budgetStart = 0;
var requestCount = 0;
var deadHosts = /* @__PURE__ */ new Set();
function startBudget(ms) {
  budgetStart = Date.now();
  deadline = HAS_TIMERS ? 0 : budgetStart + ms;
  requestCount = 0;
  deadHosts.clear();
}
function requestsSoFar() {
  return requestCount;
}
async function request(url, opts = {}) {
  const host = origin(url);
  if (!HAS_TIMERS) {
    if (deadline && Date.now() > deadline) throw new Error("sin tiempo " + host);
    if (deadHosts.has(host)) throw new Error("no conecta " + host);
  }
  requestCount++;
  const headers = Object.assign({ "User-Agent": UA }, opts.headers || {});
  const init = { method: opts.method || "GET", headers };
  if (opts.body !== void 0) init.body = opts.body;
  if (opts.redirect) init.redirect = opts.redirect;
  const res = await withTimeout(fetch(url, init), opts.timeout || 8e3, url);
  if (!HAS_TIMERS && res && res.status === 0) deadHosts.add(host);
  return res;
}
async function getText(url, opts = {}) {
  const res = await request(url, opts);
  if (!res.ok && !opts.allowError) throw new Error("HTTP " + res.status + (res.statusText ? " " + res.statusText : "") + " " + url);
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
var captureBuf = null;
function startCapture() {
  captureBuf = [];
}
function stopCapture() {
  const b = captureBuf || [];
  captureBuf = null;
  return b;
}
function log(...args) {
  if (captureBuf) captureBuf.push(args.map((a) => String(a)).join(" "));
  try {
    console.log(logPrefix, ...args);
  } catch (_) {
  }
}
function origin(url) {
  const m = String(url).match(/^(https?:\/\/[^/]+)/i);
  return m ? m[1] : "";
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
  return tryJson(`${TMDB}${path}${sep}api_key=${tmdbKey()}`, { timeout: 6e3 });
}
function dayDiff(a, b) {
  if (!a || !b) return 99;
  const da = Date.parse(String(a).slice(0, 10) + "T00:00:00Z");
  const db = Date.parse(String(b).slice(0, 10) + "T00:00:00Z");
  if (isNaN(da) || isNaN(db)) return 99;
  return Math.abs(da - db) / 864e5;
}
async function aniZip(param, value) {
  return tryJson(`https://api.ani.zip/mappings?${param}=${encodeURIComponent(value)}`, { timeout: 6e3 });
}
async function anilistBatch(ids) {
  const list = (ids || []).map(Number).filter(Boolean);
  if (!list.length) return {};
  const query = "query($ids:[Int]){Page(perPage:25){media(id_in:$ids,type:ANIME){id idMal format episodes seasonYear title{romaji english native} synonyms}}}";
  try {
    const res = await getJson("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables: { ids: list } }),
      timeout: 6e3
    });
    const out = {};
    for (const m of res && res.data && res.data.Page && res.data.Page.media || []) out[m.id] = m;
    return out;
  } catch (e) {
    log("anilist", e && e.message);
    return {};
  }
}
async function anilistSearch(search, format) {
  const query = "query($s:String){Page(perPage:8){media(search:$s,type:ANIME){id idMal format episodes seasonYear title{romaji english native} synonyms}}}";
  try {
    const res = await getJson("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables: { s: search } }),
      timeout: 6e3
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
function absoluteOf(zip, episode) {
  const e = zip && zip.episodes && zip.episodes[String(episode)];
  const abs = e && Number(e.absoluteEpisodeNumber);
  return abs > 0 ? abs : Number(episode) || 1;
}
function buildContext(anilistId, malId, episode, zip, extra, mediaMap) {
  const media = mediaMap && mediaMap[anilistId] || null;
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
    malId: malId ? Number(malId) : media && media.idMal || zip && zip.mappings && zip.mappings.mal_id || null,
    episode: Number(episode) || 1,
    absoluteEpisode: absoluteOf(zip, episode),
    isMovie: !!extra.isMovie,
    format: media && media.format || null,
    episodeCount: media && media.episodes || null,
    synonyms: media && media.synonyms || [],
    year: media && media.seasonYear || extra.year || null,
    romaji,
    english,
    native: media && media.title && media.title.native || z.ja || "",
    titles,
    titleEs: z.es || z["es-419"] || "",
    titleEsLat: z["es-419"] || "",
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
async function resolveAnime(rawId, mediaType, season, episode, opts = {}) {
  const wantTitles = opts.titles !== false;
  const isMovie = mediaType === "movie";
  const special = parseSpecialId(rawId);
  if (special) {
    const param = { kitsu: "kitsu_id", mal: "mal_id", anilist: "anilist_id" }[special.kind];
    const zip = await aniZip(param, special.id);
    const al = zip && zip.mappings && zip.mappings.anilist_id;
    if (!al) return null;
    const media2 = wantTitles ? await anilistBatch([al]) : {};
    return buildContext(al, zip.mappings.mal_id, isMovie ? 1 : special.episode || episode || 1, zip, { isMovie, season }, media2);
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
  const S = Number(season) || 1;
  const E = Number(episode) || 1;
  const fast = !HAS_TIMERS;
  const armReq = () => tryJson(`https://arm.haglund.dev/api/v2/themoviedb?id=${tmdbId}`, { timeout: 6e3 });
  const [details, seasonData, armFirst] = await Promise.all([
    tmdb(`/${isMovie ? "movie" : "tv"}/${tmdbId}`),
    isMovie ? Promise.resolve(null) : tmdb(`/tv/${tmdbId}/season/${S}`),
    fast ? Promise.resolve(void 0) : armReq()
  ]);
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
  if (fast) {
    const zipHit = await aniZip("themoviedb_id", tmdbId);
    const zm = zipHit && zipHit.mappings;
    if (zm && zm.anilist_id) {
      let ep = null;
      if (isMovie) ep = 1;
      else {
        const target = seasonData && Array.isArray(seasonData.episodes) && seasonData.episodes.find((e) => e.episode_number === E);
        if (target && target.air_date) {
          const idx = seasonData.episodes.filter((e) => e.air_date === target.air_date && e.episode_number < E).length;
          const sameDay = numericEpisodes(zipHit).filter((e) => dayDiff(e.airDate || e.airdate, target.air_date) <= 1);
          if (sameDay.length) ep = sameDay[Math.min(idx, sameDay.length - 1)].key;
        }
      }
      if (ep !== null) {
        log("camino corto ani.zip");
        const media2 = wantTitles ? await anilistBatch([zm.anilist_id]) : {};
        const extra2 = { isMovie, tmdbTitle, tmdbOriginal, year, season: S, tmdbEpisode: isMovie ? void 0 : E };
        return buildContext(zm.anilist_id, zm.mal_id, ep, zipHit, extra2, media2);
      }
    }
  }
  const armRaw = armFirst === void 0 ? await armReq() : armFirst;
  let candidates = (armRaw || []).filter((e) => e && e.anilist);
  if (isMovie) {
    let pick = candidates[0];
    let found = [];
    if (!pick) {
      const zipHit = await aniZip("themoviedb_id", tmdbId);
      const zm = zipHit && zipHit.mappings;
      if (zm && zm.anilist_id) pick = { anilist: zm.anilist_id, myanimelist: zm.mal_id };
    }
    if (!pick) {
      found = await anilistSearch(tmdbOriginal || tmdbTitle, "movie");
      if (!found.length && tmdbTitle !== tmdbOriginal) found = await anilistSearch(tmdbTitle, "movie");
      const byYear = found.find((m) => !year || !m.seasonYear || Math.abs(m.seasonYear - year) <= 1) || found[0];
      if (!byYear) return null;
      pick = { anilist: byYear.id, myanimelist: byYear.idMal };
    }
    const [zip, media2] = await Promise.all([
      aniZip("anilist_id", pick.anilist),
      wantTitles ? anilistBatch([pick.anilist]) : Promise.resolve({})
    ]);
    return buildContext(pick.anilist, pick.myanimelist, 1, zip, { isMovie, tmdbTitle, tmdbOriginal, year }, media2);
  }
  let airDate = null;
  let dayIndex = 0;
  if (seasonData && Array.isArray(seasonData.episodes)) {
    const target = seasonData.episodes.find((e) => e.episode_number === E);
    if (target && target.air_date) {
      airDate = target.air_date;
      dayIndex = seasonData.episodes.filter((e) => e.air_date === airDate && e.episode_number < E).length;
    }
  }
  if (!candidates.length) {
    const [zipHit, byOriginal, byTitle] = await Promise.all([
      aniZip("themoviedb_id", tmdbId),
      anilistSearch(tmdbOriginal || tmdbTitle, "tv"),
      tmdbTitle && tmdbTitle !== tmdbOriginal ? anilistSearch(tmdbTitle, "tv") : Promise.resolve([])
    ]);
    const seen = /* @__PURE__ */ new Set();
    const zm = zipHit && zipHit.mappings;
    const list = [];
    if (zm && zm.anilist_id) list.push({ anilist: zm.anilist_id, myanimelist: zm.mal_id });
    for (const m of [...byOriginal.slice(0, 3), ...byTitle.slice(0, 3)]) list.push({ anilist: m.id, myanimelist: m.idMal });
    candidates = list.filter((c) => c.anilist && !seen.has(c.anilist) && seen.add(c.anilist));
    log("sin ARM:", candidates.map((c) => c.anilist).join(",") || "ninguno");
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => (a["thetvdb-season"] === S ? 0 : 1) - (b["thetvdb-season"] === S ? 0 : 1));
  candidates = candidates.slice(0, 6);
  const [zips, media] = await Promise.all([
    Promise.all(candidates.map((c) => aniZip("anilist_id", c.anilist))),
    wantTitles ? anilistBatch(candidates.map((c) => c.anilist)) : Promise.resolve({})
  ]);
  const extra = { isMovie, tmdbTitle, tmdbOriginal, year, season: S, tmdbEpisode: E };
  const ctx = (i, ep) => buildContext(candidates[i].anilist, candidates[i].myanimelist, ep, zips[i], extra, media);
  if (airDate) {
    for (let i = 0; i < candidates.length; i++) {
      const sameDay = numericEpisodes(zips[i]).filter((e) => dayDiff(e.airDate || e.airdate, airDate) <= 1);
      if (sameDay.length) return ctx(i, sameDay[Math.min(dayIndex, sameDay.length - 1)].key);
    }
  }
  for (let i = 0; i < candidates.length; i++) {
    const hit = numericEpisodes(zips[i]).find((e) => e.seasonNumber === S && e.episodeNumber === E);
    if (hit) return ctx(i, hit.key);
  }
  if (S === 1) {
    for (let i = 0; i < candidates.length; i++) {
      const hit = numericEpisodes(zips[i]).find((e) => e.absoluteEpisodeNumber === E);
      if (hit) return ctx(i, hit.key);
    }
  }
  const bySeason = candidates.find((c) => c["thetvdb-season"] === S) || candidates[0];
  return ctx(candidates.indexOf(bySeason), E);
}

// src/core/streams.js
var FLAGS = { en: "\u{1F1EC}\u{1F1E7}", es: "\u{1F1EA}\u{1F1F8}", it: "\u{1F1EE}\u{1F1F9}", "es-cast": "\u{1F1EA}\u{1F1F8}", "es-lat": "\u{1F1F2}\u{1F1FD}", "it-dub": "\u{1F1EE}\u{1F1F9}" };
var LABEL = {
  en: "SUB EN",
  es: "SUB ESP",
  it: "SUB ITA",
  "es-cast": "DOBLAJE CASTELLANO",
  "es-lat": "DOBLAJE LATINO",
  "it-dub": "DOPPIAGGIO ITA"
};
var LANG_CODE = { en: "en", es: "es", it: "it", "es-cast": "es", "es-lat": "es", "it-dub": "it" };
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
    // Nuvio ordena las fuentes de un scraper por nombre: el servidor va en el
    // nombre para que el orden sea alfabético por servidor (Zilla queda al final).
    name: `${FLAGS[lang]} ${opts.source}${opts.server ? " \xB7 " + opts.server : ""}`,
    title: lines.join("\n"),
    url: opts.url,
    quality,
    language: LANG_CODE[lang] || lang,
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
function dedupe(list) {
  const seen = /* @__PURE__ */ new Set();
  return list.filter((s) => {
    if (!s || !s.url || seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });
}
async function pickBestVariant(stream, fetchText) {
  if (!stream || stream.type !== "m3u8") return stream;
  if (/_n\/master\.m3u8|_,n,\.urlset/.test(stream.url)) return stream;
  let text;
  try {
    text = await fetchText(stream.url, stream.headers);
  } catch (_) {
    return stream;
  }
  if (!text || !/#EXT-X-STREAM-INF/i.test(text)) return stream;
  if (/#EXT-X-MEDIA:[^\n]*TYPE=(AUDIO|SUBTITLES)[^\n]*URI=/i.test(text)) return stream;
  const lines = text.split(/\r?\n/);
  let best = null;
  for (let i = 0; i < lines.length; i++) {
    if (!/^#EXT-X-STREAM-INF/i.test(lines[i])) continue;
    let uri = "";
    for (let j = i + 1; j < lines.length; j++) {
      const l = lines[j].trim();
      if (l && !l.startsWith("#")) {
        uri = l;
        break;
      }
    }
    if (!uri) continue;
    const h = Number((lines[i].match(/RESOLUTION=\d+x(\d+)/i) || [])[1] || 0);
    const bw = Number((lines[i].match(/[^-]BANDWIDTH=(\d+)/i) || [])[1] || 0);
    if (!best || h > best.h || h === best.h && bw > best.bw) best = { h, bw, uri };
  }
  if (!best) return stream;
  const url = resolveUrl(stream.url, best.uri);
  const quality = best.h ? normalizeQuality(`${best.h}p`) : stream.quality;
  const title = stream.title && stream.quality ? stream.title.replace(` \xB7 ${stream.quality} \xB7 `, ` \xB7 ${quality} \xB7 `) : stream.title;
  return Object.assign({}, stream, { url, quality, title });
}
function resolveUrl(base, uri) {
  if (/^https?:\/\//i.test(uri)) return uri;
  if (uri.startsWith("//")) return base.split(":")[0] + ":" + uri;
  const origin2 = (base.match(/^https?:\/\/[^/]+/i) || [""])[0];
  if (uri.startsWith("/")) return origin2 + uri;
  const dir = base.split("?")[0].replace(/[^/]*$/, "");
  const parts = (dir.slice(origin2.length) + uri).split("/");
  const out = [];
  for (const p of parts) {
    if (p === "..") out.pop();
    else if (p !== ".") out.push(p);
  }
  return origin2 + out.join("/").replace(/^\/?/, "/");
}

// src/core/provider.js
function defineProvider({ id, run: run2, timeout = 25e3, titles = true }) {
  async function diagnose() {
    startCapture();
    const t0 = Date.now();
    let out = [];
    try {
      out = await getStreamsReal("303272", "tv", 1, 7);
    } catch (e) {
      log("excepci\xF3n", e && e.message);
    }
    const lines = stopCapture().map((l) => l.replace(`[${id}] `, ""));
    const pick = (re) => lines.filter((l) => re.test(l));
    const rows = [
      `1 ${HAS_TIMERS ? "timers" : "sin timers"} \xB7 ${pick(/^mapeo|^sin mapeo|^camino corto/).join(" ") || "sin l\xEDnea de mapeo"}`,
      `2 ${pick(/candidatos|servidores|ficha/).join(" | ") || "sin b\xFAsqueda"}`,
      `3 fuentes ${out.length} en ${Date.now() - t0} ms (${requestsSoFar()} peticiones) \xB7 ${pick(/error|failed|falla|tryText|tryJson|extractor|excepción|HTTP|timeout/).slice(0, 4).join(" | ") || "sin errores"}`
    ];
    return rows.map((t, i) => ({
      name: `Diagn\xF3stico ${i + 1}`,
      title: t.slice(0, 400),
      url: `https://example.com/diagnostico/${id}/${i + 1}`,
      quality: i === 2 ? `${out.length} fuentes` : "diag",
      type: "mp4"
    }));
  }
  async function getStreams2(tmdbId, mediaType, season, episode) {
    if (String(tmdbId) === "603" && mediaType === "movie") return diagnose();
    return getStreamsReal(tmdbId, mediaType, season, episode);
  }
  async function getStreamsReal(tmdbId, mediaType, season, episode) {
    setLogPrefix(`[${id}]`);
    startBudget(25e3);
    const t0 = Date.now();
    try {
      log("pedido", tmdbId, mediaType, season, episode);
      const ctx = await withTimeout(resolveAnime(tmdbId, mediaType, season, episode, { titles }), 15e3, "mapping");
      const tMap = Date.now() - t0;
      if (!ctx) {
        log(`sin mapeo (${tMap} ms, ${requestsSoFar()} peticiones)`);
        return [];
      }
      log(`mapeo ${ctx.anilistId}/${ctx.malId} ep ${ctx.episode} ${ctx.romaji || ""} (${tMap} ms, ${requestsSoFar()} peticiones)`);
      const streams = await withTimeout(Promise.resolve(run2(ctx)), timeout, "scraper");
      const best = await Promise.all(
        (streams || []).filter(Boolean).map(
          (st) => pickBestVariant(st, (u, h) => getText(u, { headers: h, timeout: 4e3 })).catch(() => st)
        )
      );
      const out = dedupe(best);
      log(`fuentes ${out.length} en ${Date.now() - t0} ms (scraper ${Date.now() - t0 - tMap} ms)`);
      return out;
    } catch (e) {
      log(`error ${e && e.message} (${Date.now() - t0} ms)`);
      return [];
    }
  }
  return getStreams2;
}

// src/providers/megaplay.js
var BASES = ["https://megaplay.buzz"];
var KEY = "i?LMTAx0Q6,:}50U";
var IV = "W0;27ToaUpl_P%'c";
function decrypt(enc) {
  const keyHex = import_crypto_js.default.enc.Utf8.parse(KEY).toString(import_crypto_js.default.enc.Hex).padEnd(64, "0");
  let b64 = enc.replace(/-/g, "+").replace(/_/g, "/");
  b64 += "=".repeat((4 - b64.length % 4) % 4);
  const out = import_crypto_js.default.AES.decrypt(b64, import_crypto_js.default.enc.Hex.parse(keyHex), {
    iv: import_crypto_js.default.enc.Utf8.parse(IV),
    mode: import_crypto_js.default.mode.CBC,
    padding: import_crypto_js.default.pad.Pkcs7
  }).toString(import_crypto_js.default.enc.Utf8);
  return JSON.parse(out);
}
async function sources(base, pageUrl, id) {
  const json = await getJson(`${base}/stream/getSources?id=${id}&id=${id}`, {
    headers: { "X-Requested-With": "XMLHttpRequest", Referer: pageUrl }
  });
  let file = json && json.sources && json.sources.file;
  if (!file && json && json.enc) {
    const dec = decrypt(json.enc);
    file = dec && dec.file;
  }
  if (!file) return null;
  const subs = (json.tracks || []).filter((t) => t.file && (t.kind === "captions" || t.kind === "subtitles")).map((t) => ({ url: t.file, name: t.label || "English", language: (t.label || "eng").slice(0, 3).toLowerCase() }));
  return { file, subs };
}
async function run(ctx) {
  const ids = [`ani/${ctx.anilistId}`];
  if (ctx.malId) ids.push(`mal/${ctx.malId}`);
  for (const id of ids) {
    const pageUrl = `${BASES[0]}/stream/${id}/${ctx.episode}/sub`;
    let html;
    try {
      html = await getText(pageUrl, { headers: { Referer: `${BASES[0]}/` } });
    } catch (e) {
      log("p\xE1gina", e.message);
      continue;
    }
    const dataId = (html.match(/id="megaplay-player"[\s\S]*?data-id="(\d+)"/) || [])[1];
    if (!dataId) continue;
    const out = [];
    const main = await sources(BASES[0], pageUrl, dataId).catch((e) => log("getSources", e.message));
    if (main) {
      out.push(
        makeStream(ctx, {
          lang: "en",
          source: "MegaPlay",
          providerId: "megaplay",
          url: main.file,
          quality: "1080p",
          format: "m3u8",
          headers: { Referer: `${BASES[0]}/`, Origin: BASES[0] },
          subtitles: main.subs
        })
      );
    }
    if (out.length) return out;
  }
  return [];
}
var getStreams = defineProvider({ id: "megaplay", run, titles: false });
