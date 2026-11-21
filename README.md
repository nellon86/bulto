# Anime SUB (ES · IT · EN) para Nuvio

Repositorio de plugins (scrapers) para Nuvio con anime **solo subtitulado** en español, italiano e inglés. Cada web es un scraper que se puede activar o desactivar por separado.

**Instalación:** Nuvio → Ajustes → Plugins → añadir repositorio:

```
https://raw.githubusercontent.com/nellon86/bulto/nuvio-anime/manifest.json
```

| Scraper | Idioma | Notas |
|---|---|---|
| 🇪🇸 AnimeAV1 | Español (VOSE) | Identifica la serie por ID de MAL. Servidores: HLS, YourUpload, MP4Upload, VidHide, Voe. |
| 🇪🇸 TioAnime | Español (VOSE) | Por título. Servidores: YourUpload, Voe. |
| 🇪🇸 JKAnime | Español (VOSE) | Por título. Servidor HLS propio (Desu/Magi), MP4Upload, VidHide, Voe. Cloudflare bloquea las pruebas automáticas. |
| 🇪🇸 MonosChinos | Español (VOSE) | Por título. Servidores: MP4Upload, Uqload, Voe, VidHide. |
| 🇮🇹 AnimeWorld | Italiano (SUB ITA) | Por ID de AniList. MP4 directo. Descarta las fichas "(ITA)". |
| 🇮🇹 AnimeSaturn | Italiano (SUB ITA) | Por ID de AniList. Descarta las fichas dobladas. |
| 🇬🇧 MegaPlay | Inglés | Por ID de AniList/MAL. Solo la pista `sub`. |
| 🇬🇧 Reanime | Inglés | Por ID de AniList. Solo servidores `sub`. |
| 🌐 AniZone | Subs en varios idiomas | Por título. Marca ES/IT/EN según los subtítulos disponibles. |

## Cómo funciona

`src/core/mapping.js` convierte el ID de TMDB (o `kitsu:`, `mal:`, `anilist:`) con temporada y episodio en la entrada de AniList/MAL y su número de episodio, cruzando la fecha de emisión de TMDB con los episodios de ani.zip. Así las temporadas 2, 3… apuntan a la entrada correcta.

## Desarrollo

```
npm install
npm run build        # genera providers/*.js y manifest.json
npm test             # prueba todos los scrapers con tests/cases.json
node tools/test.mjs animeworld,megaplay   # solo algunos
```

El workflow `test-scrapers` repite las pruebas en GitHub Actions en cada cambio y cada lunes. AniZone y FlixCloud (Reanime) bloquean las IP de centros de datos, así que allí salen vacíos aunque funcionen desde casa.

## Versión doblada (repositorio aparte)

URL para Nuvio: `https://raw.githubusercontent.com/nellon86/bulto/nuvio-anime/dub/manifest.json`

| Scraper | Devuelve |
|---|---|
| 🇪🇸 LatAnime DUB | Doblaje castellano y latino; si no hay ninguno, subtitulado en español |
| 🇲🇽 AnimeAV1 DUB | Doblaje latino; si no hay, subtitulado en español |
| 🇪🇸 TioAnime SUB | Subtitulado en español (el sitio no tiene doblajes) |
| 🇮🇹 AnimeWorld ITA | Doblaje italiano, sin alternativa |
| 🇮🇹 AnimeSaturn ITA | Doblaje italiano, sin alternativa |

LatAnime no se puede probar desde GitHub Actions (Cloudflare); funciona desde casa.
