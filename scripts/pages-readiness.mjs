import {appendFile} from 'node:fs/promises';import {pathToFileURL} from 'node:url';
export async function pagesReadiness({token,request=fetch}={}){
 if(!token)throw Error('Pages readiness requires the workflow token.');
 const response=await request('https://api.github.com/repos/smkimbal/NeighborhoodGarage/pages',{headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},redirect:'error',signal:AbortSignal.timeout(15000)});
 if(response.status===404)return {ready:false,reason:'Enable GitHub Pages with GitHub Actions as its source. The validated sandbox artifact is retained.'};
 if(!response.ok)throw Error('Pages readiness failed ('+response.status+').');
 const site=await response.json();
 if(site.cname||site.html_url?.replace(/\/$/,'')!=='https://smkimbal.github.io/NeighborhoodGarage')throw Error('Sandbox Pages must use its GitHub address, without a production custom domain.');
 if(site.build_type!=='workflow')return {ready:false,reason:'Switch GitHub Pages source to GitHub Actions before publishing. The validated sandbox artifact is retained.'};
 return {ready:true};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  if(process.env.GITHUB_REPOSITORY!=='smkimbal/NeighborhoodGarage'||process.env.GITHUB_REF!=='refs/heads/neighborhood-garage-test')throw Error('This publisher is limited to the existing sandbox branch.');
  const result=await pagesReadiness({token:process.env.GITHUB_TOKEN});
  if(process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,'ready='+result.ready+'\n');
  if(!result.ready){console.log('::warning::'+result.reason);if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,'Sandbox build validated; hosting needs setup. '+result.reason+'\n');}
  console.log(JSON.stringify(result));
 }catch(error){console.error(error.message);process.exitCode=1;}
}
