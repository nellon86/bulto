// Genera un addon estático de Nuvio/Stremio con catálogos de AniList.
// Uso: ANILIST_USER=Haku86 node scripts/build.mjs
// Sin dependencias: Node 20+ (fetch nativo).

import { mkdir, rm, writeFile, readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const USER = process.env.ANILIST_USER || "Haku86";
const API = "https://graphql.anilist.co";
const MAPPING_URL =
  "https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-full.json";
const PAGE = 100; // tamaño de página que Nuvio pide con skip
const DELAY_MS = 2500; // AniList limita a 30 peticiones/minuto en modo degradado
const POPULAR_PAGES = 4; // 4 x 50 = 200 títulos por catálogo general
const GENRE_PAGES = 2;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- AniList ----------

let lastCall = 0;
async function gql(query, variables = {}, attempt = 1) {
  const wait = lastCall + DELAY_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastCall = Date.now();

  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  if (res.status === 429 && attempt <= 5) {
    const retry = Number(res.headers.get("retry-after")) || 60;
    console.warn(`429 de AniList, espero ${retry} s`);
    await sleep((retry + 1) * 1000);
    return gql(query, variables, attempt + 1);
  }
  if (res.status >= 500 && attempt <= 3) {
    await sleep(10000 * attempt);
    return gql(query, variables, attempt + 1);
  }

  const body = await res.json().catch(() => null);
  if (!res.ok || !body || body.errors) {
    const msg = body?.errors?.map((e) => e.message).join("; ") || res.statusText;
    throw new Error(`AniList ${res.status}: ${msg}`);
  }
  return body.data;
}

const MEDIA_FIELDS = `
  id idMal format episodes status seasonYear season
  title { romaji english userPreferred }
  coverImage { extraLarge large }
  bannerImage description(asHtml: false) genres averageScore
  startDate { year }
  nextAiringEpisode { episode }
`;

async function fetchUserLists() {
  const data = await gql(
    `query ($user: String) {
      MediaListCollection(userName: $user, type: ANIME) {
        lists { entries { status progress updatedAt media { ${MEDIA_FIELDS} tags { name rank } } } }
      }
    }`,
    { user: USER },
  );
  // Las entradas pueden repetirse si están en listas personalizadas; se agrupa por estado real.
  const byId = new Map();
  for (const list of data.MediaListCollection.lists) {
    for (const e of list.entries) byId.set(e.media.id, e);
  }
  const entries = [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  return {
    all: entries,
    watching: entries.filter((e) => e.status === "CURRENT" || e.status === "REPEATING"),
    planning: entries.filter((e) => e.status === "PLANNING"),
  };
}

// ---------- Sugerencias "Para ti" ----------
// Semillas: todo lo que el usuario ha empezado o añadido a pendientes, con el mismo peso
// (las notas se ignoran a propósito). Candidatos: recomendaciones de la comunidad de esas
// semillas, ajustadas por los géneros y etiquetas que más aparecen en sus listas y con una
// ligera penalización a los títulos muy populares.

const SEED_STATUSES = new Set(["CURRENT", "REPEATING", "COMPLETED", "PAUSED", "DROPPED", "PLANNING"]);
const SEED_BATCH = 25;
const RECS_PER_SEED = 10;
const CANDIDATES_TO_FETCH = 200;
const MOVIE_CANDIDATES_TO_FETCH = 100;
const MIN_TAG_RANK = 60;

function countAffinity(entries) {
  const genres = new Map();
  const tags = new Map();
  for (const e of entries) {
    for (const g of e.media.genres || []) genres.set(g, (genres.get(g) || 0) + 1);
    for (const t of e.media.tags || []) {
      if (t.rank >= MIN_TAG_RANK) tags.set(t.name, (tags.get(t.name) || 0) + 1);
    }
  }
  const norm = (map) => {
    const max = Math.max(1, ...map.values());
    return new Map([...map].map(([k, v]) => [k, v / max]));
  };
  return { genres: norm(genres), tags: norm(tags) };
}

function affinityOf(media, aff) {
  const g = media.genres || [];
  const genreAff = g.length ? g.reduce((s, x) => s + (aff.genres.get(x) || 0), 0) / g.length : 0;
  const t = (media.tags || []).filter((x) => x.rank >= MIN_TAG_RANK);
  const tagAff = t.length
    ? t.reduce((s, x) => s + (aff.tags.get(x.name) || 0) * (x.rank / 100), 0) / t.length
    : 0;
  return 0.6 * genreAff + 0.4 * tagAff;
}

async function fetchMediaByIds(ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += 50) {
    const data = await gql(
      `query ($ids: [Int]) {
        Page(perPage: 50) { media(id_in: $ids, type: ANIME) { ${MEDIA_FIELDS} } }
      }`,
      { ids: ids.slice(i, i + 50) },
    );
    out.push(...data.Page.media);
  }
  const byId = new Map(out.map((m) => [m.id, m]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

async function buildSuggestions(lists, mapping) {
  const listIds = new Set(lists.all.map((e) => e.media.id));
  // IDs de Nuvio (IMDb/TMDB) que ya están en alguna lista: evita sugerir otra temporada de algo conocido.
  const knownMetaIds = new Set(
    lists.all.map((e) => toMeta(e.media, mapping)?.id).filter(Boolean),
  );
  const seeds = lists.all.filter((e) => SEED_STATUSES.has(e.status));
  const seedTitle = new Map(
    seeds.map((e) => [e.media.id, e.media.title.english || e.media.title.romaji]),
  );
  const aff = countAffinity(seeds);

  const cand = new Map();
  for (let i = 0; i < seeds.length; i += SEED_BATCH) {
    const ids = seeds.slice(i, i + SEED_BATCH).map((e) => e.media.id);
    const data = await gql(
      `query ($ids: [Int], $per: Int) {
        Page(perPage: 50) {
          media(id_in: $ids, type: ANIME) {
            id
            recommendations(perPage: $per, sort: RATING_DESC) {
              nodes { rating mediaRecommendation {
                id format status popularity isAdult genres tags { name rank }
              } }
            }
          }
        }
      }`,
      { ids, per: RECS_PER_SEED },
    );
    for (const seed of data.Page.media) {
      for (const n of seed.recommendations?.nodes || []) {
        const r = n.mediaRecommendation;
        if (!r || n.rating <= 0 || listIds.has(r.id)) continue;
        if (r.isAdult || r.format === "MUSIC" || r.status === "NOT_YET_RELEASED") continue;
        const w = Math.log1p(n.rating);
        const c = cand.get(r.id) || { media: r, score: 0, best: 0, reason: null };
        c.score += w;
        if (w > c.best) {
          c.best = w;
          c.reason = seedTitle.get(seed.id);
        }
        cand.set(r.id, c);
      }
    }
  }

  const scored = [...cand.values()]
    .map((c) => ({
      ...c,
      final: (c.score * (0.5 + affinityOf(c.media, aff))) / Math.log10((c.media.popularity || 0) + 100),
    }))
    .sort((a, b) => b.final - a.final);
  // Series y películas compiten por separado para que las películas no queden fuera.
  const ranked = [
    ...scored.filter((c) => c.media.format !== "MOVIE").slice(0, CANDIDATES_TO_FETCH),
    ...scored.filter((c) => c.media.format === "MOVIE").slice(0, MOVIE_CANDIDATES_TO_FETCH),
  ];

  const full = await fetchMediaByIds(ranked.map((c) => c.media.id));
  const reasonById = new Map(ranked.map((c) => [c.media.id, c.reason]));
  const toMetas = (type) =>
    finalize(
      full
        .map((m) => toMeta(m, mapping, type, { reason: reasonById.get(m.id) }))
        .filter((m) => m && !knownMetaIds.has(m.id)),
    ).slice(0, PAGE);

  console.log(`Sugerencias: ${seeds.length} semillas, ${cand.size} candidatos`);
  return { series: toMetas("series"), movies: toMetas("movie") };
}

async function fetchBrowse(vars, pages) {
  const out = [];
  for (let page = 1; page <= pages; page++) {
    const data = await gql(
      `query ($page: Int, $sort: [MediaSort], $season: MediaSeason, $seasonYear: Int,
              $genre: String, $format_in: [MediaFormat], $format_not_in: [MediaFormat]) {
        Page(page: $page, perPage: 50) {
          pageInfo { hasNextPage }
          media(type: ANIME, isAdult: false, sort: $sort, season: $season,
                seasonYear: $seasonYear, genre: $genre,
                format_in: $format_in, format_not_in: $format_not_in) { ${MEDIA_FIELDS} }
        }
      }`,
      { page, ...vars },
    );
    out.push(...data.Page.media);
    if (!data.Page.pageInfo.hasNextPage) break;
  }
  return out;
}

async function fetchGenres() {
  const data = await gql(`query { GenreCollection }`);
  return data.GenreCollection.filter((g) => g !== "Hentai");
}

// ---------- Mapeo AniList -> IMDb / TMDB ----------

async function loadMapping() {
  const res = await fetch(MAPPING_URL);
  if (!res.ok) throw new Error(`No se pudo descargar el mapeo: ${res.status}`);
  const list = await res.json();
  const map = new Map();
  for (const x of list) {
    if (!x.anilist_id) continue;
    const prev = map.get(x.anilist_id);
    // Si hay varias filas para el mismo ID, gana la que tenga IMDb.
    if (prev && prev.imdb_id?.length && !x.imdb_id?.length) continue;
    map.set(x.anilist_id, x);
  }
  return map;
}

function currentSeason(date = new Date()) {
  const m = date.getUTCMonth();
  const seasons = ["WINTER", "WINTER", "SPRING", "SPRING", "SPRING", "SUMMER",
    "SUMMER", "SUMMER", "FALL", "FALL", "FALL", "WINTER"];
  const season = seasons[m];
  const year = m === 11 ? date.getUTCFullYear() + 1 : date.getUTCFullYear();
  return { season, year };
}

const SEASON_ES = { WINTER: "Invierno", SPRING: "Primavera", SUMMER: "Verano", FALL: "Otoño" };

function cleanText(html) {
  if (!html) return undefined;
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Convierte un Media de AniList en un meta de catálogo con ID que Nuvio entiende.
function toMeta(media, mapping, wantType, extra = {}) {
  const m = mapping.get(media.id);
  if (!m) return null;
  const isMovie = media.format === "MOVIE";
  const type = isMovie ? "movie" : "series";
  if (wantType && type !== wantType) return null;

  let id = m.imdb_id?.[0];
  if (!id) {
    const tmdb = isMovie ? m.themoviedb_id?.movie?.[0] : m.themoviedb_id?.tv;
    if (tmdb) id = `tmdb:${tmdb}`;
  }
  if (!id) return null;

  const title = media.title.english || media.title.userPreferred || media.title.romaji;
  const year = media.seasonYear || media.startDate?.year;
  const tmdbSeason = !isMovie ? m.season?.tmdb : undefined;

  const lines = [];
  if (extra.reason) lines.push(`Porque te interesó: ${extra.reason}`);
  if (extra.progress != null) {
    const total = media.episodes ? ` de ${media.episodes}` : "";
    const seasonTxt = tmdbSeason > 1 ? `Temporada ${tmdbSeason} · ` : "";
    lines.push(`${seasonTxt}Visto: ${extra.progress}${total} episodios`);
  } else if (tmdbSeason > 1) {
    lines.push(`Temporada ${tmdbSeason}`);
  }
  if (media.title.romaji && media.title.romaji !== title) lines.push(media.title.romaji);
  const desc = cleanText(media.description);
  if (desc) lines.push(desc);

  return {
    id,
    type,
    name: title,
    poster: media.coverImage?.extraLarge || media.coverImage?.large,
    background: media.bannerImage || undefined,
    posterShape: "poster",
    releaseInfo: year ? String(year) : undefined,
    genres: media.genres,
    description: lines.join("\n\n") || undefined,
    _anilist: media.id,
  };
}

function finalize(metas) {
  // Una misma serie de IMDb puede salir varias veces (una por temporada en AniList).
  const seen = new Set();
  const out = [];
  for (const m of metas) {
    if (!m || seen.has(m.id)) continue;
    seen.add(m.id);
    const { _anilist, ...clean } = m;
    out.push(clean);
  }
  return out;
}

// ---------- Escritura del addon estático ----------

const written = [];
async function writeJson(rel, data) {
  const file = path.join(ROOT, rel);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data));
  written.push(rel);
}

// Escribe la primera página, las páginas skip=N y una final vacía (Nuvio pide hasta lista vacía).
async function writeCatalog(type, id, metas, extraKey) {
  const base = `catalog/${type}/${id}`;
  const prefix = extraKey ? `${extraKey}&` : "";
  await writeJson(extraKey ? `${base}/${extraKey}.json` : `${base}.json`, {
    metas: metas.slice(0, PAGE),
  });
  for (let skip = PAGE; skip < metas.length; skip += PAGE) {
    await writeJson(`${base}/${prefix}skip=${skip}.json`, { metas: metas.slice(skip, skip + PAGE) });
  }
  await writeJson(`${base}/${prefix}skip=${metas.length}.json`, { metas: [] });
}

async function main() {
  console.log(`Usuario de AniList: ${USER}`);
  const mapping = await loadMapping();
  console.log(`Mapeo cargado: ${mapping.size} entradas de AniList`);

  const lists = await fetchUserLists();
  const { season, year } = currentSeason();
  const genres = await fetchGenres();

  const trending = await fetchBrowse({ sort: ["TRENDING_DESC", "POPULARITY_DESC"],
    format_not_in: ["MOVIE", "MUSIC"] }, POPULAR_PAGES);
  const seasonal = await fetchBrowse({ sort: ["POPULARITY_DESC"], season, seasonYear: year,
    format_not_in: ["MOVIE", "MUSIC"] }, POPULAR_PAGES);
  const popular = await fetchBrowse({ sort: ["POPULARITY_DESC"],
    format_not_in: ["MOVIE", "MUSIC"] }, POPULAR_PAGES);
  const movies = await fetchBrowse({ sort: ["POPULARITY_DESC"], format_in: ["MOVIE"] }, POPULAR_PAGES);

  const byGenre = {};
  for (const g of genres) {
    byGenre[g] = await fetchBrowse({ sort: ["POPULARITY_DESC"], genre: g,
      format_not_in: ["MOVIE", "MUSIC"] }, GENRE_PAGES);
  }

  const suggestions = await buildSuggestions(lists, mapping);

  const listMeta = (entries, type) =>
    finalize(entries.map((e) => toMeta(e.media, mapping, type, { progress: e.progress })));
  const plainMeta = (media, type) => finalize(media.map((x) => toMeta(x, mapping, type)));

  const catalogs = [
    { type: "series", id: "anilist-watching", name: "Anime · Viendo",
      metas: listMeta(lists.watching, "series"), source: lists.watching.length },
    { type: "series", id: "anilist-planning", name: "Anime · Pendientes",
      metas: listMeta(lists.planning, "series"), source: lists.planning.length },
    { type: "movie", id: "anilist-planning-movies", name: "Anime · Películas pendientes",
      metas: listMeta(lists.planning, "movie"), source: lists.planning.length },
    { type: "series", id: "anilist-for-you", name: "Anime · Para ti",
      metas: suggestions.series, source: suggestions.series.length },
    { type: "movie", id: "anilist-for-you-movies", name: "Anime · Películas para ti",
      metas: suggestions.movies, source: suggestions.movies.length },
    { type: "series", id: "anilist-trending", name: "Anime · Tendencias",
      metas: plainMeta(trending, "series"), source: trending.length },
    { type: "series", id: "anilist-season", name: `Anime · ${SEASON_ES[season]} ${year}`,
      metas: plainMeta(seasonal, "series"), source: seasonal.length },
    { type: "series", id: "anilist-popular", name: "Anime · Populares",
      metas: plainMeta(popular, "series"), source: popular.length, genres: true },
    { type: "movie", id: "anilist-movies", name: "Anime · Películas populares",
      metas: plainMeta(movies, "movie"), source: movies.length },
  ];

  // Limpia los catálogos anteriores antes de escribir los nuevos.
  await rm(path.join(ROOT, "catalog"), { recursive: true, force: true });

  const genreOptions = [];
  for (const c of catalogs) {
    await writeCatalog(c.type, c.id, c.metas);
    console.log(`${c.name}: ${c.metas.length} títulos (de ${c.source} en AniList)`);
    if (c.genres) {
      for (const g of genres) {
        const metas = plainMeta(byGenre[g], "series");
        if (!metas.length) continue;
        genreOptions.push(g);
        await writeCatalog(c.type, c.id, metas, `genre=${g}`);
      }
    }
  }

  const pkg = JSON.parse(await readFile(path.join(ROOT, "addon.json"), "utf8"));
  const manifest = {
    id: pkg.id,
    version: pkg.version,
    name: pkg.name,
    description: `${pkg.description} Listas de ${USER}.`,
    resources: ["catalog"],
    types: ["series", "movie"],
    idPrefixes: ["tt", "tmdb:"],
    catalogs: catalogs.map((c) => ({
      type: c.type,
      id: c.id,
      name: c.name,
      extra: [
        ...(c.genres ? [{ name: "genre", isRequired: false, options: genreOptions }] : []),
        { name: "skip", isRequired: false },
      ],
    })),
    behaviorHints: { configurable: false, configurationRequired: false },
  };
  await writeJson("manifest.json", manifest);
  console.log(`Escritos ${written.length} archivos.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
