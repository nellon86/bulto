// TioAnime no tiene doblajes: aporta la versión subtitulada en español.
import { defineProvider } from "../core/provider.js";
import { runFor } from "./tioanime.js";

export const getStreams = defineProvider({ id: "dub-tioanime", run: (ctx) => runFor(ctx, "dub-tioanime") });
