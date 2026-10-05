// Screening runs on submission, never on each keystroke. Only five hash characters
// leave the device; passwords and complete hashes are never logged or retained.
export async function checkNewPassword(password,{request=fetch,cryptoApi=crypto}={}){
 if(typeof password!=='string'||[...password].length<12)throw Error('Use at least 12 characters. A unique passphrase or password manager is a good choice.');
 if(new TextEncoder().encode(password).length>128)throw Error('Use a password of at most 128 UTF-8 bytes.');
 let hash,body;
 try{
  const bytes=await cryptoApi.subtle.digest('SHA-1',new TextEncoder().encode(password));
  hash=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('').toUpperCase();
  const response=await request('https://api.pwnedpasswords.com/range/'+hash.slice(0,5),{headers:{'Add-Padding':'true'},credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000)});
  if(response.status!==200)throw Error('Unavailable');
  body=await response.text();
  if(body.length>200000||!body.trim())throw Error('Invalid response');
  const rows=body.trim().split(/\r?\n/);
  if(!rows.every(row=>/^[A-Fa-f0-9]{35}:\d+$/.test(row)))throw Error('Invalid response');
  if(rows.some(row=>{const [suffix,count]=row.split(':');return suffix.toUpperCase()===hash.slice(5)&&Number(count)>0;}))throw Object.assign(Error('This password has appeared in a known data breach. Choose a different, unique password.'),{code:'breached_password'});
 }catch(error){
  if(error.code==='breached_password')throw error;
  throw Error('Password screening is temporarily unavailable. Please retry before saving a new password.');
 }finally{hash=undefined;body=undefined;}
}
