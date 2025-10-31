/**
 * Production reverse proxy for deployment platforms
 * Routes traffic to UI (port 3000) and Twilio server (port 5050)
 * Listens on PORT environment variable (required by Heroku, Railway, etc.)
 */

import http from 'http';
import httpProxy from 'http-proxy';
import { spawn } from 'child_process';

// Parse and validate environment variables
const PORT = parseInt(process.env.PORT || '8080', 10);
const UI_PORT = parseInt(process.env.UI_PORT || '3000', 10);
const TWILIO_PORT = parseInt(process.env.TWILIO_SERVER_PORT || '5050', 10);

if (isNaN(PORT) || PORT < 1 || PORT > 65535) {
  console.error(`Invalid PORT: ${process.env.PORT}. Must be between 1-65535.`);
  process.exit(1);
}

// Create proxy server
const proxy = httpProxy.createProxyServer({});

// Error handling
proxy.on('error', (err, req, res) => {
  const target = req.url?.startsWith('/twilio/') ? 'Twilio server' : 'UI server';
  const targetPort = req.url?.startsWith('/twilio/') ? TWILIO_PORT : UI_PORT;
  console.error(`Proxy error (${target} on port ${targetPort}):`, err.message);

  if (!res.headersSent) {
    res.writeHead(502, {
      'Content-Type': 'application/json',
      'X-Proxy-Error': target
    });
    res.end(JSON.stringify({
      error: 'Service temporarily unavailable',
      target,
      port: targetPort,
      message: 'Backend service is not responding. Please try again in a moment.'
    }));
  } else {
    res.end();
  }
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

/**
 * Wait for a server to be healthy before proceeding
 */
async function waitForServer(port: number, name: string, healthPath: string = '/health', maxAttempts: number = 30): Promise<void> {
  console.log(`Waiting for ${name} on port ${port}...`);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(`http://localhost:${port}${healthPath}`, {
        signal: AbortSignal.timeout(1000)
      });

      if (response.ok) {
        console.log(`✓ ${name} is ready (attempt ${attempt}/${maxAttempts})`);
        return;
      }
    } catch (error) {
      // Server not ready yet, will retry
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  throw new Error(`${name} failed to start after ${maxAttempts} attempts`);
}

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

// Handle child process errors
uiServer.on('error', (err) => {
  console.error('Failed to start UI server:', err);
  process.exit(1);
});

uiServer.on('exit', (code, signal) => {
  if (code !== 0 && code !== null) {
    console.error(`UI server exited with code ${code}`);
    process.exit(1);
  }
  if (signal) {
    console.log(`UI server killed with signal ${signal}`);
  }
});

twilioServer.on('error', (err) => {
  console.error('Failed to start Twilio server:', err);
  process.exit(1);
});

twilioServer.on('exit', (code, signal) => {
  if (code !== 0 && code !== null) {
    console.error(`Twilio server exited with code ${code}`);
    process.exit(1);
  }
  if (signal) {
    console.log(`Twilio server killed with signal ${signal}`);
  }
});

// Wait for both servers to be healthy, then start proxy
Promise.all([
  waitForServer(UI_PORT, 'UI server', '/', 60), // Next.js may take longer to start
  waitForServer(TWILIO_PORT, 'Twilio server', '/twilio/health')
])
  .then(() => {
    // Start reverse proxy
    server.listen(PORT, () => {
      console.log(`\n✓ Reverse proxy listening on port ${PORT}`);
      console.log(`  - Routing /twilio/* → localhost:${TWILIO_PORT}`);
      console.log(`  - Routing /* → localhost:${UI_PORT}\n`);
    });
  })
  .catch((err) => {
    console.error('Failed to start servers:', err);
    console.error('Shutting down...');
    uiServer.kill();
    twilioServer.kill();
    process.exit(1);
  });

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
