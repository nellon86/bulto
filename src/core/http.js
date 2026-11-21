// Peticiones HTTP con tiempo máximo. En Nuvio, fetch no respeta AbortSignal,
// así que el límite se impone con Promise.race.

export const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout " + (label || ""))), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export async function request(url, opts = {}) {
  const headers = Object.assign({ "User-Agent": UA }, opts.headers || {});
  const init = { method: opts.method || "GET", headers };
  if (opts.body !== undefined) init.body = opts.body;
  if (opts.redirect) init.redirect = opts.redirect;
  return withTimeout(fetch(url, init), opts.timeout || 12000, url);
}

export async function getText(url, opts = {}) {
  const res = await request(url, opts);
  if (!res.ok && !opts.allowError) throw new Error("HTTP " + res.status + " " + url);
  return res.text();
}

export async function getJson(url, opts = {}) {
  const text = await getText(url, opts);
  return JSON.parse(text);
}

// Devuelve null en vez de lanzar error.
export async function tryJson(url, opts = {}) {
  try {
    return await getJson(url, opts);
  } catch (e) {
    log("tryJson", url, e && e.message);
    return null;
  }
}

export async function tryText(url, opts = {}) {
  try {
    return await getText(url, opts);
  } catch (e) {
    log("tryText", url, e && e.message);
    return null;
  }
}

let logPrefix = "[anime]";
export function setLogPrefix(p) {
  logPrefix = p;
}
export function log(...args) {
  try {
    console.log(logPrefix, ...args);
  } catch (_) {}
}

export function origin(url) {
  const m = String(url).match(/^(https?:\/\/[^/]+)/i);
  return m ? m[1] : "";
}

export function absolute(base, path) {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("//")) return "https:" + path;
  return origin(base) + (path.startsWith("/") ? "" : "/") + path;
}

export function decodeHtml(s) {
  return String(s || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

// Ejecuta tareas en paralelo y devuelve solo las que salen bien.
export async function settle(promises) {
  const out = await Promise.all(promises.map((p) => Promise.resolve(p).catch((e) => {
    log("task failed", e && e.message);
    return null;
  })));
  return out;
}
