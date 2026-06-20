import { createServer, type Server } from 'node:http';
import { encode } from 'next-auth/jwt';
import { writeFile, mkdir } from 'node:fs/promises';

// AUTH_SECRET is resolved by playwright.config.ts (same process) and written to
// process.env before global-setup runs, so it always matches the webServer's value.
const AUTH_SECRET = process.env.AUTH_SECRET as string;

function startMedplumMock(): Promise<Server> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      res.setHeader('Content-Type', 'application/json');
      if (req.url?.includes('/oauth2/token')) {
        res.writeHead(200);
        res.end(
          JSON.stringify({ access_token: 'mock-access-token', token_type: 'Bearer', expires_in: 3600 }),
        );
      } else {
        // Return empty FHIR bundle for all other requests
        res.writeHead(200);
        res.end(JSON.stringify({ resourceType: 'Bundle', total: 0, entry: [] }));
      }
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        // Port already in use (real Medplum running locally) — proceed without mock
        resolve(server);
      } else {
        console.error('[e2e] Mock Medplum server error:', err);
        resolve(server);
      }
    });

    server.listen(8103, () => resolve(server));
  });
}

// Pre-hit SSR routes so Next.js compiles them before tests run.
// This avoids cold-compile timeouts in dev mode (especially on WSL2).
async function warmupSSRRoutes(sessionCookie: string) {
  const routes = ['/home', '/schedule', '/patients'];
  for (const route of routes) {
    try {
      await fetch(`http://localhost:3000${route}`, {
        headers: { Cookie: `authjs.session-token=${sessionCookie}` },
        signal: AbortSignal.timeout(60_000),
      });
    } catch {
      // ignore — warmup is best-effort
    }
  }
}

export default async function globalSetup() {
  const mockServer = await startMedplumMock();

  // Salt must match the cookie name NextAuth uses to verify the token
  const COOKIE_NAME = 'authjs.session-token';
  const token = await encode({
    token: {
      name: 'Test User',
      email: 'test@example.com',
      sub: 'test-sub',
      practitionerId: 'prac-test',
      projectId: 'proj-test',
      role: 'owner',
      subscriptionStatus: 'active',
      subscriptionPlan: 'clinic',
      createdAt: new Date().toISOString(),
    },
    secret: AUTH_SECRET,
    salt: COOKIE_NAME,
  });

  await mkdir('e2e/.auth', { recursive: true });
  await writeFile(
    'e2e/.auth/user.json',
    JSON.stringify({
      cookies: [
        {
          name: COOKIE_NAME,
          value: token,
          domain: 'localhost',
          path: '/',
          httpOnly: true,
          secure: false,
          sameSite: 'Lax',
        },
      ],
    }),
  );

  await warmupSSRRoutes(token);

  return async () => {
    if (mockServer.listening) {
      await new Promise<void>((resolve) => mockServer.close(() => resolve()));
    }
  };
}
