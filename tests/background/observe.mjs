import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {root} from '../connection/client.mjs';
export async function observe(profile){
  const proc=spawn('pwsh.exe',['-NoProfile','-NonInteractive','-File',path.join(root,'tests/background/observe.ps1'),'-Profile',profile],{windowsHide:true,stdio:['ignore','pipe','pipe']});
  let current,record=false,stopping=false,dead=false,samples=0,focusGains=0;
  const transitions=[];
  proc.stderr.resume();
  proc.on('error',()=>{dead=true});
  proc.on('exit',()=>{dead=true});
  createInterface({input:proc.stdout}).on('line',line=>{
    if(!['minimized','covered','foreground'].includes(line))return;
    if(record){
      samples++;
      if(line!==current){transitions.push({time:new Date().toISOString(),state:line});if(line==='foreground')focusGains++}
    }
    current=line;
  });
  for(let i=0;i<100&&!current&&!dead;i++)await delay(100);
  return {
    async waitFor(mode){console.log('Waiting for user window state:',mode);for(let i=0;i<1200&&!dead;i++){if(current===mode)return;await delay(100)}throw Error('WINDOW_STATE_NOT_CONFIRMED')},
    begin(){record=true;if(current){samples=1;transitions.push({time:new Date().toISOString(),state:current})}},
    summary(){return {intervalMs:100,samples,focusGains:samples?focusGains:null,transitions,observerLost:dead&&!stopping,physicalInput:'requires user observation'}},
    valid(mode){return samples>0&&!this.summary().observerLost&&transitions.every(t=>t.state===mode)},
    async stop(){if(!stopping){record=false;stopping=!dead;proc.kill()}}
  };
}

