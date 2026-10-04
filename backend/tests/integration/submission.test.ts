/**
 * Running and submitting code, auto submit, ranking and early end.
 */

// --- IMPORTS ---
import type { PublicRoom } from '../../src/modules/room/room.types.js';
import { PROGRAMS } from '../helpers/fake-executor.js';
import { createRoom } from '../helpers/test-server.js';
import { joinRoom } from '../helpers/test-server.js';
import { startServer } from '../helpers/test-server.js';
import { TestClient } from '../helpers/test-server.js';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';

// --- CODE ---
/**
 * A running round with the given players connected, the first one hosting.
 *
 * @param {string[]} names The players' names.
 *
 * @returns The server and one client per name.
 */
async function roundWith(names: string[]) {

  const server = await startServer();
  const host = await createRoom(server, names[0] ?? 'Host');
  const identities = [host];

  for (const name of names.slice(1)) {
    identities.push(await joinRoom(server, host.code, name));
  }

  const clients = await Promise.all(
    identities.map((identity) => TestClient.join(server, identity)),
  );

  const hostClient = clients[0] as TestClient;

  await hostClient.waitFor((room) => room.players.every((p) => p.connected));
  await hostClient.emit('game:start');
  await hostClient.waitFor((room) => room.status === 'PLAYING');

  return { server, host, clients };
}

/**
 * Summarize the ranking, e.g. "1:Ana:100 -:Bob:-".
 *
 * @param {PublicRoom} room The room, with a round.
 *
 * @returns {string} position:name:percentage per player, ranked.
 */
function ranking(room: PublicRoom): string {

  const nameOf = (id: string) => room.players.find((p) => p.id === id)?.name;

  return (room.round?.results ?? [])
    .map((r) => {
      const auto = r.autoSubmitted ? '(auto)' : '';
      return `${r.position ?? '-'}:${nameOf(r.playerId)}`
        + `:${r.percentage ?? '-'}${auto}`;
    })
    .join(' ');
}

/**
 * A payload to run or submit a fake program.
 *
 * @param {string} code The fake program.
 *
 * @returns {{ language: string, code: string }} The payload.
 */
function program(code: string): { language: string; code: string } {
  return { language: 'python', code };
}

describe('running the examples', () => {

  it('returns each example with its output', async () => {
    const { clients: [ana] } = await roundWith(['Ana']);

    const response = await ana!.emit('submission:run', program(PROGRAMS.sum));

    expect(response).toEqual({
      ok: true,
      data: [{
        input: '2 5',
        expectedOutput: '7',
        stdout: '7\n',
        stderr: '',
        status: 'OK',
        passed: true,
      }],
    });
  });

  it.each([
    ['print:8', 'WRONG_ANSWER'],
    [PROGRAMS.compileError, 'COMPILE_ERROR'],
    [PROGRAMS.crash, 'RUNTIME_ERROR'],
    [PROGRAMS.timeout, 'TIME_LIMIT'],
  ])('reports %s as %s', async (code, status) => {
    const { clients: [ana] } = await roundWith(['Ana']);

    const response = await ana!.emit('submission:run', program(code));

    expect(response.data[0].status).toBe(status);
    expect(response.data[0].passed).toBe(false);
  });

  it('allows one run at a time per player', async () => {
    const { clients: [ana] } = await roundWith(['Ana']);

    const responses = await Promise.all([
      ana!.emit('submission:run', program(PROGRAMS.slowSum)),
      ana!.emit('submission:run', program(PROGRAMS.slowSum)),
    ]);

    expect(responses.map((r) => r.ok ?? r.error).sort())
      .toEqual(['run_in_progress_error', true]);
  });

  it.each([
    [{ language: 'cobol', code: 'x' }],
    [{ language: 'python', code: '   ' }],
    ['not an object'],
  ])('refuses the payload %j', async (payload) => {
    const { clients: [ana] } = await roundWith(['Ana']);

    const response = await ana!.emit('submission:run', payload);

    expect(response.error).toBe('request_validation_error');
  });

  it('refuses a player who joined mid round', async () => {
    const { server, host } = await roundWith(['Ana']);
    const late = await joinRoom(server, host.code, 'Late');
    const lateClient = await TestClient.join(server, late);

    const response = await lateClient.emit(
      'submission:run',
      program(PROGRAMS.sum),
    );

    expect(response.error).toBe('not_in_round_error');
  });
});

