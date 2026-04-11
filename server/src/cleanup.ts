import fs from 'fs';
import path from 'path';

export function startCleanupJob(dataDir: string, uploadsDir: string) {
  function runCleanup() {
    try {
      const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
      const now = Date.now();
      for (const file of files) {
        const filePath = path.join(dataDir, file);
        try {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          if (data.anonymous === true && data.expiresAt && new Date(data.expiresAt).getTime() < now) {
            fs.unlinkSync(filePath);
            const uploadDir = path.join(uploadsDir, data.id);
            if (fs.existsSync(uploadDir)) {
              fs.rmSync(uploadDir, { recursive: true });
            }
            console.log(`[cleanup] Deleted expired presentation: ${data.id}`);
          }
        } catch {
          // skip malformed files
        }
      }
    } catch (err) {
      console.error('[cleanup] Error during cleanup:', err);
    }
  }

  // Run once at startup, then every hour
  runCleanup();
  setInterval(runCleanup, 60 * 60 * 1000);
}
