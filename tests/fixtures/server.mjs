import http from 'node:http';
import fs from 'node:fs';
const html=fs.readFileSync(new URL('./lab.html',import.meta.url));
export async function fixture(){
  const server=http.createServer((req,res)=>{
    if(req.url==='/download'){res.writeHead(200,{'Content-Disposition':'attachment; filename="fixture-result.txt"','Content-Type':'text/plain'});res.end('fixture download verified');return}
    if(req.url==='/status'){res.end('Notebook state: finished');return}
    if(req.url==='/drop'){req.socket.destroy();return}
    if(req.url==='/slow'){const timer=setTimeout(()=>res.end('late'),12000);res.on('close',()=>clearTimeout(timer));return}
    const code=Number(req.url.slice(1));
    if([401,403,429,500,503].includes(code)){res.writeHead(code);res.end('Local HTTP '+code);return}
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.end(req.url==='/second'?'<title>Second fixture</title><h1>Second fixture</h1>':html);
  });
  await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve));
  return {url:'http://127.0.0.1:'+server.address().port,close:()=>{server.closeAllConnections();server.close()}};
}

