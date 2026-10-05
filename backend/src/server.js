import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { openDatabase } from './db.js';
import { createSummarizer, DEFAULT_MODEL } from './services/ai.js';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });
const db = openDatabase();
const summarize = createSummarizer({ apiKey: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL || DEFAULT_MODEL });
const server = createApp({ db, summarize }).listen(4000, '127.0.0.1', () => {
  console.log('API ready at http://127.0.0.1:4000');
  if (!process.env.GEMINI_API_KEY) console.log('Add GEMINI_API_KEY to backend/.env to enable generation.');
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => server.close(() => { db.close(); process.exit(0); }));
}
