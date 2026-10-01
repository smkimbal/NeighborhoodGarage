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
    {name:'Tool explorer',icon:'🧭',earned:borrowed>=3,progress:`${borrowed}/3 rentals completed`,description:'Borrow three times.'},
    {name:'Project regular',icon:'🔨',earned:borrowed>=5,progress:`${borrowed}/5 rentals completed`,description:'Finish five borrowed projects.'},
    {name:'Helpful lender',icon:'🌻',earned:lent>=1,progress:`${lent}/1 loans completed`,description:'Help your first neighbor finish a project.'},
    {name:'Full tool shelf',icon:'🗄️',earned:listed>=3,progress:`${listed}/3 tools listed`,description:'Offer three tools to the neighborhood.'},
    {name:'Community lender',icon:'🌱',earned:lent>=5,progress:`${lent}/5 loans completed`,description:'Help five neighbors finish a project.'},
    {name:'Trusted owner',icon:'⭐',earned:reviewCount>=3&&rating>=4.5,progress:`${reviewCount}/3 reviews · ${rating.toFixed(1)}/4.5 stars`,description:'Earn three reviews averaging at least 4.5 stars.'},
    {name:'Neighborhood regular',icon:'🏡',earned:borrowed>=10,progress:`${borrowed}/10 rentals completed`,description:'Reuse tools across ten projects.'},
    {name:'Garage mentor',icon:'🏆',earned:lent>=10,progress:`${lent}/10 loans completed`,description:'Complete ten neighbor loans.'},
    {name:'Neighborhood favorite',icon:'💛',earned:reviewCount>=10&&rating>=4.8,progress:`${reviewCount}/10 reviews · ${rating.toFixed(1)}/4.8 stars`,description:'Earn ten excellent renter reviews.'}
  ];
}
export function featuredBadge(metrics){
  return [...badgesFor(metrics)].reverse().find(b=>b.earned)||null;
}
export function photoExtension(file){
  const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file?.type];
  if(!ext||!file.size||file.size>8*1024*1024)throw new Error('Choose a JPEG, PNG, or WebP photo under 8 MB.');
  return ext;
}
