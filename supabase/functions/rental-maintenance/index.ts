import {adminClient,checked,endpoint,HttpError,stripeClient} from '../_shared/runtime.ts';
import {reconcileRentals} from '../_shared/reconcile-rentals.ts';

Deno.serve(endpoint(async req=>{
 const token=req.headers.get('x-rental-maintenance-token');
 if(!token)throw new HttpError('Maintenance authentication required.',401);
 const admin=adminClient();
 if(checked(await admin.rpc('rental_maintenance_authorized',{p_token:token}))!==true)throw new HttpError('Maintenance authentication required.',401);
 return reconcileRentals(admin,stripeClient());
}));
