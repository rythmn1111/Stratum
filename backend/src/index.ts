import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import userRoutes from './routes/userRoutes';
import shareRoutes from './routes/shareRoutes';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('combined'));

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true });
});

app.use('/api/user', userRoutes);
app.use('/api/share', shareRoutes);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(500).json({ message: err.message || 'Internal Server Error' });
});

app.listen(env.port, () => {
  // Supabase can be used for auth/session enrichment while PostgreSQL stores encrypted share metadata.
  // This split lets teams layer hosted auth controls without storing private keys server-side.
  // eslint-disable-next-line no-console
  console.log(`Backend listening on port ${env.port}`);
});
