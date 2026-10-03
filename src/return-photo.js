// Preserve small supported originals. Resize large camera images before private storage upload.
export async function prepareReturnPhoto(file){
 if(!file?.size)throw Error('Take or choose a condition photo first.');
 if(file.size>32*1024*1024)throw Error('Choose a photo under 32 MB, or take a condition photo here.');
 const supported=['image/jpeg','image/png','image/webp'].includes(file.type);
 if(supported&&file.size<=8*1024*1024)return file;
 let bitmap;
 try{bitmap=await createImageBitmap(file);}catch{
  throw Error('This device cannot open that image. Take a condition photo here, or choose a JPEG, PNG, or WebP image.');
 }
 try{
  const scale=Math.min(1,2560/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.9));
  if(!blob?.size||blob.size>8*1024*1024)throw Error('Choose a smaller image, or take a condition photo here.');
  return new File([blob],'return-condition.jpg',{type:'image/jpeg'});
 }finally{bitmap.close();}
}
export async function captureReturnPhoto(video){
 if(!video.videoWidth||!video.videoHeight)throw Error('Wait for the camera picture before taking the photo.');
 const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;
 canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.9));
 if(!blob)throw Error('Camera capture failed. Choose a photo instead.');
 return prepareReturnPhoto(new File([blob],'return-condition.jpg',{type:'image/jpeg'}));
}
