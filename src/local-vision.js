// Free, local recognition. Only model/worker downloads use the network; photos stay on-device.
import {labelTextForOcr, suggestionForEvidence} from './tool-identification.js';
export {suggestionForPredictions} from './tool-identification.js';
let visualModel;
async function within(promise, milliseconds) {
  let timer;
  try {return await Promise.race([promise, new Promise((_, reject) => {timer = setTimeout(() => reject(new Error('Local recognition took too long. Try a smaller, clearer label photo.')), milliseconds);})]);}
  finally {clearTimeout(timer);}
}
async function predict(image) {
  visualModel ??= (async () => {
    const [tf, mobilenet] = await Promise.all([import('@tensorflow/tfjs'), import('@tensorflow-models/mobilenet')]);
    await tf.ready();
    return mobilenet.load({version: 2, alpha: .5});
  })().catch(error => {visualModel = null; throw error;});
  return (await visualModel).classify(image, 5);
}

async function imageCanvas(file, maxSize = 1800) {
  const bitmap = await createImageBitmap(file), scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);bitmap.close();
  return canvas;
}

export async function readPhotoBarcodes(canvas) {
  if (globalThis.BarcodeDetector) {
    try {
      const formats = await BarcodeDetector.getSupportedFormats();
      if (formats.length) {
        const found = await new BarcodeDetector({formats}).detect(canvas);
        if (found.length) return found.map(value => value.rawValue);
      }
    } catch {} // A browser with no native support uses the bundled free decoder.
  }
  const zxing = await import('@zxing/library');
  // Node 22 loads the CommonJS entry through default; the browser bundle uses ESM.
  const {QRCodeReader, MultiFormatOneDReader, DataMatrixReader, RGBLuminanceSource, BinaryBitmap, HybridBinarizer, DecodeHintType, BarcodeFormat} = zxing.default || zxing;
  const frame = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
  const luminance = new Uint8ClampedArray(canvas.width * canvas.height);
  for (let i = 0; i < luminance.length; i++) luminance[i] = (frame.data[i * 4] + 2 * frame.data[i * 4 + 1] + frame.data[i * 4 + 2]) / 4;
  const bitmap = new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(luminance, canvas.width, canvas.height)));
  const hints = new Map([[DecodeHintType.TRY_HARDER, true], [DecodeHintType.POSSIBLE_FORMATS,
    [BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.ITF]]]);
  // Explicit supported readers also avoid noisy warnings for every non-barcode photo.
  for (const reader of [new QRCodeReader(), new MultiFormatOneDReader(hints), new DataMatrixReader()]) {
    try {return [reader.decode(bitmap, hints).getText()];}
    catch {} // No matching barcode is an ordinary scan outcome.
    finally {reader.reset();}
  }
  return [];
}

export async function readPhotoLabel(canvas, onProgress = () => {}) {
  const tesseract = await import('tesseract.js');
  const {createWorker, PSM} = tesseract.default || tesseract;
  const base = new URL('./assets/vision/', document.baseURI).href;
  // Worker, WASM and English data are deployed with the site, not a paid recognition API.
  let rejectInitialization, expired = false;
  const initializationError = new Promise((_, reject) => {rejectInitialization = reject;});
  const initializing = createWorker('eng', 1, {
    workerPath: base + 'worker.min.js', corePath: base + 'core/', langPath: base + 'lang',
    workerBlobURL: false, cachePath: 'ng-ocr-eng-v1', errorHandler: error => rejectInitialization(new Error(String(error))), logger: message => {
      if (message.status === 'recognizing text') onProgress(`Reading the label on this device… ${Math.round(message.progress * 100)}%`);
    }
  });
  initializing.then(worker => {if (expired) worker.terminate();}, () => {});
  let worker;
  try {
    worker = await within(Promise.race([initializing, initializationError]), 60000);
    await worker.setParameters({tessedit_pageseg_mode: PSM.SPARSE_TEXT});
    const {data} = await within(worker.recognize(canvas, {}, {text: true, blocks: true}), 60000);
    return labelTextForOcr(data);
  } finally {expired = true; await worker?.terminate();}
}

export async function classifyTool(file, {labelFile = file, onProgress = () => {}} = {}) {
  const image = await imageCanvas(file, 1000), label = labelFile === file ? await imageCanvas(file) : await imageCanvas(labelFile);
  onProgress('Checking the tool, printed label and barcode on this device…');
  // Independent engines allow a useful label draft even if visual model downloads fail.
  const results = await Promise.allSettled([within(predict(image), 30000), readPhotoLabel(label, onProgress), readPhotoBarcodes(label)]);
  const [visual, ocr, codes] = results.map(value => value.status === 'fulfilled' ? value.value : null);
  const result = suggestionForEvidence(visual || [], {text: ocr || '', barcodes: codes || []});
  results.forEach((value, index) => {if (value.status === 'rejected') console.warn(`Local ${['tool classification', 'label reading', 'barcode reading'][index]} unavailable:`, value.reason?.message || String(value.reason));});
  if (results.some(value => value.status === 'rejected')) result.notice += ' Part of the scan was unavailable. Try again with a clear label photo and an internet connection for model downloads.';
  result.notice += ' Recognition is free and runs on this device; no photo was sent to an AI service.';
  return result;
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
