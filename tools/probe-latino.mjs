// Diagnóstico: ejecuta scrapers de Droydr13/pluggin-latino y mide tiempo y enlaces válidos.
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const CryptoJS = require("crypto-js");
const dir = process.argv[2];
const ids = process.argv[3].split(",");
const cases = JSON.parse(fs.readFileSync("tests/cases.json", "utf8"));
function load(id) {
  const code = fs.readFileSync(`${dir}/providers/${id}.js`, "utf8");
  const module = { exports: {} };
  const req = (n) => (n === "crypto-js" ? CryptoJS : n.startsWith("cheerio") ? require("cheerio") : require(n));
  new Function("module", "exports", "require", code)(module, module.exports, req);
  return module.exports.getStreams;
}
async function check(s) {
  try {
    const headers = Object.assign({}, s.headers || {}, { Range: "bytes=0-4095" });
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 15000);
    const r = await fetch(s.url, { headers, signal: ctl.signal });
    const buf = Buffer.from(await r.arrayBuffer()); clearTimeout(t);
    const head = buf.slice(0, 16).toString("latin1"); const ct = r.headers.get("content-type") || "";
    if (head.startsWith("#EXTM3U")) return "OK m3u8";
    if (/video|octet|mp4|matroska/i.test(ct) || head.includes("ftyp")) return "OK " + ct;
    return `XX ${r.status} ${ct}`;
  } catch (e) { return "XX " + e.message; }
}
const rows = [];
for (const id of ids) {
  const gs = load(id);
  for (const c of cases) {
    const t0 = Date.now();
    let st = [];
    try { st = await Promise.race([gs(c.id, c.type, c.s, c.e), new Promise((r) => setTimeout(() => r([]), 60000))]); } catch (e) { console.log("ERR", id, e.message); }
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    const ch = await Promise.all((st || []).map(check));
    rows.push(`| ${id} | ${c.label} | ${st.length} | ${ch.filter((x) => x.startsWith("OK")).length} | ${secs}s |`);
    console.log(`\n=== ${id} | ${c.label} | ${st.length} | ${secs}s`);
    (st || []).forEach((s, i) => console.log(`  [${ch[i]}] ${s.name} | ${String(s.title).replace(/\n/g, " / ")} | ${String(s.url).slice(0, 110)}`));
  }
}
console.log("\n| Scraper | Caso | Fuentes | Válidas | Tiempo |\n|---|---|---|---|---|\n" + rows.join("\n"));
