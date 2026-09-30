/**
 * Language server tickets: who gets one, and what it carries.
 */

// --- IMPORTS ---
import { createRoom } from '../helpers/test-server.js';
import { joinRoom } from '../helpers/test-server.js';
import { startServer } from '../helpers/test-server.js';
import { TestClient } from '../helpers/test-server.js';
import { createHmac } from 'node:crypto';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';

// --- GLOBALS ---
const SECRET = 'test-secret-test-secret-test-secret';

// --- CODE ---
/**
 * Split a ticket and check its signature, as the lsp service does.
 *
 * @param {string} ticket The ticket.
 *
 * @returns {any} Its claims, or null when the signature does not match.
 */
function verify(ticket: string): any {

  const [payload = '', signature] = ticket.split('.');
  const expected = createHmac('sha256', SECRET)
    .update(payload)
    .digest('base64url');

  if (signature !== expected) {
    return null;
  }

  return JSON.parse(Buffer.from(payload, 'base64url').toString());
}

describe('lsp:ticket', () => {

  it('hands a signed ticket to a player of the running round', async () => {
    const server = await startServer({ lspSecret: SECRET });
    const host = await createRoom(server, 'Host');
    const client = await TestClient.join(server, host);

    await client.emit('game:start');
    const response = await client.emit('lsp:ticket', { language: 'python' });

    expect(response.ok).toBe(true);

    const claims = verify(response.data.ticket);
    const nowSeconds = Math.floor(Date.now() / 1000);

    expect(claims).toMatchObject({ lang: 'python', sub: host.playerId });
    expect(claims.exp).toBeGreaterThan(nowSeconds);
    expect(claims.exp).toBeLessThanOrEqual(nowSeconds + 60);

    // one use each, and the session ends with the round
    const again = verify(
      (await client.emit('lsp:ticket', { language: 'python' })).data.ticket,
    );

    expect(claims.jti).toEqual(expect.any(String));
    expect(again.jti).not.toBe(claims.jti);
    expect(claims.end).toBeGreaterThan(nowSeconds);
  });

  it('refuses outside a round and to late joiners', async () => {
    const server = await startServer({ lspSecret: SECRET });
    const host = await createRoom(server, 'Host');
    const hostClient = await TestClient.join(server, host);

    expect((await hostClient.emit('lsp:ticket', { language: 'python' })).error)
      .toBe('round_not_running_error');

    await hostClient.emit('game:start');

    const late = await joinRoom(server, host.code, 'Late');
    const lateClient = await TestClient.join(server, late);

    expect((await lateClient.emit('lsp:ticket', { language: 'python' })).error)
      .toBe('not_in_round_error');
  });

  it('refuses unknown languages and a missing secret', async () => {
    const server = await startServer({
      lspSecret: SECRET,
      enabledLanguages: ['python'],
    });
    const host = await createRoom(server, 'Host');
    const client = await TestClient.join(server, host);

    await client.emit('game:start');

    expect((await client.emit('lsp:ticket', { language: 'java' })).error)
      .toBe('request_validation_error');

    const off = await startServer({ lspSecret: '' });
    const offHost = await createRoom(off, 'Host');
    const offClient = await TestClient.join(off, offHost);

    await offClient.emit('game:start');

    expect((await offClient.emit('lsp:ticket', { language: 'python' })).error)
      .toBe('lsp_unavailable_error');
  });
});
