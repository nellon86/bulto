# Anime for AniList (Nuvio)

Addon de catálogo no oficial. Instálalo en Nuvio con esta URL:

https://raw.githubusercontent.com/nellon86/bulto/nuvio-anilist/manifest.json

## Qué incluye

- **Viendo** y **Pendientes**: las listas públicas de anime del usuario `Haku86`.
- **Películas pendientes**.
- **Tendencias**, **temporada actual**, **Populares** (con filtro por género) y **Películas populares**.

Los títulos usan IDs de IMDb (o `tmdb:` si no hay IMDb), así que tus addons y plugins de streams funcionan igual que con cualquier serie. Los títulos sin equivalencia en IMDb o TMDB no aparecen.

## Cómo se actualiza

La GitHub Action `AniList catalog` (en la rama `master`) ejecuta `node scripts/build.mjs` cada hora, regenera `manifest.json` y `catalog/` en esta rama y hace commit solo si algo cambió. También se puede lanzar a mano desde la pestaña Actions → AniList catalog → Run workflow.

- Usuario: variable `ANILIST_USER` del workflow.
- Nombre, versión e ID del addon: `addon.json`.
- Mapeo AniList → IMDb/TMDB: [Fribb/anime-lists](https://github.com/Fribb/anime-lists).

El perfil de AniList debe ser público; si no, la Action falla y GitHub avisa por correo.
