// Administrative API credentials are supplied only on a trusted workstation.
// Default behavior prints a reviewable plan; --apply writes and verifies both rules.
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const repository='smkimbal/NeighborhoodGarage';
export async function branchProtection({apply=false,token,request=fetch}={}){
 const targets=[['main','main'],['neighborhood-garage-test','test']];
 const plan=await Promise.all(targets.map(async([branch,file])=>({branch,policy:JSON.parse(await readFile(new URL('../configuration/branch-protection-'+file+'.json',import.meta.url),'utf8'))})));
 if(!apply)return {applied:false,repository,plan};
 if(!token)throw Error('A repository Administration:write token is required in GITHUB_ADMIN_TOKEN. The connected code tool cannot write branch rules.');
 const api=async(branch,method,policy)=>{
  const response=await request('https://api.github.com/repos/'+repository+'/branches/'+branch+'/protection',{method,headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',...(policy?{'Content-Type':'application/json'}:{})},...(policy?{body:JSON.stringify(policy)}:{}),redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('Branch protection '+method+' failed for '+branch+' ('+response.status+').');
  return response.json();
 };
 const verify=(branch,actual,policy)=>{
  if(!actual.enforce_admins?.enabled||actual.allow_force_pushes?.enabled||actual.allow_deletions?.enabled)throw Error('Protection verification failed for '+branch+'.');
  if(branch==='main'){
   if(!actual.required_pull_request_reviews||!actual.required_status_checks?.strict||!actual.required_conversation_resolution?.enabled)throw Error('Main merge controls were not retained.');
   const checks=actual.required_status_checks.checks||[];
   if(!policy.required_status_checks.checks.every(wanted=>checks.some(c=>c.context===wanted.context&&c.app_id===wanted.app_id)))throw Error('Main must require both checks from GitHub Actions.');
  }
 };
 // Read both rules before any write. Never replace an existing rule: retain it if
 // it already satisfies these controls, otherwise require administrator review.
 const needed=[];
 for(const {branch,policy}of plan){
  const existing=await request('https://api.github.com/repos/'+repository+'/branches/'+branch+'/protection',{headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},redirect:'error',signal:AbortSignal.timeout(15000)});
  if(existing.status===404)needed.push({branch,policy});
  else if(existing.ok)verify(branch,await existing.json(),policy);
  else throw Error('Cannot read existing rule for '+branch+' ('+existing.status+').');
 }
 for(const {branch,policy}of needed){await api(branch,'PUT',policy);verify(branch,await api(branch,'GET'),policy);}
 return {applied:true,repository,branches:targets.map(t=>t[0])};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{console.log(JSON.stringify(await branchProtection({apply:process.argv.includes('--apply'),token:process.env.GITHUB_ADMIN_TOKEN}),null,2));}
 catch(error){console.error(error.message);process.exitCode=1;}
}
