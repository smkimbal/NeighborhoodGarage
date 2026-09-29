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
export function badgesFor({listed=0,borrowed=0,lent=0,rating=0,reviewCount=0}){
  return [
    {name:'Open garage',icon:'🧰',earned:listed>=1,progress:`${listed}/1 tools listed`,description:'Share your first tool.'},
    {name:'Good neighbor',icon:'🤝',earned:borrowed>=1,progress:`${borrowed}/1 rentals completed`,description:'Complete your first rental.'},
    {name:'Community lender',icon:'🌱',earned:lent>=5,progress:`${lent}/5 loans completed`,description:'Help five neighbors finish a project.'},
    {name:'Trusted owner',icon:'⭐',earned:reviewCount>=3&&rating>=4.5,progress:`${reviewCount}/3 reviews · ${rating.toFixed(1)}/4.5 stars`,description:'Earn three reviews averaging at least 4.5 stars.'},
    {name:'Neighborhood regular',icon:'🏡',earned:borrowed>=10,progress:`${borrowed}/10 rentals completed`,description:'Reuse tools across ten projects.'}
  ];
}
export function photoExtension(file){
  const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file?.type];
  if(!ext||!file.size||file.size>8*1024*1024)throw new Error('Choose a JPEG, PNG, or WebP photo under 8 MB.');
  return ext;
}
