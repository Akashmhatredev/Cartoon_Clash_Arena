import { describe, it, expect } from 'vitest';
import {
  PROTOCOL_VERSION, C2S, ERR, MAX_MSG_BYTES, MAX_HELLO_BYTES, MAX_NAME_LEN, encode, parseClientMessage, decodeServer,
  sanitizeName, isValidRoomCode, normalizeRoomCode, packState, applyPackedState, INACTIVE, expandLobby,
} from '../../shared/protocol.js';
import { FIGHTER_IDS, STAGE_IDS, createMatch, step, BTN } from '../../shared/index.js';

const msg = (o) => JSON.stringify({ v: PROTOCOL_VERSION, ...o });

describe('protocol version', () => {
  it('is 2: fighter hurtboxes changed, so v1 clients would mispredict against a v2 server', () => {
    expect(PROTOCOL_VERSION).toBe(2);
  });

  it('encode stamps the current version', () => {
    expect(JSON.parse(encode(C2S.READY, { on: true }))).toEqual({ v: 2, t: 'ready', on: true });
  });

  it('rejects older and newer versions as fatal version errors', () => {
    for (const v of [1, 3, '2', null]) {
      const r = parseClientMessage(JSON.stringify({ v, t: 'ready', on: true }));
      expect(r).toMatchObject({ ok: false, err: ERR.VERSION, fatal: true });
    }
    expect(parseClientMessage(JSON.stringify({ t: 'ready', on: true }))).toMatchObject({ ok: false, err: ERR.VERSION, fatal: true });
  });
});

describe('client message validation', () => {
  it('accepts a valid input and rejects bad masks, seqs and frames', () => {
    expect(parseClientMessage(encode(C2S.INPUT, { s: 1, f: 0, m: 1023 })).ok).toBe(true);
    expect(parseClientMessage(encode(C2S.INPUT, { s: 1, f: 0, m: 1024 })).ok).toBe(false);
    expect(parseClientMessage(encode(C2S.INPUT, { s: 1, f: 0, m: -1 })).ok).toBe(false);
    expect(parseClientMessage(encode(C2S.INPUT, { s: 0, f: 0, m: 1 })).ok).toBe(false);
    expect(parseClientMessage(encode(C2S.INPUT, { s: 1.5, f: 0, m: 1 })).ok).toBe(false);
    expect(parseClientMessage(encode(C2S.INPUT, { s: 1, f: -1, m: 1 })).ok).toBe(false);
  });

  it('rejects garbage, arrays, unknown types and non-strings as bad_msg', () => {
    for (const raw of ['{', '[]', 'null', '42', msg({ t: 'nope' }), msg({}), 7, null]) {
      expect(parseClientMessage(raw)).toMatchObject({ ok: false, err: ERR.BAD_MSG });
    }
  });

  it('enforces the size limits (hello may be larger for the auth token)', () => {
    const pad = 'x'.repeat(MAX_MSG_BYTES);
    expect(parseClientMessage(msg({ t: 'ready', on: true, pad }))).toMatchObject({ ok: false, err: ERR.TOO_BIG });
    expect(parseClientMessage(msg({ t: 'hello', name: 'a', pad }))).toMatchObject({ ok: true });
    expect(parseClientMessage(msg({ t: 'hello', pad: 'x'.repeat(MAX_HELLO_BYTES) }))).toMatchObject({ ok: false, err: ERR.TOO_BIG });
    // multi-byte characters count as bytes, not UTF-16 units
    expect(parseClientMessage(msg({ t: 'ready', on: true, pad: '€'.repeat(400) }))).toMatchObject({ ok: false, err: ERR.TOO_BIG });
  });

  it('validates character and stage ids against the registries', () => {
    for (const id of FIGHTER_IDS) {
      expect(parseClientMessage(msg({ t: 'char', id })).ok).toBe(true);
      expect(parseClientMessage(msg({ t: 'hello', name: 'P', ch: id })).ok).toBe(true);
    }
    for (const id of ['fourarms', 'xlr8', 'heatblast', 'GOKU', '']) expect(parseClientMessage(msg({ t: 'char', id })).ok).toBe(false);
    for (const id of STAGE_IDS) expect(parseClientMessage(msg({ t: 'stage', id })).ok).toBe(true);
    expect(parseClientMessage(msg({ t: 'stage', id: null })).ok).toBe(true);
    expect(parseClientMessage(msg({ t: 'stage', id: 'moon' })).ok).toBe(false);
  });

  it('validates hello tokens, ping and ready fields', () => {
    expect(parseClientMessage(msg({ t: 'hello', tok: 'abcDEF12_-' })).ok).toBe(true);
    expect(parseClientMessage(msg({ t: 'hello', tok: 'short' })).ok).toBe(false);
    expect(parseClientMessage(msg({ t: 'hello', auth: 'not a jwt' })).ok).toBe(false);
    expect(parseClientMessage(msg({ t: 'ping', i: 1, c: 12.5 })).ok).toBe(true);
    expect(parseClientMessage(msg({ t: 'ping', i: 1, c: 1, p: 60001 })).ok).toBe(false);
    expect(parseClientMessage(msg({ t: 'ready', on: 1 })).ok).toBe(false);
  });

  it('sanitizes hello names in place', () => {
    const r = parseClientMessage(msg({ t: 'hello', name: '  <b>Nobi\u0007ta</b>   the   great hero  ' }));
    expect(r.ok).toBe(true);
    expect(r.msg.name).toBe(sanitizeName('  <b>Nobi\u0007ta</b>   the   great hero  '));
    expect(r.msg.name.length).toBeLessThanOrEqual(MAX_NAME_LEN);
    expect(r.msg.name).not.toMatch(/[<>\u0000-\u001f]/);
    expect(sanitizeName('')).toBe('Player');
  });
});

