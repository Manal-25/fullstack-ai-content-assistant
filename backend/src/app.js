import express from 'express';
import { entryRepository } from './db.js';
import { entriesRouter } from './routes/entries.js';
import { AppError } from './errors.js';

export function createApp({ db, summarize }) {
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.use(express.json({ limit: '100kb' }));
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/entries', entriesRouter({ repository: entryRepository(db), summarize }));
  app.use((_req, _res, next) => next(new AppError(404, 'Route not found.')));
  app.use((error, _req, res, _next) => {
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'The request is too large.' });
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Send a valid JSON request.' });
    const status = error instanceof AppError ? error.status : 500;
    // Do not log request text, provider payloads, or credentials.
    if (status === 500) console.error('Request failed:', error.code ?? error.name);
    res.status(status).json({ error: status === 500 ? 'Unable to save or load this entry. Please try again.' : error.message });
  });
  return app;
}
