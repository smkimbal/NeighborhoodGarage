import {authenticate,checked,endpoint,HttpError} from '../_shared/runtime.ts';
import {sanitizeImage} from '../_shared/image-safety.ts';
Deno.serve(endpoint(async req=>{
 const {user,admin}=await authenticate(req);if(Number(req.headers.get('content-length')||0)>9*1024*1024)throw new HttpError('Photo upload is too large.',413);const body=await boundedForm(req),file=body.get('photo'),kind=body.get('kind'),rentalId=body.get('rentalId');
 if(!(file instanceof File)||!['tool','return'].includes(String(kind)))throw new HttpError('Choose a tool or return photo.');
 if(file.size>8388608)throw new HttpError('Photo upload is too large.',413);
 if(kind==='return'){
 const r=checked<any>(await admin.from('rentals').select('owner_id,renter_id').eq('id',rentalId).single());if(![r.owner_id,r.renter_id].includes(user.id))throw new HttpError('Rental unavailable.',404);
 }
 const image=sanitizeImage(new Uint8Array(await file.arrayBuffer())),bucket=kind==='tool'?'tool-photos':'return-photos';
 checked(await admin.rpc('check_photo_quota',{p_user:user.id}));
 const path=user.id+'/'+(kind==='return'?rentalId+'/':'')+crypto.randomUUID()+(image.type==='image/png'?'.png':'.jpg');
 checked(await admin.storage.from(bucket).upload(path,image.bytes,{contentType:image.type,upsert:false}));return {path};
}));

async function boundedForm(req:Request){
 if(!req.body)throw new HttpError('Photo is missing.');
 const reader=req.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>9*1024*1024){await reader.cancel();throw new HttpError('Photo upload is too large.',413);}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.byteLength;}
 return new Response(bytes,{headers:{'Content-Type':req.headers.get('content-type')||''}}).formData();
}
