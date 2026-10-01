// Set NG_DEPLOY_TARGET=production on the separate production project only.
export function allowedOrigins(target:string|undefined) {
 if(target==='production') return new Set(['https://neighborhoodgarage.net']);
 if(target && target!=='sandbox') throw new Error('Unknown NG_DEPLOY_TARGET');
 return new Set(['https://smkimbal.github.io','http://localhost:5173','http://127.0.0.1:5173','http://localhost:3000','http://127.0.0.1:3000']);
}
