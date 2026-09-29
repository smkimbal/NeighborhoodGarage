import {createCipheriv,createDecipheriv,createHash,createHmac,randomBytes,randomInt,randomUUID,scryptSync,timingSafeEqual} from 'node:crypto';

const DEV_KEY = createHash('sha256').update('neighborhood-garage-dev-only-change-me').digest();
export function masterKey(){
  if(process.env.NG_MASTER_KEY){const b=Buffer.from(process.env.NG_MASTER_KEY,'base64');if(b.length!==32)throw Error('NG_MASTER_KEY must be a base64-encoded 32-byte key.');return b;}
  if(process.env.NODE_ENV==='production')throw Error('NG_MASTER_KEY is required in production.');
  return DEV_KEY;
}
export function normalizeIdentifier(channel,value){
  let v=String(value||'').trim();
  if(channel==='email'){v=v.toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))throw Error('Enter a valid email address.');return v;}
  if(channel==='phone'){v=v.replace(/[\s().-]/g,'');if(!/^\+?[1-9]\d{7,14}$/.test(v))throw Error('Enter a valid phone number with country code.');return v.startsWith('+')?v:'+'+v;}
  throw Error('Verification channel must be email or phone.');
}
export const sha256=v=>createHash('sha256').update(String(v)).digest('hex');
export const identifierHash=(channel,value)=>sha256(`${channel}:${normalizeIdentifier(channel,value)}`);
export function passwordRecord(password){if(typeof password!=='string'||password.length<12||password.length>256)throw Error('Password must be 12–256 characters.');const salt=randomBytes(16);const hash=scryptSync(password,salt,32);return {salt:salt.toString('base64'),hash:hash.toString('base64')};}
export function verifyPassword(password,saltB64,hashB64){try{const salt=Buffer.from(saltB64,'base64'),expected=Buffer.from(hashB64,'base64'),actual=scryptSync(password,salt,expected.length);return expected.length===actual.length&&timingSafeEqual(expected,actual);}catch{return false;}}
export function encrypt(value,key=masterKey()){const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,nonce);const raw=Buffer.from(typeof value==='string'?value:JSON.stringify(value));const ciphertext=Buffer.concat([cipher.update(raw),cipher.final()]),tag=cipher.getAuthTag();return [nonce,tag,ciphertext].map(x=>x.toString('base64url')).join('.');}
export function decrypt(payload,key=masterKey()){const [n,t,c]=String(payload||'').split('.');if(!n||!t||!c)throw Error('Invalid encrypted payload.');const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(n,'base64url'));decipher.setAuthTag(Buffer.from(t,'base64url'));return Buffer.concat([decipher.update(Buffer.from(c,'base64url')),decipher.final()]).toString();}
export function decryptJson(payload){return JSON.parse(decrypt(payload));}
export function codeHash(userId,code,key=masterKey()){return createHmac('sha256',key).update(`${userId}:${code}`).digest('hex');}
export function randomCode(){return String(randomInt(0,1_000_000)).padStart(6,'0');}
export function sessionToken(){return randomBytes(32).toString('base64url');}
export function randomId(){return randomUUID();}
export function parseCookies(header=''){return Object.fromEntries(String(header).split(';').map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.indexOf('=');return i<0?[x,'']:[x.slice(0,i),decodeURIComponent(x.slice(i+1))];}));}
export function sessionCookie(token,{clear=false}={}){const secure=process.env.NODE_ENV==='production'||process.env.NG_COOKIE_SECURE==='true';const sameSite=process.env.NG_COOKIE_SAMESITE||'Lax';return `ng_session=${clear?'':encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=${sameSite}${secure?'; Secure':''}; Max-Age=${clear?0:60*60*24*7}`;}
const B32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32Encode(buf){let bits='',out='';for(const b of buf)bits+=b.toString(2).padStart(8,'0');for(let i=0;i<bits.length;i+=5)out+=B32[parseInt(bits.slice(i,i+5).padEnd(5,'0'),2)];return out;}
export function base32Decode(s){let bits='';for(const ch of String(s).replace(/=+$/,'').toUpperCase()){const i=B32.indexOf(ch);if(i<0)throw Error('Invalid base32 secret.');bits+=i.toString(2).padStart(5,'0');}const bytes=[];for(let i=0;i+8<=bits.length;i+=8)bytes.push(parseInt(bits.slice(i,i+8),2));return Buffer.from(bytes);}
export function newTotpSecret(){return base32Encode(randomBytes(20));}
export function totp(secret,time=Date.now(),step=30,digits=6){const counter=Math.floor(time/1000/step);const b=Buffer.alloc(8);b.writeBigUInt64BE(BigInt(counter));const h=createHmac('sha1',base32Decode(secret)).update(b).digest();const o=h[h.length-1]&15;const n=(h.readUInt32BE(o)&0x7fffffff)%10**digits;return String(n).padStart(digits,'0');}
export function verifyTotp(secret,code,time=Date.now()){const c=String(code||'').trim();if(!/^\d{6}$/.test(c))return false;return [-1,0,1].some(w=>{const candidate=totp(secret,time+w*30_000);return timingSafeEqual(Buffer.from(candidate),Buffer.from(c));});}
export function otpauthUri(secret,label='Neighborhood Garage',issuer='Neighborhood Garage'){return `otpauth://totp/${encodeURIComponent(label)}?secret=${encodeURIComponent(secret)}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;}
export function publicError(message,status=400,code='BAD_REQUEST'){const e=Error(message);e.status=status;e.code=code;return e;}
