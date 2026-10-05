import { Router } from 'express';
import { validateInput, validateOutput } from '../validation.js';
import { AppError } from '../errors.js';

export function entriesRouter({ repository, summarize }) {
  const router = Router();
  router.get('/', (_req, res) => res.json(repository.list()));
  router.get('/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) throw new AppError(400, 'Invalid entry ID.');
    const entry = repository.find(id);
    if (!entry) throw new AppError(404, 'Entry not found.');
    res.json(entry);
  });
  router.post('/', async (req, res) => {
    const text = validateInput(req.body);
    const output = validateOutput(await summarize(text));
    res.status(201).json(repository.create(text, output));
  });
  return router;
}
