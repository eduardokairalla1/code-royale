/**
 * Several instances on one Redis: shared rooms, broadcasts and timers.
 */

// --- IMPORTS ---
import { PROGRAMS } from '../helpers/fake-executor.js';
import { createRoom } from '../helpers/test-server.js';
import { joinRoom } from '../helpers/test-server.js';
import { request } from '../helpers/test-server.js';
import { startServer } from '../helpers/test-server.js';
import { TestClient } from '../helpers/test-server.js';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';

// --- CODE ---
/**
 * A payload to submit a fake program.
 *
 * @param {string} code The fake program.
 *
 * @returns {{ language: string, code: string }} The payload.
 */
function program(code: string): { language: string; code: string } {
  return { language: 'python', code };
}

describe('two instances', () => {

  it('share rooms, broadcasts and rounds', async () => {
    const one = await startServer();
    const two = await startServer();

    // created on one, joined and played on the other
    const ana = await createRoom(one, 'Ana');
    const bob = await joinRoom(two, ana.code, 'Bob');
    const anaClient = await TestClient.join(one, ana);
    const bobClient = await TestClient.join(two, bob);

    await anaClient.waitFor((room) => {
      return room.players.length === 2
        && room.players.every((player) => player.connected);
    });

    await bobClient.emit('room:leave');
    await anaClient.waitFor((room) => room.players.length === 1);

    const caio = await joinRoom(two, ana.code, 'Caio');
    const caioClient = await TestClient.join(two, caio);

    await anaClient.waitFor((room) => room.players.length === 2);
    await anaClient.emit('game:start');
    await caioClient.waitFor((room) => room.status === 'PLAYING');

    await anaClient.emit('submission:submit', program(PROGRAMS.sum));
    await caioClient.emit('submission:submit', program('print:7'));

    const finished = await anaClient.waitFor((r) => r.status === 'FINISHED');

    expect(finished.round?.results.map((r) => r.percentage)).toEqual([100, 25]);

    const fromTwo = await request(two, 'GET', `/api/rooms/${ana.code}`);
    expect(fromTwo.status).toBe(200);
  });

  it('ends the round on time after an instance goes down', async () => {
    const one = await startServer();
    const two = await startServer();

    const ana = await createRoom(one, 'Ana');
    const bob = await joinRoom(one, ana.code, 'Bob');
    const anaClient = await TestClient.join(one, ana);
    const bobClient = await TestClient.join(two, bob);

    await anaClient.waitFor((room) => {
      return room.players.every((player) => player.connected);
    });
    await anaClient.emit('game:start');
    await bobClient.waitFor((room) => room.status === 'PLAYING');
    await bobClient.emit('submission:draft', program(PROGRAMS.sum));

    // the instance that started the round, and holds its host, dies
    await one.app.close();

    const finished = await bobClient.waitFor((room) => {
      return room.status === 'FINISHED';
    });

    const bobResult = finished.round?.results.find((result) => {
      return result.playerId === bob.playerId;
    });

    expect(bobResult).toMatchObject({ percentage: 100, autoSubmitted: true });
  });

  it('judges again a submission lost with its instance', async () => {
    const one = await startServer();
    const two = await startServer();

    const ana = await createRoom(one, 'Ana');
    const bob = await joinRoom(one, ana.code, 'Bob');
    const anaClient = await TestClient.join(one, ana);
    const bobClient = await TestClient.join(two, bob);

    await anaClient.waitFor((room) => {
      return room.players.every((player) => player.connected);
    });
    await anaClient.emit('game:start');
    await bobClient.waitFor((room) => room.status === 'PLAYING');

    // submitted on one, whose sandbox never answers, and then it dies
    one.executor.stall();
    void anaClient.emit('submission:submit', program(PROGRAMS.sum));
    await bobClient.waitFor((room) => {
      return room.round?.results.some((r) => r.submittedAt !== null) ?? false;
    });
    await one.app.close();

    const finished = await bobClient.waitFor((room) => {
      return room.status === 'FINISHED';
    }, 10_000);

    const anaResult = finished.round?.results.find((result) => {
      return result.playerId === ana.playerId;
    });

    expect(anaResult).toMatchObject({ percentage: 100, autoSubmitted: false });
  });
});
