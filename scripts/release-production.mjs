// Run from a trusted workstation or a non-GitHub CI runner. No GitHub hosting/API is involved.
import {spawnSync} from 'node:child_process';
import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {readdir} from 'node:fs/promises';
const action = process.argv[2];
function run(command, args, env=process.env) {
  const result=spawnSync(command,args,{stdio:'inherit',env});
  if(result.error) throw result.error;
  if(result.status!==0) throw new Error(`${command} failed; release stopped.`);
}
async function inventory(dir) {
  const files={};
  async function walk(path) {
    for(const entry of await readdir(path,{withFileTypes:true})) {
      const full=`${path}/${entry.name}`;
      if(entry.isSymbolicLink()) throw new Error('Release assets cannot contain symbolic links.');
      if(entry.isDirectory()) await walk(full);
      else files[full.slice(dir.length+1)]=createHash('sha256').update(await readFile(full)).digest('hex');
    }
  }
  await walk(dir);
  return Object.fromEntries(Object.entries(files).sort(([a],[b])=>a.localeCompare(b)));
}
if(action==='prepare') {
  run('npm',['test']);
  run('npm',['run','check:edge']);
  run('node',['scripts/build.mjs'],{...process.env,NG_DEPLOY_TARGET:'production'});
  await writeFile('production-release.json',JSON.stringify({site:'https://neighborhoodgarage.net/',createdAt:new Date().toISOString(),files:await inventory('dist-production')},null,2));
  console.log('Production artifact ready for review. Run release:publish to upload this exact artifact.');
} else if(action==='publish') {
  if(!process.env.CLOUDFLARE_ACCOUNT_ID || !process.env.CLOUDFLARE_API_TOKEN) throw new Error('Cloudflare account ID and scoped API token are required in the runner environment.');
  const manifest=JSON.parse(await readFile('production-release.json','utf8'));
  if(manifest.site!=='https://neighborhoodgarage.net/' || JSON.stringify(manifest.files)!==JSON.stringify(await inventory('dist-production'))) throw new Error('Release artifact changed. Prepare and review again.');
  run('wrangler',['pages','deploy','dist-production','--project-name=neighborhood-garage-production','--branch=production']);
} else throw new Error('Use prepare or publish.');
