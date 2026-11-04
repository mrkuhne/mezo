/* node build.mjs — assemble the published Artifact (https://claude.ai/artifact/2ZdMk9D8jsjbFRhf2cB9cP) into OUT/publish:
   index.html = klinikai-iranyok.html titled "A napom rajzolva", opening on #w-nap-mai, with the five experiment scripts
   before </body>; plus the 15 vilagos/*.js it loads. Prints the publish_files list. */
import fs from 'fs'; import path from 'path'; import {fileURLToPath} from 'url';
const here=path.dirname(fileURLToPath(import.meta.url)),proto=path.resolve(here,'../..');
const OUT=path.join(process.env.OUT||path.join((await import('os')).tmpdir(),'kiserlet-tools'),'publish');fs.mkdirSync(path.join(OUT,'vilagos'),{recursive:true});
const K=['napom','edzes','fuel','mezo','en'].map(d=>`vilagos/kiserlet-${d}.js`);
let h=fs.readFileSync(path.join(proto,'klinikai-iranyok.html'),'utf8');
h=h.replace(/<title>[^<]*<\/title>/,`<title>A napom rajzolva</title>\n<script>if(!location.hash)history.replaceState(null,'',location.pathname+location.search+'#w-nap-mai')</script>`)
   .replace('</body>',K.map(f=>`<script src="${f}"></script>`).join('')+'</body>');
fs.writeFileSync(path.join(OUT,'index.html'),h);
const srcs=[...new Set([...h.matchAll(/<script src="(vilagos\/[^"]+\.js)"/g)].map(m=>m[1]))];
const files=[{as:'index.html',path:path.join(OUT,'index.html')}];
for(const f of srcs){fs.copyFileSync(path.join(proto,f),path.join(OUT,f));files.push({as:f,path:path.join(OUT,f)})}
console.log(JSON.stringify(files,null,1));
