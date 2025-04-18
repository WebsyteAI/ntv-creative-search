import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { handleQueryEndpoint } from './routes/query';
import { handleSimpleEndpoint } from './routes/simple';
import { handleButtonEndpoint } from './routes/button';

interface Env {
  QDRANT_API_KEY: string;
  OPENAI_API_KEY: string;
}

const app = new Hono<{ Bindings: Env }>();
app.use('*', cors());

app.post('/query', handleQueryEndpoint);
app.post('/simple', handleSimpleEndpoint);
app.post('/button', handleButtonEndpoint);

export default app;
