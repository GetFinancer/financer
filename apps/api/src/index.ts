import { createApp } from './app.js';
import { initSqlModule } from './db/index.js';

const app = createApp();
const PORT = process.env.API_PORT || 4000;

// Start server
async function start() {
  // Load sql.js WASM module once at startup
  // Tenant databases are loaded lazily on first request
  await initSqlModule();

  app.listen(PORT, () => {
    console.log(`API server running on http://localhost:${PORT}`);
    console.log(`Base domain: ${process.env.BASE_DOMAIN || 'getfinancer.com'}`);
    console.log(`Data directory: ${process.env.DATA_DIR || './data'}`);
  });
}

start().catch(console.error);
