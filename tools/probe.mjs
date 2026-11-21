// Diagnóstico: descarga URLs y muestra estado y fragmentos útiles.
import fs from "node:fs";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const list = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const pats = [/https?:[^"'\s<>\\]+\.(?:m3u8|mp4)[^"'\s<>\\]*/g, /eval\(function\(p,a,c,k,e,d\)/g, /<iframe[^>]+src="[^"]+"/g, /(?:file|src|source|sources)\s*[:=]\s*["'][^"']{10,200}["']/g, /og:video[^>]+/g, /data-[a-z-]+="[^"]{6,160}"/g, /anilist\.co\/anime\/\d+/g];
for (const item of list) {
  const { url, headers = {}, method = "GET", body, show = 600, find = [] } = item;
  const t = Date.now();
  try {
    const r = await fetch(url, { method, body, redirect: "follow", headers: { "User-Agent": UA, ...headers } });
    const txt = await r.text();
    console.log(`\n### ${method} ${url}\n-> ${r.status} ${r.url} ${txt.length}B ${Date.now() - t}ms ct=${r.headers.get("content-type")}`);
    for (const p of pats) { const m = txt.match(p); if (m) console.log("  " + p.source.slice(0, 25) + ": " + [...new Set(m)].slice(0, 6).join(" | ").slice(0, 900)); }
    for (const f of find) { let i = txt.indexOf(f); if (i >= 0) console.log(`  [${f}] ` + txt.slice(Math.max(0, i - 200), i + 800).replace(/\s+/g, " ")); }
    if (show) console.log("  HEAD: " + txt.slice(0, show).replace(/\s+/g, " "));
  } catch (e) { console.log(`\n### ${url}\n-> ERROR ${e.cause?.code || ""} ${e.message}`); }
}
