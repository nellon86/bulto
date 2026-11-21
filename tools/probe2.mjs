const UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const g=async(u,h={},o={})=>{try{const r=await fetch(u,{headers:{"User-Agent":UA,...h},...o});return [r.status,await r.text(),r.url]}catch(e){return [0,"ERR "+e.message,u]}};
const cut=(s,n=700)=>s.replace(/\s+/g," ").slice(0,n);
const hosts=t=>[...new Set((t.match(/https?:\/\/[a-z0-9.-]+\.[a-z]{2,}/gi)||[]).map(x=>x.toLowerCase()))].filter(h=>!/google|cloudflare|jquery|fonts|gstatic|facebook|twitter|histats|cdnjs/.test(h)).slice(0,25).join(" ");
// Henaojara
let [s,t,u]=await g("https://ww1.henaojara.net/animes?buscar=frieren");console.log("HJ search",s,u,(t.match(/\/anime\/[a-z0-9-]+/g)||[]).filter((v,i,a)=>a.indexOf(v)===i).slice(0,10));
[s,t,u]=await g("https://ww1.henaojara.net/animes?buscar=spy%20x%20family");console.log("HJ spy",s,(t.match(/\/anime\/[a-z0-9-]+/g)||[]).filter((v,i,a)=>a.indexOf(v)===i).slice(0,12));
// AnimeJara
[s,t,u]=await g("https://animejara.com/?s=frieren");console.log("AJ search",s,u,(t.match(/animejara\.com\/(anime|movie)\/[a-z0-9-]+/g)||[]).filter((v,i,a)=>a.indexOf(v)===i).slice(0,10),cut(t,200));
// LatAnime
[s,t,u]=await g("https://latanime.org/buscar?q=frieren");console.log("LA search",s,u,(t.match(/\/anime\/[a-z0-9-]+/g)||[]).filter((v,i,a)=>a.indexOf(v)===i).slice(0,12));
[s,t,u]=await g("https://latanime.org/buscar?q=spy%20x%20family");console.log("LA spy",s,(t.match(/\/anime\/[a-z0-9-]+/g)||[]).filter((v,i,a)=>a.indexOf(v)===i).slice(0,12));
// AnimeWorld ITA
[s,t]=await g("https://www.animeworld.ac/play/frieren-beyond-journeys-end-ita.v26Gn");console.log("AW ITA",s,(t.match(/anilist\.co\/anime\/\d+/)||[])[0],(t.match(/data-episode-num="1"[^>]*/)||[])[0]);
// AnimeSaturn ITA
[s,t]=await g("https://www.animesaturn.net/anime/frieren-beyond-journey-s-end-ita-JVrzc");console.log("AS ITA",s,(t.match(/anilist\.co\/anime\/\d+/)||[])[0],[...new Set(t.match(/\/episode\/[^"']+/g)||[])].slice(0,2));
