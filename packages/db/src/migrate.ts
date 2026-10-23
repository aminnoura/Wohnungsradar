import fs from 'node:fs';
import path from 'node:path';
import { sql } from './client';

async function main() {
  const dir = path.resolve(__dirname, '../../../db');
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    process.stdout.write(`migrate ${file} … `);
    await sql.unsafe(fs.readFileSync(path.join(dir, file), 'utf8'));
    console.log('ok');
  }
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
