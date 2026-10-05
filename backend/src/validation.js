import { z } from 'zod';
import { AppError } from './errors.js';

export const MAX_INPUT_LENGTH = 12000;
const inputSchema = z.object({
  text: z.string().trim().min(1, 'Enter some text to summarize.')
    .max(MAX_INPUT_LENGTH, `Keep your text under ${MAX_INPUT_LENGTH.toLocaleString('en-US')} characters.`),
});

export const outputSchema = z.object({
  summary: z.string().trim().min(1).max(2000),
  tags: z.array(z.string().trim().min(1).max(60)).length(3),
}).strict();

export function validateInput(body) {
  const result = inputSchema.safeParse(body);
  if (!result.success) throw new AppError(400, result.error.issues[0].message);
  return result.data.text;
}

export function validateOutput(value) {
  const result = outputSchema.safeParse(value);
  if (!result.success || new Set(result.data.tags.map(tag => tag.toLowerCase())).size !== 3) {
    throw new AppError(502, 'The AI returned an invalid summary or tags. Please try again.');
  }
  return result.data;
}
