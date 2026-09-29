import {authenticate,checked,endpoint,HttpError} from '../_shared/runtime.ts';
Deno.serve(endpoint(async req=>{
 const {user,admin}=await authenticate(req);const {photoPath}=await req.json();
 if(typeof photoPath!=='string'||!photoPath.startsWith(user.id+'/')||photoPath.includes('..'))throw new HttpError('Upload your own tool photo first.');
 const key=Deno.env.get('OPENAI_API_KEY');if(!key)throw new HttpError('Photo cleanup is not configured. You can publish using the original photo. Add OPENAI_API_KEY to Supabase secrets to enable it.',503,'ai_not_configured');
 const photo=checked(await admin.storage.from('tool-photos').download(photoPath));
 checked(await admin.rpc('take_ai_slot',{p_user:user.id}));
 const form=new FormData();form.set('model',Deno.env.get('OPENAI_IMAGE_MODEL')||'gpt-image-1');form.set('image',photo!,'tool.'+(photo!.type==='image/png'?'png':photo!.type==='image/webp'?'webp':'jpg'));form.set('background','transparent');form.set('size','1024x1024');form.set('quality','low');form.set('prompt','Remove only the background around this tool. Preserve the exact tool, text, scratches, damage, colors, and geometry. Do not improve its apparent condition. Return a transparent product cutout.');
 const response=await fetch('https://api.openai.com/v1/images/edits',{method:'POST',headers:{Authorization:'Bearer '+key},body:form,signal:AbortSignal.timeout(90000)});
 if(!response.ok)throw new HttpError('Photo cleanup is unavailable. Keep the original photo and try later.',502,'ai_provider_error');
 const result=await response.json(),encoded=result.data?.[0]?.b64_json;if(!encoded)throw new HttpError('No cleaned image was returned.',502);
 const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)),path=`${user.id}/${crypto.randomUUID()}-cutout.png`;
 checked(await admin.storage.from('tool-photos').upload(path,bytes,{contentType:'image/png',upsert:false}));
 const preview=checked(await admin.storage.from('tool-photos').createSignedUrl(path,600));
 return {photoPath:path,previewUrl:preview!.signedUrl,notice:'AI-edited catalog image. Keep the original as condition evidence and check the cutout before publishing.'};
}));
