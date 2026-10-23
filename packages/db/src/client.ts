import path from 'node:path';
import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: path.resolve(__dirname, '../../../.env') });

export const sql = postgres(process.env.DATABASE_URL ?? 'postgres://wr:wr@localhost:5432/wohnungsradar', {
  max: 10,
  onnotice: () => {},
  types: {
    // return numerics as JS numbers (prices and sizes are well within double precision)
    numeric: { to: 1700, from: [1700], serialize: (x: number) => String(x), parse: (x: string) => Number(x) },
  },
});

export type Sql = typeof sql;
