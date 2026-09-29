export const FEE_RATE = 0.05;
export const money = cents => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format((Number(cents)||0)/100);
export function quote(rateCents, depositCents, days, creditBalanceCents=0){
  const rental = Math.max(0, Math.round(rateCents))*Math.max(1, Math.round(days));
  const fee = Math.round(rental*FEE_RATE);
  const total = rental + Math.max(0, Math.round(depositCents));
  const creditsUsed = Math.max(0, Math.min(Math.round(creditBalanceCents||0), total));
  return {rental, fee, owner:rental-fee, deposit:Math.max(0,Math.round(depositCents)), total, creditsUsed, due:total-creditsUsed};
}
export function distanceMiles(a,b){
  const r=Math.PI/180,dlat=(b.lat-a.lat)*r,dlng=(b.lng-a.lng)*r;
  return 3958.8*2*Math.asin(Math.sqrt(Math.sin(dlat/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dlng/2)**2));
}
export const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
