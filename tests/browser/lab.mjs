import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {setTimeout as delay} from 'node:timers/promises';
import {Client,root,defaultConfig} from '../connection/client.mjs';
import {fixture} from '../fixtures/server.mjs';
import {observe} from '../background/observe.mjs';

const {PNG}=createRequire(import.meta.url)('playwright-core/lib/utilsBundle');
const mode=process.argv[2]||'basic';
assert(['basic','foreground','covered','minimized','minimized-core'].includes(mode));
const sameTab=mode==='minimized-core';
const requiredState=sameTab?'minimized':mode;
const repeats=sameTab?6:mode==='minimized'||mode==='covered'?5:1;
const id=Date.now().toString();
const dir=path.join(root,'runtime','tests',id);
fs.mkdirSync(dir,{recursive:true});
const cfg=JSON.parse(fs.readFileSync(defaultConfig));
cfg.browser.userDataDir=path.join(dir,'profile');
cfg.browser.launchOptions.downloadsPath=path.join(dir,'incoming');
cfg.outputDir=path.join(dir,'output');
const config=path.join(dir,'config.json');
fs.writeFileSync(config,JSON.stringify(cfg));
const lab=await fixture();
let client=new Client(config);
const rows=[];
let watcher;
const report=path.join(root,'reports','lab-'+id+'.json');
const failLog=path.join(root,'reports/failure_cases.jsonl');
const tool=(name,args)=>client.call('browser_'+name,args);
const evaluate=async fn=>(await tool('evaluate',{function:fn})).body;
const truth=async expr=>assert.match(await evaluate('() => ('+expr+')'),/^### Result\r?\ntrue\s*$/m);
const click=target=>tool('click',{target});
const type=text=>tool('type',{target:'#message',text});
const navigate=url=>tool('navigate',{url});
const snap=async()=>(await tool('snapshot')).body;
const save=()=>fs.writeFileSync(report,JSON.stringify({id,mode,node:process.version,driver:'direct local STDIO',rows,window:watcher?.summary()??null},null,2));
async function test(label,operation){
  if(sameTab && /^T\d\d$/.test(label)){
    if(['T14','T15','T16'].includes(label))return;
    if(!watcher.valid('minimized'))throw Error('MINIMIZED_WINDOW_CHANGED');
  }
  const start=performance.now();
  const row={id:label,time:new Date().toISOString(),attempt:1};
  try{await operation();row.ok=true}
  catch(error){
    row.ok=false;
    row.error=String(error.message).slice(0,650);
    fs.appendFileSync(failLog,JSON.stringify({run:id,mode,...row})+'\n');
    console.log(label,'FAIL',row.error);
  }
  row.ms=Math.round(performance.now()-start);
  rows.push(row);save();
}
async function suite(){
  await test('T01',async()=>{await navigate(lab.url);await truth('location.href === '+JSON.stringify(lab.url+'/'))});
  await test('T02',()=>truth('document.title === "Independent Browser Lab"'));
  await test('T03',()=>truth('document.body.innerText.includes("End of fixture")'));
  await test('T04',async()=>assert.match(await snap(),/heading "Independent Browser Lab"/));
  await test('T05',async()=>{await click('#increment');await truth('count.textContent === "1"')});
  await test('T06',async()=>{await type('local');await truth('message.value === "local"')});
  await test('T07',async()=>{await type('');await truth('message.value === ""')});
  await test('T08',async()=>{await type('keyboard');await tool('press_key',{key:'Enter'});await truth('document.querySelector("#result").textContent === "Saved keyboard"')});
  await test('T09',async()=>{await tool('select_option',{target:'#choice',values:['Beta']});await truth('choice.value === "Beta"')});
  await test('T10',async()=>{await click('#check');await click('#radio');await truth('check.checked && radio.checked')});
  await test('T11',async()=>{await evaluate('() => document.querySelector("footer").scrollIntoView()');await truth('scrollY > 500')});
  await test('T12',async()=>{await click('#load');await tool('wait_for',{text:'Notebook state: finished'});await truth('dynamic.textContent === "Notebook state: finished"')});
  await test('T13',async()=>{
    const file=path.join(dir,'screenshot.png');
    await tool('take_screenshot',{type:'png',filename:file});
    const png=PNG.sync.read(fs.readFileSync(file));
    assert.equal(png.width,1280);assert.equal(png.height,800);
    let match=0;
    for(let i=0;i<png.data.length;i+=4){if(png.data[i]===244 && png.data[i+1]===249 && png.data[i+2]===255)match++}
    assert(match>png.width*png.height*0.25);
  });
  await test('T14',async()=>{await click('#newtab');const tabs=await tool('tabs',{action:'list'});assert.match(tabs.body,/Second fixture/);assert.match(tabs.body,/Independent Browser Lab/)});
  await test('T15',async()=>{await tool('tabs',{action:'select',index:1});await truth('document.title === "Second fixture"')});
  await test('T16',async()=>{await tool('tabs',{action:'close',index:1});await truth('document.title === "Independent Browser Lab"');assert.doesNotMatch((await tool('tabs',{action:'list'})).body,/Second fixture/)});
  await test('T17',async()=>{await click('#next');await truth('document.title === "Second fixture"');await tool('navigate_back');await truth('document.title === "Independent Browser Lab"');await evaluate('() => { setTimeout(()=>history.forward(),10) }');await tool('wait_for',{text:'Second fixture'});await truth('location.pathname === "/second"');await tool('navigate_back')});
  await test('T18',async()=>{await click('#upload');await tool('file_upload',{paths:[path.join(root,'tests/fixtures/upload.txt')]});await truth('uploaded.textContent.trim() === "local fixture payload"')});
  await test('T19',async()=>{
    const before=new Set(fs.readdirSync(cfg.outputDir,{recursive:true}));
    await click('#download');
    let matched=false;
    for(let i=0;i<20&&!matched;i++){
      for(const f of fs.readdirSync(cfg.outputDir,{recursive:true})){
        if(!before.has(f)&&f.endsWith('.txt')&&fs.readFileSync(path.join(cfg.outputDir,f),'utf8')==='fixture download verified') matched=true;
      }
      if(!matched)await delay(150);
    }
    assert(matched,'Downloaded file content missing');
  });
  await test('T20',async()=>{const text=await snap();const ref=text.match(/button "Child action" \[ref=([^\]]+)/);assert(ref,'Missing iframe button');await click(ref[1]);await truth('document.querySelector("iframe").contentDocument.querySelector("button").textContent === "Child done"')});
}
try {
  await client.initialize();
  await navigate(lab.url);
  watcher=await observe(cfg.browser.userDataDir,dir);
  if(mode!=='basic') await watcher.waitFor(requiredState);
  watcher.begin();
  for(let i=0;i<repeats;i++)await suite();
  if(requiredState==='minimized'&&watcher.valid(requiredState)){
    await evaluate('() => { document.title="Independent Browser Lab - completed"; document.querySelector("h1").textContent="Background checks finished" }');
  }
  await watcher.stop();
  if(requiredState==='minimized'&&watcher.valid(requiredState)){
    console.log('Background checks finished. Restore the test window to inspect the result.');
    const restored=await observe(cfg.browser.userDataDir,dir);
    try {
      await test('MANUAL_RESTORE',async()=>{await restored.waitFor('foreground');await truth('document.querySelector("h1").textContent === "Background checks finished"')});
    } finally {await restored.stop()}
  } else if(mode!=='basic'&&!watcher.valid(requiredState)){
    await test('WINDOW_INVARIANT',()=>{throw Error('WINDOW_STATE_CHANGED_DURING_TEST')});
  }
  if(mode==='basic')await test('PERSIST',async()=>{
    await navigate(lab.url);
    await evaluate('() => {localStorage.setItem("fixture","persisted");document.cookie="fixture=persisted; Max-Age=600; SameSite=Lax"}');
    await tool('close');await client.close();client=new Client(config);await client.initialize();await navigate(lab.url);
    await truth('localStorage.getItem("fixture")==="persisted" && document.cookie.split("; ").includes("fixture=persisted")');
  });
} catch(error) {
  await test('SETUP_OR_WINDOW',()=>{throw error});
} finally {
  await watcher?.stop();await client.close();lab.close();save();
}
console.log(JSON.stringify({report,pass:rows.filter(x=>x.ok).length,total:rows.length,window:watcher?.summary()}));
if(rows.some(r=>!r.ok) || (mode!=='basic'&&!watcher?.valid(requiredState)))process.exitCode=1;

