import { HonoContext } from 'hono';

export async function handleHealthCheck(c: HonoContext<any, any, any>) {
  return c.json({ status: 'ok', timestamp: Date.now() });
}
