const UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const g=async(u,h={})=>{const r=await fetch(u,{headers:{"User-Agent":UA,...h}});return [r.status,await r.text(),r.url]};
const [,js]=await g("https://play.saturncdn.net/assets/js/embed/embed.js?v=1795179562",{Referer:"https://play.saturncdn.net/"});
console.log("LEN",js.length);
for(const k of ["__E","fetch(","/api","m3u8","source","token","expires"]){let i=-1,n=0;while((i=js.indexOf(k,i+1))>=0&&n<4){console.log(`[${k}]`,js.slice(Math.max(0,i-250),i+350).replace(/\s+/g," "));n++}}
