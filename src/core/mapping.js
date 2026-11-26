// Convierte lo que envía Nuvio (TMDB + temporada + episodio) en la entrada
// concreta de AniList/MAL y el número de episodio dentro de esa entrada.
//
// Fuentes: TMDB (fechas de emisión), ARM (TMDB -> AniList/MAL) y ani.zip
// (episodios de cada entrada de AniList con su fecha y numeración TVDB).
// No usa Jikan: desde algunas redes no conecta y retrasa todo.

import { getJson, tryJson, log, HAS_TIMERS } from "./http.js";

const TMDB = "https://api.themoviedb.org/3";
const FALLBACK_TMDB_KEY = "439c478a771f35c05022f9feabcca01c";

function tmdbKey() {
  try {
    if (typeof globalThis !== "undefined" && globalThis.TMDB_API_KEY) return globalThis.TMDB_API_KEY;
  } catch (_) {}
  return FALLBACK_TMDB_KEY;
}

function tmdb(path) {
  const sep = path.includes("?") ? "&" : "?";
  return tryJson(`${TMDB}${path}${sep}api_key=${tmdbKey()}`, { timeout: 6000 });
}

function dayDiff(a, b) {
  if (!a || !b) return 99;
  const da = Date.parse(String(a).slice(0, 10) + "T00:00:00Z");
  const db = Date.parse(String(b).slice(0, 10) + "T00:00:00Z");
  if (isNaN(da) || isNaN(db)) return 99;
  return Math.abs(da - db) / 86400000;
}

async function aniZip(param, value) {
  return tryJson(`https://api.ani.zip/mappings?${param}=${encodeURIComponent(value)}`, { timeout: 6000 });
}

// Datos de AniList de varias entradas en una sola consulta.
async function anilistBatch(ids) {
  const list = (ids || []).map(Number).filter(Boolean);
  if (!list.length) return {};
  const query =
    "query($ids:[Int]){Page(perPage:25){media(id_in:$ids,type:ANIME){id idMal format episodes seasonYear title{romaji english native} synonyms}}}";
  try {
    const res = await getJson("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables: { ids: list } }),
      timeout: 6000,
    });
    const out = {};
    for (const m of (res && res.data && res.data.Page && res.data.Page.media) || []) out[m.id] = m;
    return out;
  } catch (e) {
    log("anilist", e && e.message);
    return {};
  }
}

async function anilistSearch(search, format) {
  const query =
    "query($s:String){Page(perPage:8){media(search:$s,type:ANIME){id idMal format episodes seasonYear title{romaji english native} synonyms}}}";
  try {
    const res = await getJson("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables: { s: search } }),
      timeout: 6000,
    });
    const list = (res && res.data && res.data.Page && res.data.Page.media) || [];
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
  return Object.keys(zip.episodes)
    .filter((k) => /^\d+$/.test(k))
    .map((k) => Object.assign({ key: Number(k) }, zip.episodes[k]))
    .sort((a, b) => a.key - b.key);
}

