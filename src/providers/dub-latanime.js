// LatAnime: doblaje castellano y latino; si no hay doblaje, subtitulado en español.
import { defineProvider } from "../core/provider.js";
import { runDub } from "./latanime.js";

export const getStreams = defineProvider({ id: "dub-latanime", run: (ctx) => runDub(ctx, "dub-latanime") });
