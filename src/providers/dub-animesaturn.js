// Solo la ficha doblada en italiano (ITA); sin alternativa subtitulada.
import { defineProvider } from "../core/provider.js";
import { runFor } from "./animesaturn.js";

export const getStreams = defineProvider({ id: "dub-animesaturn", run: (ctx) => runFor(ctx, true, "dub-animesaturn") });
