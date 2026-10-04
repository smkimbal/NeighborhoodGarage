/** Keep provider failures actionable; Supabase's default FunctionsHttpError hides the response body. */
export async function invokeFunction(client, name, body) {
  const {data,error}=await client.functions.invoke(name,{body});
  if(error){
    let payload;
    try { payload=await error.context?.clone().json(); } catch { /* network/non-JSON response */ }
    const message=payload?.error||payload?.message||error.message||'Service unavailable. Please retry.';
    throw new Error(message+(payload?.requestId?` (Reference: ${payload.requestId})`:''));
  }
  if(data?.error)throw new Error(data.error);
  return data;
}
export {badgesFor,featuredBadge} from './reputation.js';
export function photoExtension(file){
  const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file?.type];
  if(!ext||!file.size||file.size>8*1024*1024)throw new Error('Choose a JPEG, PNG, or WebP photo under 8 MB.');
  return ext;
}
