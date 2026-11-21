// MegaPlay: servidor que usaban HiAnime y otras webs. Busca por ID de AniList
// o MAL y devuelve solo la versión subtitulada (inglés).

import CryptoJS from "crypto-js";
import { getText, getJson, log } from "../core/http.js";
import { defineProvider } from "../core/provider.js";
import { makeStream } from "../core/streams.js";

const BASES = ["https://megaplay.buzz", "https://vidwish.live"];
const KEY = "i?LMTAx0Q6,:}50U";
const IV = "W0;27ToaUpl_P%'c";

function decrypt(enc) {
  const keyHex = CryptoJS.enc.Utf8.parse(KEY).toString(CryptoJS.enc.Hex).padEnd(64, "0");
  let b64 = enc.replace(/-/g, "+").replace(/_/g, "/");
  b64 += "=".repeat((4 - (b64.length % 4)) % 4);
  const out = CryptoJS.AES.decrypt(b64, CryptoJS.enc.Hex.parse(keyHex), {
    iv: CryptoJS.enc.Utf8.parse(IV),
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  }).toString(CryptoJS.enc.Utf8);
  return JSON.parse(out);
}

async function sources(base, pageUrl, id) {
  const json = await getJson(`${base}/stream/getSources?id=${id}&id=${id}`, {
    headers: { "X-Requested-With": "XMLHttpRequest", Referer: pageUrl },
  });
  let file = json && json.sources && json.sources.file;
  if (!file && json && json.enc) {
    const dec = decrypt(json.enc);
    file = dec && dec.file;
  }
  if (!file) return null;
  const subs = (json.tracks || [])
    .filter((t) => t.file && (t.kind === "captions" || t.kind === "subtitles"))
    .map((t) => ({ url: t.file, name: t.label || "English", language: (t.label || "eng").slice(0, 3).toLowerCase() }));
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
      log("página", e.message);
      continue;
    }
    const dataId = (html.match(/id="megaplay-player"[\s\S]*?data-id="(\d+)"/) || [])[1];
    const realId = (html.match(/data-realid="(\d+)"/) || [])[1];
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
          subtitles: main.subs,
        })
      );
    }
    if (realId) {
      const alt = `${BASES[1]}/stream/s-2/${realId}/sub`;
      try {
        const h2 = await getText(alt, { headers: { Referer: pageUrl } });
        const id2 = (h2.match(/id="megaplay-player"[\s\S]*?data-id="(\d+)"/) || [])[1];
        if (id2) {
          const s2 = await sources(BASES[1], alt, id2);
          if (s2) {
            out.push(
              makeStream(ctx, {
                lang: "en",
                source: "MegaPlay",
                server: "Vidwish",
                providerId: "megaplay",
                url: s2.file,
                quality: "1080p",
                format: "m3u8",
                headers: { Referer: `${BASES[1]}/`, Origin: BASES[1] },
                subtitles: s2.subs,
              })
            );
          }
        }
      } catch (e) {
        log("vidwish", e.message);
      }
    }
    if (out.length) return out;
  }
  return [];
}

export const getStreams = defineProvider({ id: "megaplay", run });
