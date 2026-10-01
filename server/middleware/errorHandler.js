import { ZodError } from 'zod';

export const notFound = (req, res) => res.status(404).json({ message: 'Not found' });

export const errorHandler = (err, req, res, next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({ message: 'Validation failed' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Malformed JSON' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Payload too large' });
  }
  if (err.name === 'CastError' || err.name === 'ValidationError') {
    return res.status(400).json({ message: 'Invalid request' });
  }
  if (err.code === 11000) {
    return res.status(409).json({ message: 'Resource already exists' });
  }
  if (err.status && err.status < 500) {
    return res.status(err.status).json({ message: err.message });
  }
  console.error(err);
  res.status(500).json({ message: 'Internal server error' });
};
