import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

export const VOTERS = ['Alice', 'Bob', 'Charlie'] as const;
export const OPTIONS = ['Community garden', 'Public library', 'Bike lanes'] as const;
export type Voter = typeof VOTERS[number];
export type Option = 0 | 1 | 2;
export type Phase = 'Commit' | 'Reveal' | 'Finalize' | 'Finalized';
export type Action =
  | { type: 'commit' | 'reveal'; voter: Voter; option: Option; salt: string }
  | { type: 'advance'; to: number }
  | { type: 'finalize' };
export type Ballot = { commitment: string; revealed: Option | null };
export type State = { tick: number; finalized: boolean; ballots: Partial<Record<Voter, Ballot>> };
export type Event = { action: Action; tick: number; accepted: boolean; title: string; message: string; change: string; code: string };
export const initialState = (): State => ({ tick: 0, finalized: false, ballots: {} });
export const phaseOf = (s: State): Phase => s.finalized ? 'Finalized' : s.tick < 10 ? 'Commit' : s.tick < 20 ? 'Reveal' : 'Finalize';
export const commitmentOf = (voter: Voter, option: Option, salt: string) => bytesToHex(sha256(utf8ToBytes(JSON.stringify(['ballot-lab:v1', 'community-fund-001', voter, option, salt]))));
export const tallyOf = (s: State) => OPTIONS.map((_, i) => Object.values(s.ballots).filter(b => b.revealed === i).length);
export const countsOf = (s: State) => ({ committed: Object.keys(s.ballots).length, revealed: Object.values(s.ballots).filter(b => b.revealed !== null).length });

export function transition(s: State, action: Action): { state: State; event: Event } {
  const phase = phaseOf(s);
  const finish = (accepted: boolean, code: string, title: string, message: string, state = s, change = 'No state change.') => ({
    state, event: { action, tick: state.tick, accepted, title, message, change, code },
  });
  const reject = (code: string, title: string, message: string) => finish(false, code, title, message);
  if (s.finalized) return reject('FINALIZED', 'Vote already finalized', 'The result is sealed. Reset the simulation to try another vote.');
  if (action.type === 'advance') {
    if (!Number.isInteger(action.to) || action.to <= s.tick || action.to > 99) return reject('INVALID_CLOCK', 'Clock change rejected', 'Choose a whole tick greater than the current tick, up to 99.');
    const next = { ...s, tick: action.to };
    return finish(true, 'CLOCK_ADVANCED', `Clock advanced to tick ${action.to}`, `${phaseOf(next)} phase is now open. Time moves only when you advance it.`, next, `Clock: ${s.tick} → ${action.to}. Phase: ${phase} → ${phaseOf(next)}.`);
  }
  if (action.type === 'finalize') {
    if (s.tick < 20) return reject('WRONG_PHASE', 'Too early to finalize', 'Advance the clock to tick 20. Only revealed votes will count.');
    const count = countsOf(s).revealed;
    return finish(true, 'FINALIZED', 'Vote finalized', `${count} of 3 votes counted. Unrevealed commitments do not count.`, { ...s, finalized: true }, 'Result: provisional → final. Voting is closed.');
  }
  if (!VOTERS.includes(action.voter) || ![0, 1, 2].includes(action.option)) return reject('INVALID_BALLOT', 'Unknown ballot', 'Choose one of the three mock voters and three options.');
  const { voter, option, salt } = action;
  const expected = action.type === 'commit' ? 'Commit' : 'Reveal';
  if (phase !== expected) return reject('WRONG_PHASE', `${voter}’s ${action.type} rejected`, action.type === 'commit' ? 'Commitments are accepted at ticks 0–9. Reset to start a new vote.' : s.tick < 10 ? 'Reveal opens at tick 10. Advance the clock, then try again.' : 'Reveal closed at tick 20. Reset to start a new vote.');
  const ballot = s.ballots[voter];
  if (action.type === 'commit' && ballot) return reject('ALREADY_COMMITTED', `${voter} already committed`, 'Each voter can commit once. Switch voters or move to the reveal phase.');
  if (action.type === 'reveal' && !ballot) return reject('NO_COMMITMENT', `${voter} has no commitment`, 'A reveal needs an earlier commitment. Try a voter who committed, or reset.');
  if (action.type === 'reveal' && ballot?.revealed !== null) return reject('ALREADY_REVEALED', 'Duplicate reveal rejected', `${voter} already revealed. Each voter can add only one vote to the tally.`);
  if (!salt.trim() || salt.length > 64) return reject('INVALID_SALT', 'Salt needs a value', 'Enter a mock salt of 1–64 characters. Keep the exact same value for the reveal.');
  const commitment = commitmentOf(voter, option, salt);
  if (action.type === 'reveal' && ballot?.commitment !== commitment) return reject('COMMITMENT_MISMATCH', 'Commitment does not match', 'The voter, option and salt must match the original commitment exactly. Restore the original values and try again.');
  const next: State = { ...s, ballots: { ...s.ballots, [voter]: { commitment, revealed: action.type === 'reveal' ? option : null } } };
  return action.type === 'commit'
    ? finish(true, 'COMMITTED', `${voter} committed a vote`, 'The commitment is stored. The choice has not been added to the tally.', next, `${voter}: not committed → committed. Commitments: ${countsOf(s).committed} → ${countsOf(next).committed}.`)
    : finish(true, 'REVEALED', `${voter} revealed a vote`, `${OPTIONS[option]} receives one vote. The commitment matched.`, next, `${voter}: committed → revealed. ${OPTIONS[option]}: ${tallyOf(s)[option]} → ${tallyOf(next)[option]}.`);
}

