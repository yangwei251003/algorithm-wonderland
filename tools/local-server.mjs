import http from 'node:http';
import {readFile,stat,writeFile} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const root=path.resolve(process.argv[2]??path.join(project,'delivery'));
const port=Number(process.env.ALGORITHM_PORT??5188);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.mp4':'video/mp4','.mp3':'audio/mpeg','.wav':'audio/wav','.vtt':'text/vtt; charset=utf-8','.srt':'text/plain; charset=utf-8','.txt':'text/plain; charset=utf-8','.woff2':'font/woff2','.zip':'application/zip'};
const server=http.createServer(async(req,res)=>{
 if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405).end();return;}
 try{
  const url=new URL(req.url??'/','http://127.0.0.1');
  if(url.pathname==='/__algorithm_health'){res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}).end(JSON.stringify({app:'algorithm-wonderland',version:2,root,pid:process.pid}));return;}
  const decoded=decodeURIComponent(url.pathname),file=path.resolve(root,'.'+(decoded==='/'?'/index.html':decoded));
  if(!file.startsWith(root+path.sep)||decoded.includes('\0')){res.writeHead(403).end();return;}
  const info=await stat(file);if(!info.isFile()){res.writeHead(404).end();return;}
  const headers={'Content-Type':mime[path.extname(file)]??'application/octet-stream','Accept-Ranges':'bytes','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'};
  let start=0,end=info.size-1,status=200;
  if(req.headers.range){
   const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
   if(!match||(!match[1]&&!match[2])){res.writeHead(416,{'Content-Range':`bytes */${info.size}`}).end();return;}
   if(!match[1])start=Math.max(0,info.size-Number(match[2]));else start=Number(match[1]);
   if(match[1]&&match[2])end=Math.min(info.size-1,Number(match[2]));
   if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=info.size){res.writeHead(416,{'Content-Range':`bytes */${info.size}`}).end();return;}
   headers['Content-Range']=`bytes ${start}-${end}/${info.size}`;status=206;
  }
  headers['Content-Length']=String(Math.max(0,end-start+1));res.writeHead(status,headers);
  if(req.method==='HEAD')res.end();else createReadStream(file,{start,end}).on('error',()=>res.destroy()).pipe(res);
 }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'}).end('没有找到这个本地文件。');}
});
server.on('error',error=>{console.error(error.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`算法奇境本地体验馆：http://127.0.0.1:${port}/`));
