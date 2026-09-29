import {mkdir,cp,rm} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});
await mkdir('dist',{recursive:true});
for(const f of ['index.html','config.js','favicon.svg','src']) await cp(f,`dist/${f}`,{recursive:true});
await cp('index.html','dist/404.html');
console.log('Built static assets in dist/ (relative paths + hash routing).');
