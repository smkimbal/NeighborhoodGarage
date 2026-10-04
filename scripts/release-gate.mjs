import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {setTimeout as pause} from 'node:timers/promises';
const repository='smkimbal/NeighborhoodGarage';
const backendUrl='https://zbbespojxxoheavodtqs.supabase.co';
const publicKey='sb_publishable_f0Tc0Qz4sWlCRaT58d2qlA_ZKRi-7Ot';

export async function verifyHostedRelease({sha,backendVersion,request=fetch,wait=pause,attempts=40}){
 const json=async(url,options={})=>{const response=await request(url,{...options,signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error(`Release stopped: readiness request failed (${response.status}).`);return response.json();};
 const backend=async()=>{const version=await json(backendUrl+'/rest/v1/rpc/release_version',{method:'POST',headers:{apikey:publicKey,'Content-Type':'application/json'},body:'{}'});if(version!==backendVersion)throw Error('Release stopped: deployed backend is incompatible with this source.');};
 await backend();
 for(let attempt=0;attempt<attempts;attempt++){
  const result=await json(`https://api.github.com/repos/${repository}/actions/workflows/validate-production.yml/runs?head_sha=${sha}&branch=main&event=push&per_page=5`,{headers:{Accept:'application/vnd.github+json','User-Agent':'NeighborhoodGarage-release'}});
  // Workflow_dispatch and PR results cannot authorize a push-triggered production build.
  const run=result.workflow_runs?.filter(r=>r.head_sha===sha&&r.head_branch==='main'&&r.event==='push').sort((a,b)=>b.run_number-a.run_number||b.run_attempt-a.run_attempt)[0];
  if(run?.status==='completed'){
   if(run.conclusion!=='success')throw Error(`Release stopped: validation for ${sha} ${run.conclusion}.`);
   await backend();return {sha,backendVersion,validationRun:run.id};
  }
  if(attempt+1<attempts){if(attempt===0)console.log('Waiting for GitHub validation of this exact production commit…');await wait(20000);}
 }
 throw Error('Release stopped: this exact commit has no completed successful production validation.');
}

export async function releaseGate(){
 const release=JSON.parse(readFileSync(new URL('../release-policy.json',import.meta.url),'utf8'));
 const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 if(execFileSync('git',['status','--porcelain','--untracked-files=no'],{encoding:'utf8'}).trim())throw Error('Release stopped: tracked source differs from the validated commit.');
 if(process.env.NG_RELEASE_BACKEND_VERSION||process.env.NG_RELEASE_VALIDATED_SHA){
  if(process.env.NG_RELEASE_BACKEND_VERSION!==release.backendVersion)throw Error('Release stopped: backend version has not been attested. See docs/RELEASE-CONTROLS.md.');
  if(process.env.NG_RELEASE_VALIDATED_SHA!==sha)throw Error('Release stopped: this exact source commit has no validation attestation.');
  return {sha,backendVersion:release.backendVersion};
 }
 // Native Cloudflare Builds retain automatic deployment, but wait for all CI checks
 // and query the public backend version rather than trusting an unset dashboard flag.
 return verifyHostedRelease({sha,backendVersion:release.backendVersion});
}
