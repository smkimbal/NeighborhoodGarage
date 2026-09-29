import {Buffer} from 'node:buffer';

async function jsonFetch(url,options={}){const r=await fetch(url,options);const text=await r.text();let body;try{body=JSON.parse(text);}catch{body={raw:text};}if(!r.ok)throw Error(body?.error?.message||body?.message||`Provider request failed (${r.status})`);return body;}
export async function sendVerification({channel,identifier,code}){
  if(channel==='email'&&process.env.RESEND_API_KEY&&process.env.RESEND_FROM){
    await jsonFetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.RESEND_FROM,to:[identifier],subject:'Your Neighborhood Garage verification code',text:`Your Neighborhood Garage verification code is ${code}. It expires in 10 minutes.`})});
    return {provider:'resend'};
  }
  if(channel==='phone'&&process.env.TWILIO_ACCOUNT_SID&&process.env.TWILIO_AUTH_TOKEN&&process.env.TWILIO_FROM){
    const form=new URLSearchParams({To:identifier,From:process.env.TWILIO_FROM,Body:`Neighborhood Garage verification code: ${code}. Expires in 10 minutes.`});
    await jsonFetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(process.env.TWILIO_ACCOUNT_SID)}/Messages.json`,{method:'POST',headers:{Authorization:`Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,'Content-Type':'application/x-www-form-urlencoded'},body:form});
    return {provider:'twilio'};
  }
  if(process.env.NODE_ENV==='production')throw Error(`No ${channel} verification provider is configured.`);
  console.log(`[Neighborhood Garage dev verification] ${channel} ${identifier}: ${code}`);
  return {provider:'development',devCode:code};
}
export async function analyzeToolPhoto(photo,{stage='baseline'}={}){
  if(!photo||!/^data:image\/(jpeg|png|webp);base64,/.test(photo))throw Error('A JPG, PNG, or WebP data URL is required.');
  if(!process.env.OPENAI_API_KEY){
    if(process.env.NODE_ENV==='production'&&process.env.NG_ALLOW_SIMULATED_PROVIDERS!=='true')throw Error('AI provider is not configured.');
    return {title:'20V cordless drill kit',category:'Power tools',deposit:65,description:'Includes accessories shown in the photo. Review details before publishing.',condition:stage==='return'?'No obvious structural damage in development-mode assessment.':'Normal cosmetic wear in development-mode assessment.',damage:false,part:'DEV-20V',serial:'Unverified',background:'Development-mode result; configure OPENAI_API_KEY for image analysis.',provider:'development'};
  }
  const model=process.env.OPENAI_MODEL||'gpt-5.6-luna';
  const prompt=`Analyze this ${stage} tool photo for a neighborhood rental marketplace. Return ONLY compact JSON with keys title, category, deposit, description, condition, damage, part, serial, background. category must be one of Power tools, Outdoor, Home & DIY, Garden. deposit is a reasonable USD number. damage is boolean. Be conservative: visual uncertainty must be stated and suspected damage must require human review.`;
  const body={model,input:[{role:'user',content:[{type:'input_text',text:prompt},{type:'input_image',image_url:photo}]}]};
  const r=await jsonFetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const text=r.output_text||r.output?.flatMap(x=>x.content||[]).find(x=>x.type==='output_text')?.text;
  if(!text)throw Error('AI provider returned no text output.');
  const cleaned=text.trim().replace(/^```json\s*/i,'').replace(/```$/,'').trim();
  const parsed=JSON.parse(cleaned);return {...parsed,provider:'openai',model};
}
export async function authorizePayment({amountCents,rentalId,userId}){
  if(amountCents<=0)return {reference:'credits_only',status:'succeeded'};
  if(!process.env.STRIPE_SECRET_KEY){
    if(process.env.NODE_ENV==='production'&&process.env.NG_ALLOW_SIMULATED_PROVIDERS!=='true')throw Error('Payment provider is not configured.');
    return {reference:`dev_${rentalId}`,status:'succeeded',simulated:true};
  }
  const paymentMethod=process.env.STRIPE_TEST_PAYMENT_METHOD;
  if(!paymentMethod)throw Error('Stripe is configured, but STRIPE_TEST_PAYMENT_METHOD is missing. Use a hosted checkout/payment-method flow before production.');
  const form=new URLSearchParams({amount:String(amountCents),currency:'usd','automatic_payment_methods[enabled]':'true','automatic_payment_methods[allow_redirects]':'never',confirm:'true',payment_method:paymentMethod,'metadata[rental_id]':rentalId,'metadata[user_id]':userId});
  const r=await jsonFetch('https://api.stripe.com/v1/payment_intents',{method:'POST',headers:{Authorization:`Bearer ${process.env.STRIPE_SECRET_KEY}`,'Content-Type':'application/x-www-form-urlencoded'},body:form});
  if(!['succeeded','requires_capture'].includes(r.status))throw Error(`Stripe payment is ${r.status}.`);
  return {reference:r.id,status:r.status};
}
