import fs from 'node:fs';
import path from 'node:path';
import {Client,root} from './client.mjs';
const count=Number(process.argv[2]||1);
if(!Number.isSafeInteger(count)||count<1||count>100) throw Error('Invalid count');
const runs=[];
let inventory;
for(let i=0;i<count;i++){
  const item={time:new Date().toISOString(),first:false,afterRetry:false,attempts:[]};
  for(let attempt=1;attempt<=2;attempt++){
    const client=new Client();
    const start=performance.now();
    try {
      inventory=await client.initialize();
      item.attempts.push({attempt,ms:Math.round(performance.now()-start),ok:true});
      item.first=attempt===1;item.afterRetry=true;break;
    } catch(error) {
      item.attempts.push({attempt,ms:Math.round(performance.now()-start),ok:false,error:error.message});
      fs.appendFileSync(path.join(root,'reports/failure_cases.jsonl'),JSON.stringify({scope:'MCP',...item,attempt})+'\n');
    } finally {await client.close()}
  }
  runs.push(item);
}
const report={driver:'independent local STDIO client',node:process.version,runs,inventory};
const name='connection-'+Date.now()+'.json';
fs.writeFileSync(path.join(root,'reports',name),JSON.stringify(report,null,2));
console.log(JSON.stringify({name,first:runs.filter(r=>r.first).length,afterRetry:runs.filter(r=>r.afterRetry).length,count,inventory}));
if(runs.some(r=>!r.afterRetry))process.exitCode=1;

