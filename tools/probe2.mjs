const UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const g=async(u,h={})=>{const r=await fetch(u,{headers:{"User-Agent":UA,...h}});return [r.status,await r.text(),r.url]};
const cut=(s,n=1500)=>s.replace(/\s+/g," ").slice(0,n);
try{ // AnimeSaturn embed
 const [,p]=await g("https://www.animesaturn.net/anime/frieren-beyond-journey-s-end-QEd4Q/ep-1");
 const src=p.match(/id="watch-iframe" src="([^"]+)"/)[1].replace(/&amp;/g,"&");
 const [s,e]=await g(src,{Referer:"https://www.animesaturn.net/"});
 console.log("SATURN",s,src,"\n",cut(e,3000));
 const m=[...new Set(e.match(/https?:[^"'\s<>\\]+\.(?:m3u8|mp4)[^"'\s<>\\]*/g)||[])];console.log("SATURN media",m);
 const js=[...e.matchAll(/src="([^"]+\.js[^"]*)"/g)].map(x=>x[1]);console.log("SATURN js",js);
}catch(x){console.log("SATURN ERR",x.message)}
try{ const [s,t]=await g("https://animeav1.com/media/sousou-no-frieren/__data.json");console.log("AV1 media",s,cut(t,2500));}catch(x){console.log(x.message)}
try{ const [s,t]=await g("https://www.animegg.org/embed/131519",{Referer:"https://www.animegg.org/"});console.log("GG",s,cut(t,2500));}catch(x){console.log(x.message)}
try{ const [s,t]=await g("https://ryderjet.com/embed/29y4r4a2f6sv",{Referer:"https://animeav1.com/"});const i=t.indexOf("eval(function(p,a,c,k,e,d)");console.log("VH packed",s,t.slice(i,i+3000));}catch(x){console.log(x.message)}
try{ const [s,t]=await g("https://player.zilla-networks.com/m3u8/b510e3389bdef7a567b7dc7ddc650ad2",{Referer:"https://player.zilla-networks.com/"});console.log("ZILLA",s,cut(t,600));}catch(x){console.log(x.message)}
try{ const [s,t]=await g("https://www.animeworld.ac/play/sousou-no-frieren.kbcPv");console.log("AW play",s,(t.match(/anilist\.co\/anime\/\d+/)||[])[0], (t.match(/data-episode-num="1"[^>]*/)||[])[0]);}catch(x){console.log(x.message)}
for(const u of ["https://megaplay.buzz/stream/ani/154587/2/sub","https://megaplay.buzz/stream/mal/52991/2/sub","https://megaplay.buzz/stream/mal/21/1100/sub"]){try{const [s,t]=await g(u,{Referer:"https://megaplay.buzz/"});console.log("MP",u,s,(t.match(/megaplay-player[^>]*/)||[])[0],(t.match(/Error Code: \d+/)||[])[0]);}catch(x){console.log(x.message)}}
