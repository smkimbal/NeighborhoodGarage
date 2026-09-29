import {spawn} from 'node:child_process';
const children=[];
function start(cmd,args,env={}){const child=spawn(cmd,args,{stdio:'inherit',env:{...process.env,...env}});children.push(child);child.on('exit',code=>{if(code&&code!==0){shutdown();process.exit(code);}});}
start(process.execPath,['backend/server.mjs'],{NG_ALLOWED_ORIGINS:process.env.NG_ALLOWED_ORIGINS||'http://localhost:5173,http://127.0.0.1:5173'});
start('python3',['-m','http.server','5173']);
function shutdown(){for(const c of children)if(!c.killed)c.kill('SIGTERM');}
process.on('SIGINT',()=>{shutdown();process.exit(0)});process.on('SIGTERM',()=>{shutdown();process.exit(0)});
console.log('Neighborhood Garage web: http://localhost:5173  API: http://localhost:8787');