describe('room codes and server frames', () => {
  it('normalizes and validates room codes', () => {
    expect(isValidRoomCode(normalizeRoomCode(' abcde '))).toBe(true);
    expect(isValidRoomCode('ABCD')).toBe(false);
    expect(isValidRoomCode('ABCDI')).toBe(false); // I, L, O, 0 and 1 are excluded
  });

  it('decodeServer tolerates junk', () => {
    expect(decodeServer('{"v":2,"t":"pong","i":1}')).toMatchObject({ t: 'pong' });
    expect(decodeServer('{oops')).toBe(null);
    expect(decodeServer(5)).toBe(null);
  });

  it('expandLobby fills defaults', () => {
    const l = expandLobby({ code: 'ABCDE', ph: 'lobby', host: 0, p: [{ n: 'A', c: 'goku', r: 1, o: 1, ms: 40 }, null] });
    expect(l.players[0]).toEqual({ name: 'A', char: 'goku', ready: true, connected: true, ping: 40, authed: false });
    expect(l.players[1]).toBe(null);
    expect(l.stage).toBe(null);
  });
});

describe('snapshot packing', () => {
  it('round-trips a busy mid-match state with active projectiles and pool holes', () => {
    const s = createMatch({ p1: 'nobita', p2: 'ben10', stage: 'suburb', seed: 4, training: {} });
    for (let i = 0; i < 30; i++) step(s, [i % 15 === 0 ? BTN.SPECIAL : 0, i === 5 ? BTN.SPECIAL : 0]);
    expect(s.projectiles.some((p) => p.active)).toBe(true);
    const packed = JSON.parse(JSON.stringify(packState(s)));
    expect(JSON.stringify(packed)).toContain(JSON.stringify(INACTIVE));
    expect(packed.config).toBeUndefined();
    const copy = createMatch({ p1: 'nobita', p2: 'ben10', stage: 'suburb', seed: 4, training: {} });
    const fighters = copy.fighters;
    applyPackedState(copy, packed);
    expect(copy.fighters).toBe(fighters); // object identity kept for the renderer
    expect(JSON.stringify(packState(copy))).toBe(JSON.stringify(packState(s)));
  });

  it('keeps a full snapshot small', () => {
    const s = createMatch({ p1: 'goku', p2: 'bheem', stage: 'island', seed: 1 });
    for (let i = 0; i < 300; i++) step(s, [BTN.RIGHT, BTN.LEFT]);
    expect(JSON.stringify(packState(s)).length).toBeLessThan(4000);
  });
});
