import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { handleQueryEndpoint } from './routes/query';
import { handleQueryOneEndpoint } from './routes/queryOne';
import { handleSimpleEndpoint } from './routes/simple';
import { handleButtonEndpoint } from './routes/button';
import { handleRawEndpoint } from './routes/raw';
import { handleApiQueryEndpoint } from './routes/apiQuery';
import { handleAdvertiserFilterEndpoint } from './routes/advertiserFilter';
import { handleHealthCheck } from './routes/health';

interface Env {
  QDRANT_API_KEY: string;
  OPENAI_API_KEY: string;
}

const app = new Hono<{ Bindings: Env }>();
app.use('*', cors());

app.get('/health', handleHealthCheck);
app.post('/query', handleQueryEndpoint);
app.post('/query-one', handleQueryOneEndpoint);
app.post('/simple', handleSimpleEndpoint);
app.post('/button', handleButtonEndpoint);
app.post('/raw', handleRawEndpoint);
app.post('/api/query', handleApiQueryEndpoint);
app.post('/advertiser-filter', handleAdvertiserFilterEndpoint);

export default app;
