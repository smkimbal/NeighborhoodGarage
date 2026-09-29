import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {decrypt,decryptJson,encrypt,identifierHash,passwordRecord,randomId} from './security.mjs';

const here=dirname(fileURLToPath(import.meta.url));
const dollars=c=>Math.round(Number(c||0))/100;
export function openDb(path=process.env.NG_DB_PATH||resolve(here,'data/neighborhood-garage.sqlite')){
  if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});
  const db=new DatabaseSync(path);db.exec(readFileSync(resolve(here,'schema.sqlite.sql'),'utf8'));seedCatalog(db);return db;
}
function seedCatalog(db){
  if(Number(db.prepare('SELECT count(*) n FROM tools').get().n)>0)return;
  const now=Date.now();
  const owners=[['seed-alex','Alex M.'],['seed-jamie','Jamie R.'],['seed-morgan','Morgan T.'],['seed-sam','Sam K.'],['seed-casey','Casey L.'],['seed-jordan','Jordan P.']];
  const addUser=db.prepare('INSERT OR IGNORE INTO users (id,channel,identifier_hash,identifier_ciphertext,password_salt,password_hash,verified_at,mfa_secret_ciphertext,mfa_enabled,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)');
  const addProfile=db.prepare('INSERT OR IGNORE INTO profiles (user_id,display_name,profile_ciphertext,created_at,updated_at) VALUES (?,?,?,?,?)');
  for(const [id,name] of owners){const p=passwordRecord(randomId()+randomId());const email=`${id}@seed.invalid`;addUser.run(id,'email',identifierHash('email',email),encrypt(email),p.salt,p.hash,now,encrypt('SEEDONLY'),1,now);addProfile.run(id,name,encrypt({displayName:name,neighborhood:'Demo neighborhood',city:'Chicago',state:'IL',bio:'Seeded neighbor account.'}),now,now);}
  const rows=[
    ['NG1001','seed-alex','20V cordless drill kit','Power tools',8,65,41.884,-87.632,'Your weekend-project sidekick. Includes two batteries, charger, and a 30-piece bit set.','Light cosmetic marks on grip; fully functional.'],
    ['NG1002','seed-jamie','Electric pressure washer','Outdoor',18,120,41.88,-87.63,'Give the patio a fresh start. Includes hose and three spray nozzles.','Minor scratches on housing.'],
    ['NG1003','seed-morgan','6-foot folding ladder','Home & DIY',7,55,41.89,-87.64,'A sturdy fiberglass ladder for all those just-out-of-reach jobs.','Paint spots on steps; hinges intact.'],
    ['NG1004','seed-sam','Random orbital sander','Power tools',9,70,41.875,-87.625,'Smooth out your next furniture project. Dust bag included; bring your own sanding discs.','Normal wear on sanding pad.'],
    ['NG1005','seed-casey','Garden hand tool set','Garden',5,30,41.886,-87.62,'Trowel, cultivator, and pruning shears for a happy little garden.','Clean with light soil staining.'],
    ['NG1006','seed-jordan','Heavy-duty hand truck','Home & DIY',12,80,41.879,-87.642,'Make moving day a little lighter. Includes a tie-down strap.','Scuffed platform; tires in good condition.']
  ];
  const addTool=db.prepare('INSERT INTO tools (id,owner_id,title,category,description,condition,rate_cents,deposit_cents,approximate_lat,approximate_lng,photo_data,available,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
  for(const [id,owner,title,cat,rate,deposit,lat,lng,description,condition] of rows)addTool.run(id,owner,title,cat,description,condition,rate*100,deposit*100,lat,lng,null,1,now);
}
export function profileFor(db,userId){const r=db.prepare('SELECT display_name,profile_ciphertext FROM profiles WHERE user_id=?').get(userId);if(!r)return null;return {...decryptJson(r.profile_ciphertext),displayName:r.display_name};}
export function saveProfile(db,userId,p){const displayName=String(p.displayName||'').trim(),neighborhood=String(p.neighborhood||'').trim(),city=String(p.city||'').trim(),state=String(p.state||'').trim(),bio=String(p.bio||'').trim();if(!displayName||!neighborhood||!city||!state)throw Error('Display name, neighborhood, city, and state are required.');if(displayName.length>60||neighborhood.length>80||city.length>80||state.length>40||bio.length>500)throw Error('Profile field is too long.');const now=Date.now(),payload={displayName,neighborhood,city,state,bio};db.prepare(`INSERT INTO profiles (user_id,display_name,profile_ciphertext,created_at,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET display_name=excluded.display_name,profile_ciphertext=excluded.profile_ciphertext,updated_at=excluded.updated_at`).run(userId,displayName,encrypt(payload),now,now);return payload;}
export function creditsCents(db,userId){return Number(db.prepare('SELECT coalesce(sum(amount_cents),0) n FROM credit_ledger WHERE user_id=?').get(userId).n);}
function ownerName(db,ownerId){return db.prepare('SELECT display_name FROM profiles WHERE user_id=?').get(ownerId)?.display_name||'Neighbor';}
export function stateFor(db,userId){
  const profile=profileFor(db,userId),credits=creditsCents(db,userId);
  const tools=db.prepare('SELECT * FROM tools ORDER BY created_at,id').all().map(t=>({id:t.id,title:t.title,category:t.category,rate:dollars(t.rate_cents),deposit:dollars(t.deposit_cents),owner:t.owner_id===userId?'You':ownerName(db,t.owner_id),ownerId:t.owner_id,rating:5,lat:t.approximate_lat,lng:t.approximate_lng,photo:t.photo_data||undefined,icon:'🛠️',color:'mint',description:t.description,condition:t.condition,available:!!t.available}));
  const rentals=db.prepare(`SELECT r.*,t.owner_id,t.title tool_title FROM rentals r JOIN tools t ON t.id=r.tool_id WHERE r.renter_id=? OR t.owner_id=? ORDER BY r.created_at DESC`).all(userId,userId).map(r=>({id:r.id,toolId:r.tool_id,toolTitle:r.tool_title,days:r.days,rental:dollars(r.rental_cents),deposit:dollars(r.deposit_cents),fee:dollars(r.fee_cents),credits:dollars(r.credits_used_cents),due:dollars(r.amount_due_cents),status:r.status,role:r.renter_id===userId?'renter':'owner',returnPhoto:r.return_photo_ciphertext?decrypt(r.return_photo_ciphertext):undefined,assessment:r.assessment_json?JSON.parse(r.assessment_json):undefined,method:r.handoff_method,created:r.created_at}));
  const messageRows=db.prepare('SELECT * FROM messages WHERE sender_id=? OR recipient_id=? ORDER BY created_at').all(userId,userId);
  const messages=messageRows.map(m=>{const other=m.sender_id===userId?m.recipient_id:m.sender_id;return {id:m.id,peer:ownerName(db,other),from:m.sender_id===userId?'You':ownerName(db,m.sender_id),text:decrypt(m.ciphertext),time:m.created_at};});
  const reviews=db.prepare('SELECT * FROM reviews WHERE author_id=? ORDER BY created_at DESC').all(userId).map(r=>({rentalId:r.rental_id,rating:r.rating,text:r.body}));
  return {account:{id:userId},profile,profileComplete:!!profile,credits:dollars(credits),tools,rentals,messages,reviews};
}
export function publicProfileIdByName(db,name){return db.prepare('SELECT user_id FROM profiles WHERE display_name=? COLLATE NOCASE').get(String(name||'').trim())?.user_id||null;}
