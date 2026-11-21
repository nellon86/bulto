// Solo la ficha doblada en italiano (ITA); sin alternativa subtitulada.
import { defineProvider } from "../core/provider.js";
import { runFor } from "./animeworld.js";

export const getStreams = defineProvider({ id: "dub-animeworld", run: (ctx) => runFor(ctx, true, "dub-animeworld") });
