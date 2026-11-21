// Peticiones HTTP con tiempo máximo. En Nuvio, fetch no respeta AbortSignal,
// así que el límite se impone con Promise.race.

export const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// La app de Nuvio para TV no define setTimeout en su motor JavaScript (el
// móvil sí). Sin temporizador no se puede imponer un límite: la petición sigue
// sin él y el propio Nuvio corta el scraper a los 60 s.
export const HAS_TIMERS = typeof setTimeout === "function";

// Sin temporizadores (TV), las peticiones van además una detrás de otra, así
// que cada scraper prueba solo los mejores servidores.
export function limitServers(list, max = 3) {
  return HAS_TIMERS ? list : list.slice(0, max);
}

export function withTimeout(promise, ms, label) {
  if (!HAS_TIMERS) return Promise.resolve(promise);
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
  return withTimeout(fetch(url, init), opts.timeout || 8000, url);
}

export async function getText(url, opts = {}) {
  const res = await request(url, opts);
  // status 0 = la conexión no se pudo hacer (en Nuvio TV, statusText trae el motivo).
  if (!res.ok && !opts.allowError) throw new Error("HTTP " + res.status + (res.statusText ? " " + res.statusText : "") + " " + url);
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
// Registro en memoria para el modo diagnóstico (botón "Probar" de Nuvio).
let captureBuf = null;
export function startCapture() {
  captureBuf = [];
}
export function stopCapture() {
  const b = captureBuf || [];
  captureBuf = null;
  return b;
}
export function log(...args) {
  if (captureBuf) captureBuf.push(args.map((a) => String(a)).join(" "));
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

// Todas las coincidencias de una expresión /g (sin depender de matchAll).
export function allMatches(text, re) {
  const out = [];
  const r = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  let m;
  while ((m = r.exec(String(text || "")))) {
    out.push(m);
    if (m[0] === "") r.lastIndex++;
  }
  return out;
}