function uniq(list) {
  const seen = new Set();
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

// Número absoluto del episodio (contando las temporadas anteriores), según ani.zip.
function absoluteOf(zip, episode) {
  const e = zip && zip.episodes && zip.episodes[String(episode)];
  const abs = e && Number(e.absoluteEpisodeNumber);
  return abs > 0 ? abs : Number(episode) || 1;
}

// Contexto final que reciben los scrapers.
function buildContext(anilistId, malId, episode, zip, extra, mediaMap) {
  const media = (mediaMap && mediaMap[anilistId]) || null;
  const z = (zip && zip.titles) || {};
  const romaji = (media && media.title && media.title.romaji) || z["x-jat"] || "";
  const english = (media && media.title && media.title.english) || z.en || "";
  const titles = uniq([
    romaji,
    english,
    ...(media && media.synonyms ? media.synonyms : []),
    z["x-jat"],
    z.en,
    z.es,
    z["es-419"],
    z.it,
    extra.tmdbTitle,
    extra.tmdbOriginal,
  ]).filter((t) => !/[぀-ヿ一-鿿가-힯]/.test(t));
  return {
    anilistId: Number(anilistId),
    malId: malId ? Number(malId) : (media && media.idMal) || (zip && zip.mappings && zip.mappings.mal_id) || null,
    episode: Number(episode) || 1,
    absoluteEpisode: absoluteOf(zip, episode),
    isMovie: !!extra.isMovie,
    format: (media && media.format) || null,
    episodeCount: (media && media.episodes) || null,
    synonyms: (media && media.synonyms) || [],
    year: (media && media.seasonYear) || extra.year || null,
    romaji,
    english,
    native: (media && media.title && media.title.native) || z.ja || "",
    titles,
    titleEs: z.es || z["es-419"] || "",
    titleEsLat: z["es-419"] || "",
    titleIt: z.it || "",
    display: extra.tmdbTitle || english || romaji,
    season: extra.season,
    tmdbEpisode: extra.tmdbEpisode,
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

// opts.titles = false: el scraper solo necesita los IDs (se ahorra AniList).
export async function resolveAnime(rawId, mediaType, season, episode, opts = {}) {
  const wantTitles = opts.titles !== false;
  const isMovie = mediaType === "movie";
  const special = parseSpecialId(rawId);
  if (special) {
    const param = { kitsu: "kitsu_id", mal: "mal_id", anilist: "anilist_id" }[special.kind];
    const zip = await aniZip(param, special.id);
    const al = zip && zip.mappings && zip.mappings.anilist_id;
    if (!al) return null;
    const media = wantTitles ? await anilistBatch([al]) : {};
    return buildContext(al, zip.mappings.mal_id, isMovie ? 1 : special.episode || episode || 1, zip, { isMovie, season }, media);
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

  // En la tele (sin temporizadores) las peticiones van en fila: primero se
  // prueba un camino corto con ani.zip por ID de TMDB, y ARM solo si hace falta.
  const fast = !HAS_TIMERS;
  const armReq = () => tryJson(`https://arm.haglund.dev/api/v2/themoviedb?id=${tmdbId}`, { timeout: 6000 });

  // Primera ronda en paralelo: ficha de TMDB, temporada de TMDB y mapeo de ARM.
  const [details, seasonData, armFirst] = await Promise.all([
    tmdb(`/${isMovie ? "movie" : "tv"}/${tmdbId}`),
    isMovie ? Promise.resolve(null) : tmdb(`/tv/${tmdbId}/season/${S}`),
    fast ? Promise.resolve(undefined) : armReq(),
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

  // Camino corto (tele): una sola entrada de ani.zip por ID de TMDB. Vale si es
  // película o si un episodio suyo se emitió el mismo día que el pedido.
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
        const media = wantTitles ? await anilistBatch([zm.anilist_id]) : {};
        const extra = { isMovie, tmdbTitle, tmdbOriginal, year, season: S, tmdbEpisode: isMovie ? undefined : E };
        return buildContext(zm.anilist_id, zm.mal_id, ep, zipHit, extra, media);
      }
    }
  }
  const armRaw = armFirst === undefined ? await armReq() : armFirst;
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
    const [zip, media] = await Promise.all([
      aniZip("anilist_id", pick.anilist),
      wantTitles ? anilistBatch([pick.anilist]) : Promise.resolve({}),
    ]);
    return buildContext(pick.anilist, pick.myanimelist, 1, zip, { isMovie, tmdbTitle, tmdbOriginal, year }, media);
  }

  // Fecha de emisión del episodio en TMDB y su posición entre los del mismo día.
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
    // Sin ARM (no responde o, en algunos aparatos como la Fire TV, falla la
    // conexión segura): ani.zip por ID de TMDB y búsqueda en AniList por el
    // título original y el de TMDB. El cruce por fechas elige luego la entrada.
    const [zipHit, byOriginal, byTitle] = await Promise.all([
      aniZip("themoviedb_id", tmdbId),
      anilistSearch(tmdbOriginal || tmdbTitle, "tv"),
      tmdbTitle && tmdbTitle !== tmdbOriginal ? anilistSearch(tmdbTitle, "tv") : Promise.resolve([]),
    ]);
    const seen = new Set();
    const zm = zipHit && zipHit.mappings;
    const list = [];
    if (zm && zm.anilist_id) list.push({ anilist: zm.anilist_id, myanimelist: zm.mal_id });
    for (const m of [...byOriginal.slice(0, 3), ...byTitle.slice(0, 3)]) list.push({ anilist: m.id, myanimelist: m.idMal });
    candidates = list.filter((c) => c.anilist && !seen.has(c.anilist) && seen.add(c.anilist));
    log("sin ARM:", candidates.map((c) => c.anilist).join(",") || "ninguno");
  }
  if (!candidates.length) return null;

  // Primero las entradas cuya temporada TVDB coincide con la pedida.
  candidates.sort((a, b) => (a["thetvdb-season"] === S ? 0 : 1) - (b["thetvdb-season"] === S ? 0 : 1));
  candidates = candidates.slice(0, 6);

  // Segunda ronda en paralelo: episodios de cada entrada (ani.zip) y títulos (AniList).
  const [zips, media] = await Promise.all([
    Promise.all(candidates.map((c) => aniZip("anilist_id", c.anilist))),
    wantTitles ? anilistBatch(candidates.map((c) => c.anilist)) : Promise.resolve({}),
  ]);

  const extra = { isMovie, tmdbTitle, tmdbOriginal, year, season: S, tmdbEpisode: E };
  const ctx = (i, ep) => buildContext(candidates[i].anilist, candidates[i].myanimelist, ep, zips[i], extra, media);

  // 1) Coincidencia por fecha de emisión.
  if (airDate) {
    for (let i = 0; i < candidates.length; i++) {
      const sameDay = numericEpisodes(zips[i]).filter((e) => dayDiff(e.airDate || e.airdate, airDate) <= 1);
      if (sameDay.length) return ctx(i, sameDay[Math.min(dayIndex, sameDay.length - 1)].key);
    }
  }
  // 2) Coincidencia por temporada y episodio TVDB.
  for (let i = 0; i < candidates.length; i++) {
    const hit = numericEpisodes(zips[i]).find((e) => e.seasonNumber === S && e.episodeNumber === E);
    if (hit) return ctx(i, hit.key);
  }
  // 3) Numeración absoluta (series largas con una sola entrada).
  if (S === 1) {
    for (let i = 0; i < candidates.length; i++) {
      const hit = numericEpisodes(zips[i]).find((e) => e.absoluteEpisodeNumber === E);
      if (hit) return ctx(i, hit.key);
    }
  }
  // 4) Último recurso: la entrada de esa temporada con el mismo número.
  const bySeason = candidates.find((c) => c["thetvdb-season"] === S) || candidates[0];
  return ctx(candidates.indexOf(bySeason), E);
}

// Normaliza un título para comparar.
export function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/×/g, " x ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|tv|season|part|cour)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ¿El título del sitio corresponde a alguno de los nuestros? 2 = exacto, 1 = parecido.
export function titleScore(siteTitle, ctx) {
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

// Texto de búsqueda sin signos: muchos buscadores fallan con "×", ":" o ".".
export function cleanQuery(q) {
  return String(q || "")
    .replace(/×/g, " x ")
    .replace(/['’]/g, "")
    // Sin \p{L}: el motor de Nuvio TV puede no admitir esas clases Unicode.
    .replace(/[^0-9A-Za-z\u00C0-\u024F]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Consultas para buscar por título (romaji e inglés, limpias y sin repetir),
// más el título sin "Season 2" / "2nd Season" / "Part 2": varios buscadores no
// encuentran nada con el sufijo y sí con el nombre base (el ID o el título
// exacto decide luego cuál es la ficha correcta).
export function searchQueries(ctx, max = 3) {
  const out = [];
  const add = (t) => {
    const q = cleanQuery(t);
    if (q && !out.some((x) => x.toLowerCase() === q.toLowerCase())) out.push(q);
  };
  add(ctx.romaji);
  add(ctx.english);
  const base = cleanQuery(ctx.romaji || ctx.english)
    .replace(/\b(season|part|cour)\s*\d+\b|\b\d+(st|nd|rd|th)\s+season\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (base.length >= 3) add(base);
  return out.slice(0, max);
}

// Como titleScore, pero da 3 cuando el título coincide con el de la entrada
// concreta de AniList (romaji, inglés o sinónimos) y no solo con el nombre
// general de la serie en TMDB: así "Spy x Family" no gana a "Spy x Family
// Season 2" cuando se busca la segunda temporada.
function strict(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/×/g, " x ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function entryScore(siteTitle, ctx) {
  const t = strict(siteTitle);
  if (!t) return 0;
  // Comparación estricta: aquí "Season 2" y "Part 2" no son lo mismo.
  for (const c of [ctx.romaji, ctx.english, ...(ctx.synonyms || [])]) if (strict(c) === t) return 3;
  return titleScore(siteTitle, ctx);
}

// Elige una ficha entre resultados {slug, title} de varias búsquedas.
// Gana el título de la entrada concreta; si no, un título exacto único;
// si no, un único parecido. En caso de duda, ninguna.
export function pickByTitle(lists, ctx) {
  const seen = new Set();
  const ranked = lists
    .flat()
    .filter((r) => (seen.has(r.slug) ? false : seen.add(r.slug)))
    .map((r) => ({ ...r, score: entryScore(r.title, ctx) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
  const top = ranked[0];
  let slug = null;
  if (top && top.score === 3) slug = top.slug;
  else if (top && top.score === 2 && ranked.filter((r) => r.score === 2).length === 1) slug = top.slug;
  else if (ranked.length === 1) slug = top.slug;
  return { slug, ranked };
}
