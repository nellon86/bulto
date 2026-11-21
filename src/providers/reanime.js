// Reanime: API por ID de AniList y descarga directa desde FlixCloud.

import { getText, getJson, log } from "../core/http.js";
import { defineProvider } from "../core/provider.js";
import { makeStream } from "../core/streams.js";

const DOMAINS = ["https://reanime.cz", "https://reanime.to", "https://reanime.wtf"];
const FLIX = "https://flixcloud.cc";

async function servers(alId, ep) {
  for (const d of DOMAINS) {
    try {
      const json = await getJson(`${d}/api/flix/${alId}/${ep}`, {
        headers: { Accept: "application/json", Referer: `${d}/` },
      });
      if (json && json.success && Array.isArray(json.servers)) return json.servers;
    } catch (e) {
      log(d, e.message);
    }
  }
  return [];
}

async function flixDownload(embedUrl) {
  const aid = (embedUrl.match(/\/e\/([a-z0-9]+)/i) || [])[1];
  if (!aid) return null;
  const headers = { Accept: "*/*", Referer: `${FLIX}/` };
  const body = await getText(`${FLIX}/d/${aid}/__data.json`, { headers });
  const fileId = (body.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i) || [])[0];
  const token = (body.match(/eyJ[\w-]+\.[\w-]+\.[\w-]+/) || [])[0];
  const base = (body.match(/https:\/\/[a-z0-9-]+\.flixcloud\.cc/i) || [])[0] || FLIX;
  const resolution = (body.match(/"(\d{3,4}p)"/) || [])[1];
  if (!fileId || !token) return null;
  return { url: `${base}/download/${fileId}?token=${token}`, quality: resolution || "1080p", headers };
}

async function run(ctx) {
  const list = (await servers(ctx.anilistId, ctx.episode)).filter(
    (s) => s && s.dataLink && String(s.dataType || "").toLowerCase() === "sub"
  );
  const seen = new Set();
  const tasks = list
    .filter((s) => (seen.has(s.dataLink) ? false : seen.add(s.dataLink)))
    .map(async (s) => {
      const dl = await flixDownload(s.dataLink).catch((e) => log("flix", e.message));
      if (!dl) return null;
      return makeStream(ctx, {
        lang: "en",
        source: "Reanime",
        server: s.serverName,
        providerId: "reanime",
        url: dl.url,
        quality: dl.quality,
        format: "mp4",
        headers: dl.headers,
      });
    });
  return Promise.all(tasks);
}

export const getStreams = defineProvider({ id: "reanime", run });