describe('submitting', () => {

  it('judges the hidden tests and allows only one submission', async () => {
    const { clients: [ana, bob] } = await roundWith(['Ana', 'Bob']);

    const verdict = await ana!.emit(
      'submission:submit',
      program(PROGRAMS.sum),
    );

    expect(verdict).toEqual({
      ok: true,
      data: {
        status: 'ACCEPTED',
        passed: 4,
        total: 4,
        percentage: 100,
        compileError: null,
      },
    });

    const again = await ana!.emit('submission:submit', program(PROGRAMS.sum));
    expect(again.error).toBe('already_submitted_error');

    // bob has not submitted: the round goes on
    expect(bob!.state?.status).toBe('PLAYING');
  });

  it('reports a partial score and the first failure', async () => {
    const { clients: [ana, bob] } = await roundWith(['Ana', 'Bob']);

    const verdict = await ana!.emit('submission:submit', program('print:7'));

    expect(verdict.data).toMatchObject({
      status: 'WRONG_ANSWER',
      passed: 1,
      total: 4,
      percentage: 25,
    });

    await bob!.waitFor((room) => ranking(room) === '1:Ana:25 -:Bob:-');
  });

  it('shows the compiler output on a compile error', async () => {
    const { clients: [ana] } = await roundWith(['Ana']);

    const verdict = await ana!.emit(
      'submission:submit',
      program(PROGRAMS.compileError),
    );

    expect(verdict.data).toMatchObject({
      status: 'COMPILE_ERROR',
      passed: 0,
      compileError: 'syntax error',
    });
  });

  it('undoes the submission when the sandbox is down', async () => {
    const { clients: [ana] } = await roundWith(['Ana']);

    const failed = await ana!.emit(
      'submission:submit',
      program(PROGRAMS.unavailable),
    );

    expect(failed.error).toBe('executor_unavailable_error');

    // still playing, and free to submit again
    const room = await ana!.waitFor((r) => {
      return r.round?.results[0]?.submittedAt === null;
    });
    expect(room.status).toBe('PLAYING');

    const retry = await ana!.emit('submission:submit', program(PROGRAMS.sum));
    expect(retry.data.status).toBe('ACCEPTED');
  });
});

describe('end of the round', () => {

  it('ends early once everyone is judged', async () => {
    const { clients: [ana, bob] } = await roundWith(['Ana', 'Bob']);

    await ana!.emit('submission:submit', program(PROGRAMS.sum));
    await bob!.emit('submission:submit', program('print:7'));

    const finished = await ana!.waitFor((r) => r.status === 'FINISHED', 1000);

    expect(ranking(finished)).toBe('1:Ana:100 2:Bob:25');
  });

  it('auto submits drafts at the deadline and ranks everyone', async () => {
    const {
      clients: [ana, bob, caio, dani, eva],
    } = await roundWith(['Ana', 'Bob', 'Caio', 'Dani', 'Eva']);

    await ana!.emit('submission:submit', program(PROGRAMS.sum));
    await bob!.emit('submission:submit', program(PROGRAMS.sum));
    await caio!.emit('submission:submit', program('print:7'));

    // dani never submits but has a solution in the editor; eva has nothing
    await dani!.emit('submission:draft', program(PROGRAMS.sum));
    await eva!.emit('submission:draft', program(''));

    const finished = await ana!.waitFor((r) => r.status === 'FINISHED');

    expect(ranking(finished))
      .toBe('1:Ana:100 2:Bob:100 3:Dani:100(auto) 4:Caio:25 -:Eva:-');

    // drafts stay private the whole time
    const broadcast = JSON.stringify(ana!.states);

    expect(broadcast).not.toContain('"drafts"');
    expect(broadcast).not.toContain('"language"');
  });

  it('refuses runs once the round is over', async () => {
    const { clients: [ana] } = await roundWith(['Ana']);

    await ana!.emit('submission:submit', program(PROGRAMS.sum));
    await ana!.waitFor((r) => r.status === 'FINISHED');

    const response = await ana!.emit('submission:run', program(PROGRAMS.sum));

    expect(response.error).toBe('round_not_running_error');
  });
});

