// Extractores de servidores de vídeo externos: reciben la URL del reproductor
// incrustado y devuelven { url, headers, quality } o null.

import { getText, origin, log } from "./http.js";

// Desempaqueta código "eval(function(p,a,c,k,e,d)...)".
export function unpack(source) {
  const m = source.match(/}\s*\(\s*(['"])([\s\S]*?)\1\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(['"])([\s\S]*?)\5\.split\(\s*['"]\|['"]\s*\)/);
  if (!m) return null;
  let p = m[2].replace(/\\'/g, "'").replace(/\\"/g, '"');
  const a = parseInt(m[3], 10);
  let c = parseInt(m[4], 10);
  const k = m[6].split("|");
  const enc = (n) => (n < a ? "" : enc(Math.floor(n / a))) + ((n = n % a) > 35 ? String.fromCharCode(n + 29) : n.toString(36));
  const dict = {};
  while (c--) dict[enc(c)] = k[c] || enc(c);
  return p.replace(/\b\w+\b/g, (w) => (dict[w] !== undefined ? dict[w] : w));
}

function firstMedia(text) {
  const m3u8 = text.match(/https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*/);
  if (m3u8) return m3u8[0];
  const mp4 = text.match(/https?:\/\/[^"'\s\\]+\.mp4[^"'\s\\]*/);
  return mp4 ? mp4[0] : null;
}

async function yourUpload(url, referer) {
  const html = await getText(url, { headers: { Referer: referer || "https://www.yourupload.com/" }, timeout: 6000 });
  const m = html.match(/og:video"\s+content="([^"]+)"/) || html.match(/file:\s*'([^']+\.mp4[^']*)'/);
  if (!m || !/^https?:\/\//.test(m[1]) || /novideo/i.test(m[1])) return null;
  return { url: m[1], headers: { Referer: "https://www.yourupload.com/" }, quality: "HD" };
}

async function mp4Upload(url) {
  const html = await getText(url, { headers: { Referer: "https://www.mp4upload.com/" }, timeout: 6000 });
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
    format: "m3u8",
  };
}

// VidHide, StreamWish y familia: el enlace va dentro de código empaquetado.
async function packedPlayer(url, referer) {
  const html = await getText(url, { headers: { Referer: referer || origin(url) + "/" }, timeout: 6000 });
  let text = html;
  const i = html.indexOf("eval(function(p,a,c,k,e,d)");
  if (i >= 0) {
    const unpacked = unpack(html.slice(i));
    if (unpacked) text = unpacked;
  }
  // Prioriza los enlaces HLS completos.
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

const HOSTS = [
  { re: /yourupload\.com/i, name: "YourUpload", fn: yourUpload },
  { re: /mp4upload\.com/i, name: "MP4Upload", fn: mp4Upload },
  { re: /zilla-networks\.com/i, name: "Zilla", fn: zilla },
  {
    re: /(vidhide|ryderjet|callistanise|filelions|streamwish|swdyu|wishembed|strwish|playerwish|dhcplay|hlswish|mivalyo|dinisglows|vidhidepro|vidhidevip|cdnwish)/i,
    name: "VidHide",
    fn: packedPlayer,
  },
];

// Orden de preferencia: primero los más fiables.
export function hostRank(url) {
  const order = ["YourUpload", "MP4Upload", "VidHide", "Zilla"];
  const name = hostName(url);
  const i = order.indexOf(name);
  return i < 0 ? 99 : i;
}

export function hostName(url) {
  const h = HOSTS.find((x) => x.re.test(url));
  return h ? h.name : null;
}

export function isSupported(url) {
  return !!hostName(url);
}

export async function extract(url, referer) {
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
