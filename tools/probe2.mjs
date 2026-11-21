const UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const g=async(u,h={})=>{try{const r=await fetch(u,{headers:{"User-Agent":UA,...h}});return [r.status,await r.text(),r.url]}catch(e){return [0,"ERR "+e.message,u]}};
const cut=(s,n=500)=>s.replace(/\s+/g," ").slice(0,n);
function unpack(source){const m=source.match(/}\s*\(\s*(['"])([\s\S]*?)\1\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(['"])([\s\S]*?)\5\.split\(\s*['"]\|['"]\s*\)/);if(!m)return null;let p=m[2].replace(/\\'/g,"'").replace(/\\"/g,'"');const a=+m[3];let c=+m[4];const k=m[6].split("|");const enc=n=>(n<a?"":enc(Math.floor(n/a)))+((n=n%a)>35?String.fromCharCode(n+29):n.toString(36));const d={};while(c--)d[enc(c)]=k[c]||enc(c);return p.replace(/\b\w+\b/g,w=>d[w]!==undefined?d[w]:w)}
for(const u of ["https://luluvdoo.com/e/04drabqzvyf1","https://mxdrop.to/e/03pdw44rak96e7q","https://filemoon.sx/e/8qf6dpaymbip","https://do7go.com/e/s0x00et41f0l","https://listeamed.net/e/vQBYEbp6V3N5n1m"]){
 const [s,t,f]=await g(u,{Referer:"https://latanime.org/"});
 const i=t.indexOf("eval(function(p,a,c,k,e,d)");const un=i>=0?unpack(t.slice(i)):null;const txt=un||t;
 console.log("\n##",u,s,f,t.length,"packed:",i>=0);
 console.log("  media:",[...new Set(txt.match(/(https?:)?\/\/[^"'\s\\]+\.(m3u8|mp4)[^"'\s\\]*/g)||[])].slice(0,4));
 console.log("  wurl:",(txt.match(/MDCore\.wurl\s*=\s*"([^"]+)"/)||[])[1]);
 console.log("  file:",(txt.match(/file\s*:\s*"([^"]+)"/)||[])[1]);
 if(!un)console.log("  head:",cut(t,300));
}
