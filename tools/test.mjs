// Ejecuta cada scraper empaquetado con los casos de prueba y comprueba que
// los enlaces devueltos respondan con vídeo de verdad.
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const CryptoJS = require("crypto-js");

const only = process.argv[2] ? process.argv[2].split(",") : null;
const providers = [["tools/providers.json", ""], ["tools/providers-dub.json", "dub/"]]
  .flatMap(([f, dir]) => JSON.parse(fs.readFileSync(f, "utf8")).map((p) => ({ ...p, dir })))
  .filter((p) => !only || only.includes(p.id));
const cases = JSON.parse(fs.readFileSync("tests/cases.json", "utf8"));

function load(id, dir = "") {
  const code = fs.readFileSync(`${dir}providers/${id}.js`, "utf8");
  const module = { exports: {} };
  const req = (n) => (n === "crypto-js" ? CryptoJS : require(n));
  new Function("module", "exports", "require", code)(module, module.exports, req);
  return module.exports.getStreams;
}

async function check(stream) {
  try {
    const headers = Object.assign({}, stream.headers || {}, { Range: "bytes=0-4095" });
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 15000);
    const r = await fetch(stream.url, { headers, signal: ctl.signal });
    const buf = Buffer.from(await r.arrayBuffer());
    clearTimeout(t);
    const head = buf.slice(0, 16).toString("latin1");
    const ct = r.headers.get("content-type") || "";
    if (head.startsWith("#EXTM3U")) return { ok: true, why: "m3u8" };
    if (/video|octet|mp4|matroska/i.test(ct) || head.includes("ftyp") || buf[0] === 0x1a) return { ok: true, why: ct || "binario" };
    return { ok: false, why: `${r.status} ${ct} ${head.replace(/[^\x20-\x7e]/g, ".")}` };
  } catch (e) {
    return { ok: false, why: e.name + " " + e.message };
  }
}

const rows = [];
for (const p of providers) {
  const getStreams = load(p.id, p.dir);
  for (const c of cases) {
    const t0 = Date.now();
    let streams = [];
    try {
      streams = await getStreams(c.id, c.type, c.s, c.e);
    } catch (e) {
      console.log("EXCEPCIÓN", p.id, e);
    }
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    const checks = await Promise.all(streams.map(check));
    const okN = checks.filter((x) => x.ok).length;
    rows.push({ provider: p.id, label: c.label, n: streams.length, ok: okN, secs });
    console.log(`\n=== ${p.id} | ${c.label} | ${streams.length} fuentes, ${okN} válidas | ${secs}s`);
    streams.forEach((s, i) => console.log(`  [${checks[i].ok ? "OK" : "XX"}] ${s.name} | ${s.title.replace(/\n/g, " / ")} | ${checks[i].why}\n       ${s.url.slice(0, 150)}`));
  }
}
const table = ["| Scraper | Caso | Fuentes | Válidas | Tiempo |", "|---|---|---|---|---|", ...rows.map((r) => `| ${r.provider} | ${r.label} | ${r.n} | ${r.ok} | ${r.secs}s |`)].join("\n");
console.log("\n" + table);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, table + "\n");
fs.writeFileSync("tests/last-report.json", JSON.stringify(rows, null, 2));
