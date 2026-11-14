import { env } from './config/env.js';
import { pool } from './db/index.js';
import { app } from './app.js';

const server = app.listen(env.PORT, () => {
  console.log(
    `🚀 DataScope API server running on http://localhost:${env.PORT} (${env.NODE_ENV})`
  );
});

async function shutdown(signal: string): Promise<void> {
  console.log(`\n🛑 Received ${signal}. Closing HTTP server and PostgreSQL pool...`);
  server.close(async () => {
    try {
      await pool.end();
      console.log('✅ Clean shutdown complete.');
      process.exit(0);
    } catch (err) {
      console.error('❌ Error closing database pool:', err);
      process.exit(1);
    }
  });
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