export function replay(actions: Action[]) {
  let state = initialState();
  const events: Event[] = [];
  for (const action of actions) {
    const result = transition(state, action);
    state = result.state;
    events.push(result.event);
  }
  return { state, events };
}

export const defaultDrafts = () => ({
  Alice: { option: 0 as Option, salt: 'alice-fern-17' },
  Bob: { option: 0 as Option, salt: 'bob-cedar-42' },
  Charlie: { option: 1 as Option, salt: 'charlie-oak-09' },
});
const samples = VOTERS.map(voter => ({ voter, ...defaultDrafts()[voter] }));
const commits: Action[] = samples.map(s => ({ type: 'commit', ...s }));
const reveals: Action[] = samples.map(s => ({ type: 'reveal', ...s }));
export const SCENARIOS: { id: string; name: string; description: string; actions: Action[] }[] = [
  { id: 'complete', name: 'A complete vote', description: 'Three commitments, three reveals. The community garden wins 2–1.', actions: [...commits, { type: 'advance', to: 10 }, ...reveals, { type: 'advance', to: 20 }, { type: 'finalize' }] },
  { id: 'failures', name: 'Wrong salt & duplicate reveal', description: 'An early reveal, a wrong salt and a duplicate are rejected. Correct reveals still count.', actions: [...commits, reveals[0], { type: 'advance', to: 10 }, { ...samples[0], type: 'reveal', salt: 'wrong-salt' }, reveals[0], reveals[0], reveals[1], reveals[2], { type: 'advance', to: 20 }, { type: 'finalize' }] },
  { id: 'missing', name: 'A missed reveal', description: 'Charlie misses the reveal window. Only Alice and Bob’s two votes count.', actions: [...commits, { type: 'advance', to: 10 }, reveals[0], reveals[1], { type: 'advance', to: 20 }, reveals[2], { type: 'finalize' }] },
  { id: 'tie', name: 'A three-way tie', description: 'One revealed vote per option. A tie is reported without selecting a winner.', actions: [...samples.map((s, i) => ({ ...s, type: 'commit' as const, option: i as Option })), { type: 'advance', to: 10 }, ...samples.map((s, i) => ({ ...s, type: 'reveal' as const, option: i as Option })), { type: 'advance', to: 20 }, { type: 'finalize' }] },
];
