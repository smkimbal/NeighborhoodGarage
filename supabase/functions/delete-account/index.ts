import {authenticate,checked,endpoint,HttpError} from '../_shared/runtime.ts';
Deno.serve(endpoint(async req=>{
 const {user,admin,client}=await authenticate(req);
 const body=await req.json();
 if(body.confirmation!=='DELETE'||typeof body.password!=='string'||!body.password)throw new HttpError('Enter your password and type DELETE to permanently delete this account.');
 if(!user.email)throw new HttpError('Email account verification is required.');
 const proof=await client.auth.signInWithPassword({email:user.email,password:body.password});
 if(proof.error||proof.data.user?.id!==user.id)throw new HttpError('Password confirmation failed.',403);
 await client.auth.signOut({scope:'local'});
 checked(await admin.rpc('begin_account_deletion',{p_user:user.id}));
 // Storage API removes physical objects as well as metadata. Never delete storage rows through SQL.
 for(const bucket of ['tool-photos','return-photos','avatars']){
  const storage=admin.storage.from(bucket);
  const removeFolder=async(prefix:string):Promise<void>=>{
   for(;;){
    const items=checked(await storage.list(prefix,{limit:100}));
    if(!items?.length)return;
    const files:string[]=[];
    for(const item of items){const path=prefix+'/'+item.name;if(item.id)files.push(path);else await removeFolder(path);}
    if(files.length)checked(await storage.remove(files));
   }
  };
  await removeFolder(user.id);
 }
 // Cascades remove profile, listings, messages and credits; settled receipt FKs become null.
 const deleted=await admin.auth.admin.deleteUser(user.id);
 if(deleted.error)throw new HttpError('Deletion could not finish. Your account is locked for deletion. Retry to finish removing it.',503,'deletion_pending');
 return {deleted:true};
}));
