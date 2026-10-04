import {prepareReturnPhoto} from './return-photo.js';
export async function uploadPhoto(invoke,file,{kind='tool',rentalId=null,preserveAlpha=false}={}){
 const photo=await prepareReturnPhoto(file,{preserveAlpha});
 const body=new FormData();body.set('photo',photo);body.set('kind',kind);
 if(rentalId)body.set('rentalId',rentalId);
 const result=await invoke('upload-photo',body);return result.path;
}
