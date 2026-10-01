import {authenticate,endpoint,HttpError} from '../_shared/runtime.ts';
// Deliberately no external photo processing until the project owner approves the provider.
Deno.serve(endpoint(async req=>{
 await authenticate(req);
 throw new HttpError('AI photo processing is awaiting project-owner approval to send tool images to OpenAI. You can enter details manually and publish the original photo.',503,'ai_approval_required');
}));
