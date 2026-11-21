// Diagnóstico: muestra las listas HLS maestras y la variante elegida.
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const CryptoJS = require("crypto-js");
function load(id) {
  const code = fs.readFileSync(`providers/${id}.js`, "utf8");
  const module = { exports: {} };
  new Function("module", "exports", "require", code)(module, module.exports, (n) => (n === "crypto-js" ? CryptoJS : require(n)));
  return module.exports.getStreams;
}
const show = async (label, url, headers) => {
  const t = await fetch(url, { headers }).then((r) => r.text()).catch((e) => "ERR " + e.message);
  console.log(`--- ${label} ${url.slice(0, 120)}\n${t.slice(0, 900)}`);
};
for (const [id, args] of [["megaplay", ["303272", "tv", 1, 7]], ["megaplay", ["209867", "tv", 1, 1]], ["animeav1", ["209867", "tv", 1, 1]]]) {
  const st = await load(id)(...args);
  for (const s of st) {
    if (s.type !== "m3u8") continue;
    const master = s.url.replace(/index-[^/]*\.m3u8.*$/, "master.m3u8");
    console.log(`\n===== ${id} ${args.join(" ")} ${s.name} ${s.quality}`);
    if (master !== s.url) await show("MASTER", master, s.headers);
    await show("ELEGIDA", s.url, s.headers);
  }
}
