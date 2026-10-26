const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || process.env.PM2_SERVE_PORT || 8080);

const STATIC_ROOT = path.resolve(
  process.env.STATIC_ROOT ||
    process.env.PM2_SERVE_PATH ||
    (fs.existsSync(path.join(__dirname, 'index.html'))
      ? __dirname
      : path.join(__dirname, '..', 'dist'))
);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm',
};

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  let pathname;
  try {
    pathname = decodeURIComponent(parsedUrl.pathname);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Bad Request');
  }

  // Strip trailing slashes (except root "/") so "/onboarding/call/" resolves cleanly
  if (pathname.length > 1) {
    pathname = pathname.replace(/\/+$/, '');
  }

  if (pathname === '/') {
    pathname = '/index.html';
  }

  const filePath = path.resolve(STATIC_ROOT, '.' + pathname);

  // Prevent directory traversal outside STATIC_ROOT
  if (filePath !== STATIC_ROOT && !filePath.startsWith(STATIC_ROOT + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isFile()) {
      return serveFile(filePath, pathname, req, res);
    }

    const ext = path.extname(pathname);
    if (ext && ext !== '.html') {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end(`File not found: ${pathname}`);
    }

    const htmlPath = filePath + '.html';
    fs.stat(htmlPath, (htmlErr, htmlStats) => {
      if (!htmlErr && htmlStats.isFile()) {
        return serveFile(htmlPath, pathname, req, res);
      }

      const indexPath = path.join(filePath, 'index.html');
      fs.stat(indexPath, (indexErr, indexStats) => {
        if (!indexErr && indexStats.isFile()) {
          return serveFile(indexPath, pathname, req, res);
        }

        const fallbackPath = path.join(STATIC_ROOT, 'index.html');
        return serveFile(fallbackPath, '/index.html', req, res);
      });
    });
  });
});

function serveFile(filePath, requestPath, req, res) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Internal Server Error');
    }

    const isImmutableAsset =
      requestPath.startsWith('/_expo/') || requestPath.startsWith('/assets/');

    const headers = {
      'Content-Type': contentType,
      'Content-Length': data.length,
      'Access-Control-Allow-Origin': '*',
    };

    if (ext === '.html') {
      headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    } else if (isImmutableAsset) {
      headers['Cache-Control'] = 'public, max-age=31536000, immutable';
    } else {
      headers['Cache-Control'] = 'public, max-age=3600';
    }

    res.writeHead(200, headers);
    if (req.method === 'HEAD') {
      return res.end();
    }
    res.end(data);
  });
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Maya Web] Server running on port ${PORT} serving ${STATIC_ROOT}`);
});
