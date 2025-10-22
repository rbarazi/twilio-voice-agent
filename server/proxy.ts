/**
 * Production reverse proxy for deployment platforms
 * Routes traffic to UI (port 3000) and Twilio server (port 5050)
 * Listens on PORT environment variable (required by Heroku, Railway, etc.)
 */

import http from 'http';
import httpProxy from 'http-proxy';
import { spawn } from 'child_process';

const PORT = process.env.PORT || 8080;
const UI_PORT = 3000;
const TWILIO_PORT = 5050;

// Create proxy server
const proxy = httpProxy.createProxyServer({});

// Error handling
proxy.on('error', (err, req, res) => {
  console.error('Proxy error:', err);
  if (!res.headersSent) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
  }
  res.end('Proxy error');
});

// Create HTTP server
const server = http.createServer((req, res) => {
  const url = req.url || '/';

  // Route /twilio/* to Twilio server (port 5050)
  if (url.startsWith('/twilio/')) {
    proxy.web(req, res, {
      target: `http://localhost:${TWILIO_PORT}`,
      changeOrigin: true,
    });
  }
  // Route everything else to Next.js UI (port 3000)
  else {
    proxy.web(req, res, {
      target: `http://localhost:${UI_PORT}`,
      changeOrigin: true,
    });
  }
});

// Handle WebSocket upgrades
server.on('upgrade', (req, socket, head) => {
  const url = req.url || '/';

  // Route WebSocket connections
  if (url.startsWith('/twilio/')) {
    proxy.ws(req, socket, head, {
      target: `ws://localhost:${TWILIO_PORT}`,
    });
  } else {
    proxy.ws(req, socket, head, {
      target: `ws://localhost:${UI_PORT}`,
    });
  }
});

// Start both backend servers
console.log('Starting backend servers...');

const uiServer = spawn('npm', ['run', 'ui:start'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, PORT: String(UI_PORT) }
});

const twilioServer = spawn('npm', ['run', 'server:start'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, TWILIO_SERVER_PORT: String(TWILIO_PORT) }
});

// Wait for servers to start (give them a few seconds)
setTimeout(() => {
  // Start reverse proxy
  server.listen(PORT, () => {
    console.log(`\n✓ Reverse proxy listening on port ${PORT}`);
    console.log(`  - Routing /twilio/* → localhost:${TWILIO_PORT}`);
    console.log(`  - Routing /* → localhost:${UI_PORT}\n`);
  });
}, 5000);

// Cleanup on exit
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  uiServer.kill();
  twilioServer.kill();
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down...');
  uiServer.kill();
  twilioServer.kill();
  server.close(() => process.exit(0));
});
