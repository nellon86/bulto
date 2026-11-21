// Extractores de servidores de vídeo externos: reciben la URL del reproductor
// incrustado y devuelven { url, headers, quality } o null.

import { getText, request, origin, absolute, log } from "./http.js";

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

// Voe: la página trae un bloque JSON cifrado (ROT13 + base64 + desplazamiento).
// Si la página pide resolver un desafío (Altcha), se descarta: es lento.
function voeDecode(enc, noise) {
  let t = enc.replace(/[a-zA-Z]/g, (c) => {
    const top = c <= "Z" ? 90 : 122;
    const n = c.charCodeAt(0) + 13;
    return String.fromCharCode(n <= top ? n : n - 26);
  });
  for (const x of noise || ["@$", "^^", "~@", "%?", "*~", "!!", "#&"]) t = t.split(x).join("");
  try {
    const step = atob(t);
    let shifted = "";
    for (let i = 0; i < step.length; i++) shifted += String.fromCharCode(step.charCodeAt(i) - 3);
    return JSON.parse(atob(shifted.split("").reverse().join("")));
  } catch (_) {
    return null;
  }
}

async function voe(url, referer) {
  let current = url;
  let html = "";
  for (let i = 0; i < 3; i++) {
    const res = await request(current, { headers: { Referer: i === 0 && referer ? referer : current }, timeout: 6000 });
    if (!res.ok) return null;
    html = await res.text();
    if (res.url) current = res.url;
    const jump = html.length < 4000 && html.match(/window\.location\.href\s*=\s*['"]([^'"]+)['"]/i);
    if (!jump) break;
    current = absolute(current, jump[1]);
  }
  const headers = { Referer: origin(current) + "/" };
  const block = html.match(/<script type="application\/json">([\s\S]*?)<\/script>(?:\s*<script[^>]*src=["']([^"']+)["'])?/i);
  if (block) {
    let enc = "";
    try {
      const d = JSON.parse(block[1].trim());
      enc = Array.isArray(d) ? d[0] : d;
    } catch (_) {}
    let data = enc ? voeDecode(enc) : null;
    if (!data && enc && block[2]) {
      const loader = await getText(absolute(current, block[2]), { headers: { Referer: current }, timeout: 5000 }).catch(() => "");
      const list = (loader.match(/\[(?:\s*'[^']{1,10}'\s*,?){4,12}\]/) || loader.match(/\[(?:\s*"[^"]{1,10}"\s*,?){4,12}\]/) || [])[0];
      if (list) data = voeDecode(enc, (list.match(/['"]([^'"]{1,10})['"]/g) || []).map((x) => x.slice(1, -1)));
    }
    const video = data && (data.source || data.direct_access_url);
    if (video) return { url: video, headers, quality: "720p", format: /\.mp4/.test(video) ? "mp4" : "m3u8" };
  }
  const hls = html.match(/['"]hls['"]\s*:\s*['"]([^'"]+)['"]/i);
  if (hls) {
    const v = /^aHR0/.test(hls[1]) ? atob(hls[1]) : hls[1];
    return { url: v, headers, quality: "720p", format: "m3u8" };
  }
  return null;
}

async function uqload(url, referer) {
  const embed = /embed-/.test(url) ? url : url.replace(/(uqloads?\.[a-z]+\/)(?!embed-)/, "$1embed-");
  const html = await getText(embed, { headers: { Referer: referer || embed }, timeout: 6000 });
  const m = html.match(/sources\s*:\s*\[\s*["']([^"']+)["']/);
  if (!m || !/^https?:\/\//.test(m[1])) return null;
  return { url: m[1], headers: { Referer: origin(embed) + "/" }, quality: "HD", format: /\.mp4/.test(m[1]) ? "mp4" : "m3u8" };
}

const HOSTS = [
  { re: /yourupload\.com/i, name: "YourUpload", fn: yourUpload },
  { re: /mp4upload\.com/i, name: "MP4Upload", fn: mp4Upload },
  { re: /zilla-networks\.com/i, name: "Zilla", fn: zilla },
  { re: /voe\.sx|voe-unblock|voeunbl|\/\/voe\./i, name: "Voe", fn: voe },
  { re: /uqloads?\./i, name: "Uqload", fn: uqload },
  {
    re: /(vidhide|ryderjet|callistanise|filelions|streamwish|swdyu|wishembed|strwish|playerwish|dhcplay|hlswish|mivalyo|dinisglows|vidhidepro|vidhidevip|cdnwish)/i,
    name: "VidHide",
    fn: packedPlayer,
  },
];

// Orden de preferencia: primero los más fiables.
export function hostRank(url) {
  const order = ["YourUpload", "MP4Upload", "VidHide", "Voe", "Uqload", "Zilla"];
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
