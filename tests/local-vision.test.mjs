import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {suggestionForPredictions,readPhotoBarcodes} from '../src/local-vision.js';
import QRCode from 'qrcode';
import {suggestionForEvidence, readLabelEvidence, labelTextForOcr, applySuggestionToDraft} from '../src/tool-identification.js';

test('on-device classifier suggests a broad category but never invents condition or price',()=>{
  const result=suggestionForPredictions([{className:'power drill',probability:0.86}]);
  assert.equal(result.title,'Power drill');
  assert.equal(result.category,'Power tools');
  assert.equal(result.deposit_cents,undefined);
  assert.equal(result.condition,undefined);
});

test('uncertain or unrelated images leave listing fields untouched',()=>{
  assert.equal(suggestionForPredictions([{className:'computer keyboard',probability:0.91}]).title,undefined);
  assert.equal(suggestionForPredictions([{className:'saw',probability:0.04}]).title,undefined);
});

test('label evidence adds brand, model and a useful description without inventing specifications',()=>{
 const result=suggestionForEvidence([{className:'power drill',probability:.86}],{text:'DEWALT\nMODEL NO. DCD771\nSERIAL: SECRET123'});
 assert.equal(result.title,'DEWALT Power drill');
 assert.equal(result.model,'DCD771');
 assert.match(result.description,/drilling holes and driving fasteners/);
 assert.match(result.description,/DCD771/);
 assert.ok(!result.description.includes('SECRET123'));
 for(const key of ['condition','deposit_cents','rate_cents','voltage','batteryIncluded'])assert.equal(result[key],undefined);
});

test('numeric barcodes and unlabeled part numbers do not guess a brand or tool type',()=>{
 const result=suggestionForEvidence([],{text:'DCD771',barcodes:['012345678905']});
 assert.equal(result.brand,null);assert.equal(result.title,undefined);assert.equal(result.description,undefined);
 assert.deepEqual(result.barcodes,['012345678905']);
 assert.match(result.notice,/numeric barcode alone/);
});

test('branded barcode content can identify a manufacturer and model locally',()=>{
 const result=readLabelEvidence('', ['https://www.dewalt.com/product/dcd771/drill']);
 assert.equal(result.brand,'DEWALT');assert.equal(result.model,'DCD771');
 const json=readLabelEvidence('', ['{"brand":"Makita","model":"XFD131"}']);
 assert.equal(json.brand,'Makita');assert.equal(json.model,'XFD131');
 assert.equal(readLabelEvidence('', ['https://dewalt.com.untrusted.example/product/dcd771']).brand,null);
 assert.equal(readLabelEvidence('', ['javascript:DEWALT']).brand,null);
});

test('conflicting and low-confidence label reads leave uncertain fields unfilled',()=>{
 const label=readLabelEvidence('DEWALT MODEL DCD771\nMakita MODEL XFD131');
 assert.equal(label.brand,null);assert.equal(label.model,null);assert.equal(label.ambiguous,true);
 assert.equal(labelTextForOcr({text:'DEWALT MODEL DCD771',confidence:20}),'');
 assert.equal(labelTextForOcr({blocks:[{paragraphs:[{lines:[{words:[{text:'DEWALT',confidence:90},{text:'XFD131',confidence:12}]}]}]}]}),'DEWALT');
});

test('descriptions can use a readable tool label when the visual model is unavailable',()=>{
 const result=suggestionForEvidence([],{text:'Makita\nPOWER DRILL\nP/N: XFD131'});
 assert.equal(result.title,'Makita Power drill');assert.equal(result.category,'Power tools');
 assert.match(result.description,/XFD131/);
 assert.equal(suggestionForEvidence([{className:'airplane',probability:.94}]).title,undefined);
});

test('repeat identification improves untouched drafts and preserves the owner’s edits',()=>{
 const previous={title:'Power drill',description:'A drill.',category:'Power tools'};
 const suggestion={title:'DEWALT Power drill',description:'DEWALT drill. Model DCD771.',category:'Power tools'};
 assert.equal(applySuggestionToDraft(previous,suggestion,{previous}).description,suggestion.description);
 const edited={title:'My trusty drill',description:'Includes my own bit set.',category:'Home & DIY'};
 assert.deepEqual(applySuggestionToDraft(edited,suggestion,{previous,categoryTouched:true}),edited);
});

function barcodeCanvas(width,height,isBlack){
 const data=new Uint8ClampedArray(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const offset=(y*width+x)*4,value=isBlack(x,y)?0:255;
  data[offset]=data[offset+1]=data[offset+2]=value;data[offset+3]=255;
 }
 return {width,height,getContext:()=>({getImageData:()=>({data})})};
}

test('the free fallback actually decodes a branded QR photo without a native detector',async()=>{
 const value='https://www.dewalt.com/product/dcd771/drill';
 const qr=QRCode.create(value),scale=5,margin=4,width=(qr.modules.size+2*margin)*scale;
 const canvas=barcodeCanvas(width,width,(x,y)=>{
  const row=Math.floor(y/scale)-margin,col=Math.floor(x/scale)-margin;
  return row>=0&&col>=0&&row<qr.modules.size&&col<qr.modules.size&&qr.modules.get(row,col);
 });
 const decoded=await readPhotoBarcodes(canvas);
 assert.deepEqual(decoded,[value]);
 assert.equal(readLabelEvidence('',decoded).brand,'DEWALT');
});

test('the free fallback reads a UPC photo while leaving the brand unknown',async()=>{
 const left=['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
 const upc='036000291452'; // Valid, fixed test identifier; no product lookup is performed.
 const right=left.map(pattern=>pattern.replace(/[01]/g,bit=>bit==='1'?'0':'1'));
 const bits='101'+[...upc.slice(0,6)].map(d=>left[Number(d)]).join('')+'01010'+[...upc.slice(6)].map(d=>right[Number(d)]).join('')+'101';
 const scale=4,margin=12,width=(bits.length+2*margin)*scale;
 const canvas=barcodeCanvas(width,150,(x,y)=>y>=12&&y<138&&bits[Math.floor(x/scale)-margin]==='1');
 const decoded=await readPhotoBarcodes(canvas);
 assert.equal(decoded.length,1);assert.match(decoded[0],/^0?036000291452$/);
 assert.equal(readLabelEvidence('',decoded).brand,null);
});
