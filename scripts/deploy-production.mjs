import {spawnSync} from 'node:child_process';
import {releaseGate} from './release-gate.mjs';
const args=process.argv.slice(2);
if(args.length===1&&args[0]==='--dry-run'){
 const result=spawnSync('node_modules/.bin/wrangler',['deploy','--dry-run'],{stdio:'inherit'});if(result.error)throw result.error;process.exit(result.status??1);
}
if(args.length)throw Error('Unsupported deployment override.');
await releaseGate();
const result=spawnSync('node_modules/.bin/wrangler',['deploy'],{stdio:'inherit'});if(result.error)throw result.error;process.exit(result.status??1);
