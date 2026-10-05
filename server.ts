import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';

const app = new Hono();

app.get('/health', (c) => c.text('ok'));
app.use('*', serveStatic({ root: './dist' }));
app.notFound((c) => c.text("404 · you've drifted off the sheet\n", 404));

const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port }, () => console.log(`~/matt listening on :${port}`));
