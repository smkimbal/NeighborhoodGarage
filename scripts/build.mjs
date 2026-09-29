import {mkdir,cp,rm,readFile,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
await rm('dist',{recursive:true,force:true});
await mkdir('dist/assets',{recursive:true});
for(const f of ['config.js','favicon.svg'])await cp(f,`dist/${f}`);
await build({entryPoints:['src/app.js'],bundle:true,minify:true,format:'esm',target:['es2022'],outfile:'dist/assets/app.js',loader:{'.png':'dataurl'},assetNames:'[name]-[hash]',sourcemap:false});
const html=(await readFile('index.html','utf8')).replace('./src/style.css','./assets/app.css').replace('./src/app.js','./assets/app.js');
await writeFile('dist/index.html',html);await writeFile('dist/404.html',html);
// The repository currently also publishes its branch root through native Pages.
// Keep that deployment path equivalent to the Actions dist artifact.
await rm('assets',{recursive:true,force:true});
await cp('dist/assets','assets',{recursive:true});
console.log('Built dist/ and branch-compatible assets/.');
