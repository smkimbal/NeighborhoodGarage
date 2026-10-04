import {HttpError} from './runtime.ts';
// Strip metadata structurally, reject unsupported/truncated containers and trailing payloads.
export function sanitizeImage(bytes:Uint8Array):{bytes:Uint8Array,type:string}{
 const fail=()=>{throw new HttpError('Upload a valid JPEG or PNG photo under 8 MB.');};
 if(bytes.length<12||bytes.length>8388608)fail();const parts:Uint8Array[]=[];
 const join=()=>{const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let at=0;for(const p of parts){out.set(p,at);at+=p.length;}return out;};
 if(bytes[0]===255&&bytes[1]===216){
  parts.push(bytes.slice(0,2));let at=2,sawFrame=false,sawScan=false;
  while(at<bytes.length){
   if(bytes[at]!==255)fail();while(bytes[at+1]===255)at++;
   const marker=bytes[at+1];
   if(marker===217){if(!sawFrame||!sawScan||at+2!==bytes.length)fail();parts.push(bytes.slice(at,at+2));return {bytes:join(),type:'image/jpeg'};}
   if(marker===0||marker===216||at+4>bytes.length)fail();
   const length=(bytes[at+2]<<8)|bytes[at+3];if(length<2||at+2+length>bytes.length)fail();
   if([192,193,194].includes(marker)){if(length<8)fail();const h=(bytes[at+5]<<8)|bytes[at+6],w=(bytes[at+7]<<8)|bytes[at+8];if(!w||!h||w*h>25000000)fail();sawFrame=true;}
   if(!(marker>=224&&marker<=239)&&marker!==254)parts.push(bytes.slice(at,at+2+length));at+=length+2;
   if(marker===218){
    if(!sawFrame)fail();sawScan=true;const start=at;
    // Entropy-coded bytes use FF00 escaping and may contain restart markers.
    while(at<bytes.length){if(bytes[at]!==255){at++;continue;}const next=bytes[at+1];if(next===0||(next>=208&&next<=215)){at+=2;continue;}break;}
    parts.push(bytes.slice(start,at));
   }
  }fail();
 }

 const sig=[137,80,78,71,13,10,26,10];if(sig.some((b,i)=>bytes[i]!==b))fail();parts.push(bytes.slice(0,8));const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let at=8,header=false,data=false;
 while(at+12<=bytes.length){const size=view.getUint32(at),name=String.fromCharCode(...bytes.slice(at+4,at+8));if(size>8388608||at+12+size>bytes.length)fail();
 if(name==='IHDR'){if(header||at!==8||size!==13)fail();const w=view.getUint32(at+8),h=view.getUint32(at+12);if(!w||!h||w*h>25000000)fail();header=true;}
 if(!header)fail();if(name==='IDAT')data=true;
 if(['IHDR','PLTE','IDAT','IEND','tRNS'].includes(name))parts.push(bytes.slice(at,at+size+12));else if(name[0]===name[0].toUpperCase())fail();
 at+=size+12;if(name==='IEND'){if(!data||size!==0||at!==bytes.length)fail();return {bytes:join(),type:'image/png'};}
 }return fail();
}
