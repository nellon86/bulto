const UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const B="https://anidb.app";
const g=async(u,h={})=>{const r=await fetch(u,{headers:{"User-Agent":UA,...h}});return [r.status,await r.text(),r.url]};
const cut=(s,n=800)=>s.replace(/\s+/g," ").slice(0,n);
let [s,t,u]=await g(B+"/search/suggestions?q=Sousou%20no%20Frieren",{Referer:B+"/home","X-Requested-With":"XMLHttpRequest",Accept:"text/html, */*"});
console.log("SUG",s,u,cut(t,1200));
const slug=(t.match(/\/anime\/([^"/?#]+)/)||[])[1];console.log("slug",slug);
if(slug){[s,t,u]=await g(B+"/anime/"+slug,{Referer:B+"/home"});console.log("PAGE",s,u,(t.match(/anilist\.co\/anime\/\d+/)||[])[0],(t.match(/myanimelist\.net\/anime\/\d+/)||[])[0]);
 const id=(slug.match(/-(\d+)$/)||[])[1];[s,t]=await g(`${B}/api/frontend/anime/${id}/episodes`,{Referer:B+"/anime/"+slug,"X-Requested-With":"XMLHttpRequest",Accept:"application/json"});console.log("EPS",s,cut(t,500));
 const ep=(t.match(/"id":(\d+)/)||[])[1];if(ep){[s,t]=await g(`${B}/api/frontend/episode/${ep}/languages`,{Referer:B+"/anime/"+slug,"X-Requested-With":"XMLHttpRequest",Accept:"application/json"});console.log("LANG",s,cut(t,800));
 const emb=(t.match(/"embed_url":"([^"]+)"/)||[])[1];if(emb){const e=emb.replace(/\\\//g,"/");[s,t]=await g(e,{Referer:B+"/"});console.log("EMB",s,e,(t.match(/https?:[^"'\s\\]+\.m3u8[^"'\s\\]*/)||[])[0],cut(t,300));}}}
