import 'server-only';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { createDatabase } from '@/lib/db/database';
import { seedDemo } from '@/lib/db/demo';
import { ReimbursementService } from '@/lib/domain/service';
import { appMode, localDataDir, requiredEnv } from './config';

const globalApplication = globalThis as unknown as { carryService?: Promise<ReimbursementService> };
export function getApplication() {
  if (!globalApplication.carryService) {
    globalApplication.carryService = (async () => {
      const mode = appMode();
      if (mode === 'demo') await mkdir(localDataDir(), { recursive: true, mode: 0o700 });
      const db = await createDatabase(
        mode === 'demo'
          ? { dataDir: path.join(localDataDir(), 'db') }
          : { connectionString: requiredEnv('DATABASE_URL') },
      );
      if (mode === 'demo') await seedDemo(db);
      return new ReimbursementService(db, { mode });
    })().catch((error) => {
      globalApplication.carryService = undefined;
      throw error;
    });
  }
  return globalApplication.carryService;
}
