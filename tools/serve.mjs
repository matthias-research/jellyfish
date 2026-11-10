import http from 'node:http';
import {readFile, realpath} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root = await realpath(fileURLToPath(new URL('..', import.meta.url)));
const types = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.bmp':'image/bmp', '.svg':'image/svg+xml', '.dat':'text/plain'};
const port = Number(process.env.PORT || 4181);
http.createServer(async (req,res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = await realpath(resolve(root, '.' + (path === '/' ? '/index.html' : path)));
    if (!file.startsWith(root + sep)) {res.writeHead(403).end(); return;}
    const data = await readFile(file);
    res.writeHead(200, {'Content-Type':types[extname(file)] || 'application/octet-stream', 'Cache-Control':'no-cache'}).end(data);
  } catch {res.writeHead(404).end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`Jellyfish: http://127.0.0.1:${port}`));