describe('showing the code', () => {

  it('shows the judged code to anyone in the room', async () => {
    const { server, host, clients: [ana, bob] } = await roundWith([
      'Ana',
      'Bob',
    ]);

    await ana!.emit('submission:submit', program(PROGRAMS.sum));

    // a draft landing after the submission must not replace it
    await ana!.emit('submission:draft', program('print:1'));
    await bob!.emit('submission:submit', program('print:7'));
    await ana!.waitFor((r) => r.status === 'FINISHED');

    // joined after the round: only watched, can still look
    const late = await joinRoom(server, host.code, 'Late');
    const lateClient = await TestClient.join(server, late);

    const own = await ana!.emit('submission:code', { playerId: host.playerId });
    const seen = await lateClient.emit(
      'submission:code',
      { playerId: host.playerId },
    );

    expect(own).toEqual({ ok: true, data: program(PROGRAMS.sum) });
    expect(seen).toEqual(own);
  });

  it('shows the draft submitted when time ran out', async () => {
    const { clients: [ana, bob] } = await roundWith(['Ana', 'Bob']);

    await bob!.emit('submission:draft', program(PROGRAMS.sum));
    await ana!.emit('submission:submit', program('print:7'));

    const finished = await ana!.waitFor((r) => r.status === 'FINISHED');
    const bobId = finished.players.find((p) => p.name === 'Bob')!.id;

    const response = await ana!.emit('submission:code', { playerId: bobId });

    expect(response).toEqual({ ok: true, data: program(PROGRAMS.sum) });
  });

  it('hides the code while the round runs', async () => {
    const { host, clients: [ana, bob] } = await roundWith(['Ana', 'Bob']);

    await ana!.emit('submission:submit', program(PROGRAMS.sum));

    const response = await bob!.emit(
      'submission:code',
      { playerId: host.playerId },
    );

    expect(response.error).toBe('game_not_finished_error');
  });

  it('refuses players who did not submit', async () => {
    const { clients: [ana, bob] } = await roundWith(['Ana', 'Bob']);

    await ana!.emit('submission:submit', program(PROGRAMS.sum));

    const finished = await ana!.waitFor((r) => r.status === 'FINISHED');
    const bobId = finished.players.find((p) => p.name === 'Bob')!.id;

    const missing = await ana!.emit('submission:code', { playerId: bobId });
    const unknown = await ana!.emit('submission:code', { playerId: 'nope' });
    const invalid = await ana!.emit('submission:code', 'not an object');

    expect(missing.error).toBe('no_submission_error');
    expect(unknown.error).toBe('no_submission_error');
    expect(invalid.error).toBe('request_validation_error');
  });

  it('forgets the code once the host goes back to the lobby', async () => {
    const { host, clients: [ana] } = await roundWith(['Ana']);

    await ana!.emit('submission:submit', program(PROGRAMS.sum));
    await ana!.waitFor((r) => r.status === 'FINISHED');
    await ana!.emit('game:restart');
    await ana!.waitFor((r) => r.status === 'LOBBY');

    const response = await ana!.emit(
      'submission:code',
      { playerId: host.playerId },
    );

    expect(response.error).toBe('game_not_finished_error');
  });
});
