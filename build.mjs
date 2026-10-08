import { readdirSync, writeFileSync } from 'node:fs';
const dir = new URL('./public/photos/', import.meta.url);
const files = readdirSync(dir).filter(f => /\.(jpe?g|png|webp|gif)$/i.test(f)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
writeFileSync(new URL('./public/photos.json', import.meta.url), JSON.stringify(files.map(file => ({ file }))));
console.log(files.length + ' foto');
