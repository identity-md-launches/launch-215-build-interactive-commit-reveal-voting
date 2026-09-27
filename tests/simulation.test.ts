import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { commitmentOf, countsOf, defaultDrafts, initialState, phaseOf, replay, SCENARIOS, tallyOf, transition, VOTERS, type Action, type Option, type State } from '../src/simulation';

const alice: Action = { type: 'commit', voter: 'Alice', ...defaultDrafts().Alice };
const revealAlice: Action = { ...alice, type: 'reveal' };
const apply = (actions: Action[]) => replay(actions).state;
const revealState = () => apply([alice, { type: 'advance', to: 10 }]);
function rejected(state: State, action: Action, code: string) {
  const original = structuredClone(state);
  const outcome = transition(state, action);
  assert.equal(outcome.event.accepted, false);
  assert.equal(outcome.event.code, code);
  assert.deepEqual(outcome.state, original);
  assert.deepEqual(state, original);
}

test('empty state has three zero tallies and a manual clock', () => {
  assert.equal(phaseOf(initialState()), 'Commit');
  assert.deepEqual(tallyOf(initialState()), [0, 0, 0]);
  assert.deepEqual(countsOf(initialState()), { committed: 0, revealed: 0 });
});
test('commitment matches Node SHA-256 of the documented canonical array', () => {
  const expected = createHash('sha256').update(JSON.stringify(['ballot-lab:v1', 'community-fund-001', 'Alice', 0, 'a|b🌱'])).digest('hex');
  assert.equal(commitmentOf('Alice', 0, 'a|b🌱'), expected);
  assert.equal(expected.length, 64);
});
test('commitment binds voter, option and exact salt, including whitespace', () => {
  const values = [commitmentOf('Alice', 0, 'salt'), commitmentOf('Bob', 0, 'salt'), commitmentOf('Alice', 1, 'salt'), commitmentOf('Alice', 0, 'salt '), commitmentOf('Alice', 0, 'Salt')];
  assert.equal(new Set(values).size, 5);
});
test('committing stores only a hash and does not add a vote or mutate input', () => {
  const before = initialState();
  const after = transition(before, alice).state;
  assert.deepEqual(before, initialState());
  assert.deepEqual(Object.keys(after.ballots.Alice!), ['commitment', 'revealed']);
  assert.equal(after.ballots.Alice!.revealed, null);
  assert.deepEqual(tallyOf(after), [0, 0, 0]);
});
test('a valid reveal adds exactly one vote', () => {
  const outcome = transition(revealState(), revealAlice);
  assert.equal(outcome.event.code, 'REVEALED');
  assert.deepEqual(tallyOf(outcome.state), [1, 0, 0]);
});
test('wrong-salt failure preserves state and permits recovery', () => {
  const before = revealState();
  rejected(before, { ...revealAlice, salt: 'wrong' }, 'COMMITMENT_MISMATCH');
  assert.equal(transition(before, revealAlice).event.accepted, true);
});
test('wrong option fails even with the original salt', () => {
  rejected(revealState(), { ...revealAlice, option: 1 }, 'COMMITMENT_MISMATCH');
});
test('a commitment copied between voters cannot be revealed', () => {
  const s = revealState();
  const copied: State = { ...s, ballots: { Bob: s.ballots.Alice } };
  rejected(copied, { ...revealAlice, voter: 'Bob' }, 'COMMITMENT_MISMATCH');
});
test('duplicate commit cannot replace a commitment', () => {
  rejected(apply([alice]), { ...alice, option: 2 }, 'ALREADY_COMMITTED');
});
test('duplicate reveal cannot add a second vote', () => {
  const s = transition(revealState(), revealAlice).state;
  rejected(s, revealAlice, 'ALREADY_REVEALED');
  assert.deepEqual(tallyOf(s), [1, 0, 0]);
});
test('reveals require an earlier commitment', () => {
  rejected({ ...initialState(), tick: 10 }, revealAlice, 'NO_COMMITMENT');
});
test('empty, whitespace-only and overlong salts are rejected', () => {
  for (const salt of ['', '   ', 's'.repeat(65)]) rejected(initialState(), { ...alice, salt }, 'INVALID_SALT');
  assert.equal(transition(initialState(), { ...alice, salt: 's'.repeat(64) }).event.accepted, true);
});
test('commit window is 0–9 inclusive; reveal window is 10–19 inclusive', () => {
  for (const tick of [0, 9]) assert.equal(transition({ ...initialState(), tick }, alice).event.accepted, true);
  for (const tick of [10, 19, 20]) rejected({ ...initialState(), tick }, alice, 'WRONG_PHASE');
  for (const tick of [10, 19]) assert.equal(transition({ ...revealState(), tick }, revealAlice).event.accepted, true);
  for (const tick of [0, 9, 20]) rejected({ ...revealState(), tick }, revealAlice, 'WRONG_PHASE');
});
test('clock accepts forward integer ticks only and never advances itself', () => {
  const s = { ...initialState(), tick: 5 };
  for (const to of [0, 5, 5.5, 100, NaN, Infinity]) rejected(s, { type: 'advance', to }, 'INVALID_CLOCK');
  assert.equal(transition(s, { type: 'advance', to: 99 }).state.tick, 99);
  assert.equal(replay([alice]).state.tick, 0);
});
test('early finalization fails; finalizing at 20 seals every action', () => {
  rejected({ ...initialState(), tick: 19 }, { type: 'finalize' }, 'WRONG_PHASE');
  const s = apply([{ type: 'advance', to: 20 }, { type: 'finalize' }]);
  assert.equal(phaseOf(s), 'Finalized');
  for (const a of [alice, revealAlice, { type: 'finalize' } as Action, { type: 'advance', to: 21 } as Action]) rejected(s, a, 'FINALIZED');
});
test('empty finalization has no winner and no votes', () => {
  assert.deepEqual(tallyOf(apply([{ type: 'advance', to: 20 }, { type: 'finalize' }])), [0, 0, 0]);
});
test('all fixed scenarios replay deterministically at every prefix', () => {
  for (const sample of SCENARIOS) {
    assert.deepEqual(replay(sample.actions), replay(structuredClone(sample.actions)));
    for (let i = 0; i <= sample.actions.length; i++) {
      const prefix = replay(sample.actions.slice(0, i));
      assert.deepEqual(prefix.events, replay(sample.actions).events.slice(0, i));
      assert.equal(prefix.events.length, i);
      assert.ok(countsOf(prefix.state).revealed <= countsOf(prefix.state).committed);
    }
  }
});
test('rejected scenario records exactly early reveal, wrong salt and duplicate reveal', () => {
  const sample = replay(SCENARIOS.find(s => s.id === 'failures')!.actions);
  assert.deepEqual(sample.events.filter(e => !e.accepted).map(e => e.code), ['WRONG_PHASE', 'COMMITMENT_MISMATCH', 'ALREADY_REVEALED']);
  assert.deepEqual(tallyOf(sample.state), [2, 1, 0]);
});
test('missed-reveal scenario excludes Charlie and rejects a late reveal', () => {
  const sample = replay(SCENARIOS.find(s => s.id === 'missing')!.actions);
  assert.deepEqual(tallyOf(sample.state), [2, 0, 0]);
  assert.equal(sample.state.ballots.Charlie!.revealed, null);
  assert.equal(sample.events.at(-2)!.code, 'WRONG_PHASE');
});
test('tie scenario retains all three equal counts', () => {
  assert.deepEqual(tallyOf(apply(SCENARIOS.find(s => s.id === 'tie')!.actions)), [1, 1, 1]);
});
test('unknown voters and options fail at the engine boundary', () => {
  rejected(initialState(), { ...alice, voter: 'Mallory' as typeof VOTERS[number] }, 'INVALID_BALLOT');
  rejected(initialState(), { ...alice, option: 3 as Option }, 'INVALID_BALLOT');
});
