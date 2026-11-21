// Empaqueta cada scraper en un único archivo para Nuvio y genera manifest.json.
import { build } from "esbuild";
import fs from "node:fs";

const pkgVersion = "1.4.0";
fs.mkdirSync("providers", { recursive: true });
const banner = "// Generado desde src/ con tools/build.mjs. No editar a mano.\n";

const repos = [
  {
    list: "tools/providers.json",
    manifest: "manifest.json",
    name: "Anime SUB (ES · IT · EN)",
    description: "Anime subtitulado en español, italiano e inglés. Sin doblajes.",
  },
  {
    list: "tools/providers-dub.json",
    manifest: "dub/manifest.json",
    dir: "dub/",
    name: "Anime DOBLADO (ES · IT)",
    description: "Anime doblado en castellano, latino e italiano; si no hay doblaje español, subtitulado en español.",
  },
];

for (const repo of repos) {
  const list = JSON.parse(fs.readFileSync(repo.list, "utf8"));
  fs.mkdirSync(`${repo.dir || ""}providers`, { recursive: true });
  for (const p of list) {
    await build({
      entryPoints: [`src/providers/${p.id}.js`],
      outfile: `${repo.dir || ""}providers/${p.id}.js`,
      bundle: true,
      format: "cjs",
      platform: "neutral",
      target: "es2020",
      external: ["crypto-js", "cheerio-without-node-native"],
      banner: { js: banner },
      legalComments: "none",
      logLevel: "warning",
    });
  }
  const manifest = {
    name: repo.name,
    version: pkgVersion,
    description: repo.description,
    author: "nellon86",
    scrapers: list.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      version: pkgVersion,
      author: "nellon86",
      supportedTypes: ["movie", "tv"],
      filename: `providers/${p.id}.js`,
      enabled: true,
      hasSettings: false,
      logo: p.logo,
      contentLanguage: p.lang,
      formats: ["m3u8", "mp4"],
    })),
  };
  fs.writeFileSync(repo.manifest, JSON.stringify(manifest, null, 2) + "\n");
  console.log("ok", repo.manifest, list.length, "scrapers");
}
