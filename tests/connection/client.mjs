import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

export const root=fileURLToPath(new URL('../../',import.meta.url));
export const defaultConfig=path.join(root,'config/playwright.local.json');
export class Client {
  constructor(config=defaultConfig) {
    this.pending=new Map();
    this.id=0;
    this.child=spawn(process.execPath,[path.join(root,'node_modules/@playwright/mcp/cli.js'),'--config',config,'--no-webmcp'],{cwd:root,windowsHide:true,stdio:['pipe','pipe','pipe']});
    this.child.stderr.resume();
    this.child.stdin.on('error',e=>this.fail(e));
    this.closed=once(this.child,'close').catch(()=>{});
    this.child.once('error',e=>this.fail(e));
    this.child.once('close',()=>this.fail(new Error('MCP_PROCESS_CLOSED')));
    createInterface({input:this.child.stdout}).on('line',line=>{
      let msg;
      try {msg=JSON.parse(line)} catch {this.fail(new Error('INVALID_STDIO_JSON'));return}
      const request=this.pending.get(msg.id);
      if(!request) return;
      if(msg.error) request.reject(new Error('MCP_RPC_'+msg.error.code));
      else request.resolve(msg.result);
    });
  }
  fail(error){for(const request of [...this.pending.values()]) request.reject(error)}
  send(message){this.child.stdin.write(JSON.stringify({jsonrpc:'2.0',...message})+'\n')}
  request(method,params={},ms=30000){
    const id=++this.id;
    return new Promise((resolve,reject)=>{
      const finish=(callback,value)=>{clearTimeout(timer);this.pending.delete(id);callback(value)};
      const timer=setTimeout(()=>finish(reject,new Error('MCP_TIMEOUT')),ms);
      this.pending.set(id,{resolve:value=>finish(resolve,value),reject:error=>finish(reject,error)});
      this.send({id,method,params});
    });
  }
  async initialize(){
    const info=await this.request('initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'local-acceptance',version:'1'}});
    if(!info?.serverInfo || !info.capabilities?.tools || !info.protocolVersion) throw Error('INVALID_HANDSHAKE');
    this.send({method:'notifications/initialized'});
    const {tools}=await this.request('tools/list');
    if(!tools.some(t=>t.name==='browser_snapshot')) throw Error('MISSING_SNAPSHOT_TOOL');
    return {server:info.serverInfo,protocol:info.protocolVersion,tools:tools.map(t=>t.name)};
  }
  async call(name,args={}){
    const result=await this.request('tools/call',{name,arguments:args},90000);
    const body=result.content.filter(item=>item.type==='text').map(item=>item.text).join('\n');
    if(result.isError || /^### Error\b/m.test(body)) {
      // Only synthetic fixture invocations may disclose diagnostics to the local test runner.
      throw Error(body.slice(0,500));
    }
    return {body,content:result.content};
  }
  async close(){
    this.child.stdin.end();
    const timer=setTimeout(()=>this.child.kill(),8000);
    try {await this.closed} finally {clearTimeout(timer)}
  }
}

