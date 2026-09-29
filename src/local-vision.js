// The original photo never leaves this device during recognition. Model weights are fetched on first use.
const toolNames=[
  [/power drill|drill|screwdriver|saw|hammer|wrench|plane|sander|vise|nail|lathe|grinder|chisel/, 'Power tools'],
  [/lawn mower|chainsaw|shovel|rake|wheelbarrow|axe|hedge trimmer|garden/, 'Garden'],
  [/ladder|paintbrush|level|tape measure|pliers/, 'Home & DIY'],
  [/car jack|tire|tyre|automotive/, 'Automotive']
];
export function suggestionForPredictions(predictions){
  const match=predictions.find(p=>p.probability>=0.12&&toolNames.some(([re])=>re.test(p.className.toLowerCase())));
  if(!match)return {notice:'The on-device model could not identify this tool reliably. Enter its details yourself; no photo was sent to a recognition service.'};
  const label=match.className.split(',')[0].trim();
  return {title:label[0].toUpperCase()+label.slice(1),category:toolNames.find(([re])=>re.test(match.className.toLowerCase()))[1],notice:`Possible match: ${label} (${Math.round(match.probability*100)}% model confidence). Check the title and category. Model number, wear, and deposit must be entered by you.`};
}
export async function classifyTool(file){
  const url=URL.createObjectURL(file);
  try{
    const image=new Image();image.src=url;await image.decode();
    const [tf,mobilenet]=await Promise.all([import('@tensorflow/tfjs'),import('@tensorflow-models/mobilenet')]);
    await tf.ready();const model=await mobilenet.load({version:2,alpha:0.5});
    return suggestionForPredictions(await model.classify(image,5));
  }finally{URL.revokeObjectURL(url);}
}

// For plain contrasting backdrops, a local canvas flood fill removes connected edge pixels.
// Complex scenes are intentionally left unchanged instead of damaging the tool image.
export async function removePhotoBackground(file){
  const bitmap=await createImageBitmap(file);const scale=Math.min(1,1200/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
  const {width:w,height:h}=canvas,frame=ctx.getImageData(0,0,w,h),data=frame.data;
  const corners=[[0,0],[w-1,0],[0,h-1],[w-1,h-1]].map(([x,y])=>{const i=(y*w+x)*4;return [data[i],data[i+1],data[i+2]]});
  const background=corners[0];if(corners.some(c=>Math.hypot(...c.map((v,i)=>v-background[i]))>42))throw new Error('Background removal works with a plain, evenly lit backdrop. Use the original for this photo.');
  const seen=new Uint8Array(w*h),queue=new Int32Array(w*h);let head=0,tail=0;
  const enqueue=p=>{if(p<0||p>=w*h||seen[p])return;seen[p]=1;const i=p*4;if(Math.hypot(data[i]-background[0],data[i+1]-background[1],data[i+2]-background[2])<48)queue[tail++]=p;};
  for(let x=0;x<w;x++){enqueue(x);enqueue((h-1)*w+x);}for(let y=0;y<h;y++){enqueue(y*w);enqueue(y*w+w-1);}
  while(head<tail){const p=queue[head++],x=p%w;data[p*4+3]=0;if(x>0)enqueue(p-1);if(x<w-1)enqueue(p+1);if(p>=w)enqueue(p-w);if(p<(h-1)*w)enqueue(p+w);}
  if(tail<w*h*.03||tail>w*h*.92)throw new Error('Could not separate the tool from its background. Use the original photo.');
  ctx.putImageData(frame,0,0);
  return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Could not prepare the photo.')),'image/png'));
}
