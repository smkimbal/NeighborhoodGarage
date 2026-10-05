import {mkdir,cp,rm,readFile,writeFile,readdir} from 'node:fs/promises';
import {build} from 'esbuild';
import {normalizeSiteUrl} from './site-url.mjs';
import {deploymentConfig} from './deployment-config.mjs';
const deployment = deploymentConfig(process.env);
const out = deployment.output;
const publicSiteUrl = process.env.NG_PUBLIC_SITE_URL ? normalizeSiteUrl(process.env.NG_PUBLIC_SITE_URL) : null;
await rm(out,{recursive:true,force:true});
await mkdir(`${out}/assets`,{recursive:true});
for(const f of ['config.js','favicon.svg','_headers'])await cp(f,`${out}/${f}`);
// Only explicit public settings enter the production browser bundle.
if (deployment.config) await writeFile(`${out}/config.js`, `window.NG_CONFIG = ${JSON.stringify(deployment.config)};\n`);
if (publicSiteUrl && deployment.target === 'sandbox') {
  const config = await readFile('config.js', 'utf8');
  await writeFile(`${out}/config.js`, config + '\nwindow.NG_CONFIG.authRedirectUrl = ' + JSON.stringify(publicSiteUrl) + ';\n');
}
const publicConfig=await readFile(`${out}/config.js`,'utf8');
if(!/['"]?supabaseKey['"]?\s*:\s*['"]sb_publishable_[A-Za-z0-9_-]+['"]/.test(publicConfig)||/\b(sb_secret_|(?:sk|rk)_(?:test|live)_|whsec_)/.test(publicConfig))throw Error('Browser configuration must contain only a public Supabase publishable key.');
const databaseOrigin=deployment.config?.supabaseUrl||publicConfig.match(/https:\/\/[a-z0-9]+\.supabase\.co/)?.[0];
if(!databaseOrigin)throw Error('Cannot restrict network policy without a database origin.');
if(deployment.target==='sandbox' && databaseOrigin!=='https://ilfpugydxlzmmxjfrmrv.supabase.co')throw Error('Sandbox builds must use the sandbox database.');
const headers=(await readFile('_headers','utf8')).replaceAll('https://*.supabase.co',databaseOrigin).replaceAll('wss://*.supabase.co',databaseOrigin.replace('https:','wss:'));
await writeFile(`${out}/_headers`,headers);
await build({entryPoints:['src/app.js'],bundle:true,minify:true,format:'esm',splitting:true,target:['es2022'],outdir:`${out}/assets`,entryNames:'app',chunkNames:'chunks/[name]-[hash]',loader:{'.png':'dataurl'},assetNames:'[name]-[hash]',sourcemap:false});
// Self-host the free OCR runtime and language data. Recognition never uploads a photo.
const vision=`${out}/assets/vision`;
await mkdir(`${vision}/core`,{recursive:true});await mkdir(`${vision}/lang`,{recursive:true});
await cp('node_modules/tesseract.js/dist/worker.min.js',`${vision}/worker.min.js`);
await cp('node_modules/tesseract.js/dist/worker.min.js.LICENSE.txt',`${vision}/worker.LICENSE.txt`);
for(const file of await readdir('node_modules/tesseract.js-core')) {
 if(file.endsWith('-lstm.wasm.js'))await cp(`node_modules/tesseract.js-core/${file}`,`${vision}/core/${file}`);
}
await cp('node_modules/tesseract.js-core/LICENSE',`${vision}/core/LICENSE.txt`);
await cp('node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz',`${vision}/lang/eng.traineddata.gz`);
const html=(await readFile('index.html','utf8')).replace('./src/style.css','./assets/app.css').replace('./src/app.js','./assets/app.js');
await writeFile(`${out}/index.html`,html);await writeFile(`${out}/404.html`,html);
console.log(`Built ${out}/ (${deployment.target}).`);
