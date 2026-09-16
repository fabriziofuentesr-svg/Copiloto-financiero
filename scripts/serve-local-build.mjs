import http from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
const root=resolve(join(tmpdir(),"copiloto-monthly-local"));
http.createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,"http://localhost").pathname);let file=resolve(root,`.`+pathname);if(file !== root && !file.startsWith(root+sep)){res.writeHead(403);res.end();return;}if(!extname(file))file=join(root,"index.html");let body;try{body=await readFile(file);}catch{file=join(root,"index.html");body=await readFile(file);}res.writeHead(200,{"Content-Type":({".html":"text/html",".js":"text/javascript",".css":"text/css"})[extname(file)] || "application/octet-stream"});res.end(body);}catch{res.writeHead(500);res.end();}}).listen(4181,"127.0.0.1",()=>console.log("Local verification http://127.0.0.1:4181"));
