import { useMemo, useRef, useState } from 'react';
import { Icon, type IconName } from './Icon';
import { VOTERS, OPTIONS, SCENARIOS, commitmentOf, countsOf, defaultDrafts, phaseOf, replay, tallyOf, transition, type Action, type Event, type Option, type Voter } from './simulation';

const optionIcons: IconName[] = ['garden', 'book', 'bike'];
type Drafts = ReturnType<typeof defaultDrafts>;

export default function App() {
  const [actions, setActions] = useState<Action[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [voter, setVoter] = useState<Voter>('Alice');
  const [drafts, setDrafts] = useState<Drafts>(defaultDrafts);
  const [mode, setMode] = useState<'commit' | 'reveal'>('commit');
  const [scenario, setScenario] = useState('complete');
  const [filter, setFilter] = useState('all');
  const [feedback, setFeedback] = useState<Event | null>(null);
  const [notice, setNotice] = useState('');
  const [undo, setUndo] = useState<{ actions: Action[]; drafts: Drafts } | null>(null);
  const [saltError, setSaltError] = useState(false);
  const saltRef = useRef<HTMLInputElement>(null);
  const live = useMemo(() => replay(actions), [actions]);
  const shown = useMemo(() => cursor === null ? live : replay(actions.slice(0, cursor)), [actions, cursor, live]);
  const { state } = shown;
  const phase = phaseOf(state);
  const count = countsOf(state);
  const tally = tallyOf(state);
  const isReplay = cursor !== null;
  const draft = drafts[voter];
  const currentBallot = state.ballots[voter];
  const canCommit = phase === 'Commit' && !currentBallot;
  const canReveal = phase === 'Reveal' && !!currentBallot && currentBallot.revealed === null;
  const maxVotes = Math.max(...tally);
  const winners = OPTIONS.filter((_, index) => tally[index] === maxVotes);
  const resultLabel = !state.finalized ? 'Waiting for finalization' : maxVotes === 0 ? 'No votes revealed' : winners.length > 1 ? 'The vote is tied' : `${winners[0]} wins`;
  const selectedScenario = SCENARIOS.find(s => s.id === scenario)!;
  const filteredEvents = live.events.map((event, index) => ({ event, index })).filter(({ event }) => filter === 'all' || (filter === 'accepted') === event.accepted);

  function dispatch(action: Action) {
    if (isReplay) return;
    const outcome = transition(live.state, action);
    setActions(previous => [...previous, action]);
    setFeedback(outcome.event);
    setNotice('');
    setUndo(null);
    setSaltError(outcome.event.code === 'INVALID_SALT');
    if (outcome.event.code === 'INVALID_SALT') saltRef.current?.focus();
    if (action.type === 'advance' && outcome.event.accepted && phaseOf(outcome.state) === 'Reveal') setMode('reveal');
  }
  function replace(next: Action[], message: string) {
    setUndo({ actions, drafts });
    setActions(next);
    setCursor(null);
    setFeedback(null);
    setNotice(message);
    setSaltError(false);
    setFilter('all');
    setVoter('Alice');
    setMode('commit');
    const nextDrafts = defaultDrafts();
    for (const action of next) if (action.type === 'commit') nextDrafts[action.voter] = { option: action.option, salt: action.salt };
    setDrafts(nextDrafts);
  }
  function updateDraft(patch: Partial<Drafts[Voter]>) {
    setDrafts(previous => ({ ...previous, [voter]: { ...previous[voter], ...patch } }));
    setSaltError(false);
  }
  function restoreValues() {
    const original = live.events.find(e => e.code === 'COMMITTED' && 'voter' in e.action && e.action.voter === voter)?.action;
    if (original && 'salt' in original) {
      updateDraft({ option: original.option, salt: original.salt });
      setNotice(`${voter}’s original option and mock salt restored.`);
    }
  }
  function viewEvent(next: number | null) {
    setCursor(next);
    setNotice(next === null ? 'Returned to the live simulation.' : `Replay: showing the state after ${next} of ${actions.length} events.`);
  }

  return <>
    <a className="skip-link" href="#simulator">Skip to simulator</a>
    <header className="site-header">
      <div className="header-inner">
        <a href="#" className="brand" aria-label="Ballot lab home"><img src="./favicon.svg" alt="" width="34" height="34" />ballot<span>lab</span></a>
        <nav aria-label="Main navigation"><a className="nav-active" href="#simulator">Simulator</a><a href="#how-it-works">How it works <span aria-hidden="true">↗</span></a></nav>
        <span className="sandbox-badge"><span className="status-dot" /> Local sandbox</span>
      </div>
    </header>

    <main id="simulator" className="page">
      <section className="intro" aria-labelledby="page-title">
        <div><p className="eyebrow">The commit–reveal playground</p><h1 id="page-title">A vote in three acts<span>.</span></h1><p className="intro-copy">Commit a choice. Reveal your hand. See what counts.<br className="desktop-break" /> Explore the rules of voting, one action at a time.</p></div>
        <div className="intro-note"><span className="outline-symbol"><Icon name="code" size={23} /></span><div><strong>Real rules. Mock votes.</strong><p>3 voters · 3 options · You control time.<br />No wallet, signatures or transactions.</p></div></div>
      </section>

      <section className="clock-card" aria-labelledby="clock-title">
        <div className="clock-top"><div className="section-label"><Icon name="clock" /><h2 id="clock-title">Simulation clock</h2><span className="tag">Manual</span></div><div className="tick-display"><span>Current tick</span><strong data-testid="tick">{String(state.tick).padStart(2, '0')}</strong><span className="clock-divider" /><button className="text-button" disabled={isReplay || state.finalized || state.tick >= 99} onClick={() => dispatch({ type: 'advance', to: state.tick + 1 })}>+1 tick</button></div></div>
        <div className="clock-body">
          <ol className="phase-track" aria-label="Voting phases">
            {(['Commit', 'Reveal', 'Finalize'] as const).map((name, i) => {
              const active = phase === name || name === 'Finalize' && state.finalized;
              const complete = i < (state.tick < 10 ? 0 : state.tick < 20 ? 1 : 2) || state.finalized;
              return <li key={name} className={`${active ? 'phase-active' : ''} ${complete ? 'phase-complete' : ''}`} aria-current={active ? 'step' : undefined}><span className="phase-number">{complete ? <Icon name="check" size={15} /> : `0${i + 1}`}</span><div><strong>{name === 'Finalize' && state.finalized ? 'Finalized' : name}</strong><span>{['Ticks 0–9', 'Ticks 10–19', 'Tick 20+'][i]}</span></div>{active && <span className="phase-now">{state.finalized ? 'Done' : 'Now'}</span>}</li>;
            })}
          </ol>
          <button className="button clock-next" disabled={isReplay || state.tick >= 20 || state.finalized} onClick={() => dispatch({ type: 'advance', to: state.tick < 10 ? 10 : 20 })}>{state.tick < 10 ? 'Advance to reveal' : state.tick < 20 ? 'Advance to finalize' : 'Clock complete'}<Icon name="arrow" /></button>
        </div>
        <p className="clock-hint">{state.finalized ? 'The result is final. Replay the log or reset to explore again.' : state.tick < 10 ? 'Commitments are open. Choices stay out of the tally until they are revealed.' : state.tick < 20 ? 'Reveals are open. Submit the exact option and salt used in each commitment.' : 'Voting is closed. Finalize to seal the tally; missing reveals do not count.'}</p>
      </section>

      <div className="workspace-heading"><div><h2>Your experiment</h2><span className="subtle">All participants and ballots are mock data.</span></div><button className="button button-quiet" onClick={() => replace([], 'Simulation reset. You can undo until your next action.')}><Icon name="reset" size={16} />Reset simulation</button></div>
      <div className="notice" role="status">{notice}{undo && <button className="inline-button" onClick={() => { setActions(undo.actions); setDrafts(undo.drafts); setCursor(null); setUndo(null); setFeedback(null); setNotice('Previous simulation restored.'); }}>Undo</button>}</div>
      {isReplay && <div className="replay-banner"><span><Icon name="play" />Replay · State after event {cursor} of {actions.length}. Voting controls are paused.</span><button className="button button-small" onClick={() => viewEvent(null)}>Return to live</button></div>}

      <div className="workspace-grid">
        <section className="panel ballot-panel" aria-labelledby="ballot-title">
          <div className="panel-heading"><div><p className="eyebrow">01 / Take a seat</p><h3 id="ballot-title">Cast a mock vote</h3></div><span className="tag">{phase} phase</span></div>
          <form noValidate onSubmit={e => { e.preventDefault(); dispatch({ type: mode, voter, ...draft }); }}>
            <fieldset disabled={isReplay} className="voter-field"><legend>Act as a voter</legend><div className="voter-choices">{VOTERS.map((name, i) => <label key={name} className={`voter-choice ${voter === name ? 'selected' : ''}`}><input type="radio" name="voter" value={name} checked={voter === name} onChange={() => { setVoter(name); setSaltError(false); }} /><span className={`avatar avatar-${i}`}>{name[0]}</span><span>{name}</span><span className="radio-dot" aria-hidden="true" /></label>)}</div></fieldset>
            <div className="action-switch" role="group" aria-label="Choose a voting action"><button type="button" aria-pressed={mode === 'commit'} disabled={isReplay} onClick={() => setMode('commit')}><Icon name="lock" size={16} />Commit</button><button type="button" aria-pressed={mode === 'reveal'} disabled={isReplay} onClick={() => setMode('reveal')}><Icon name="eye" size={17} />Reveal</button></div>
            <fieldset disabled={isReplay} className="option-field"><legend>Where should the community fund go?</legend><div className="option-choices">{OPTIONS.map((option, i) => <label key={option} className={`option-choice ${draft.option === i ? 'selected' : ''}`}><input type="radio" name="option" value={i} checked={draft.option === i} onChange={() => updateDraft({ option: i as Option })} /><span className="option-top"><Icon name={optionIcons[i]} size={23} /><span className="radio-dot" aria-hidden="true" /></span><strong>{option}</strong><span>Option {String.fromCharCode(65 + i)}</span></label>)}</div></fieldset>
            <div className="salt-heading"><label htmlFor="salt">Secret salt <span className="subtle">(mock value)</span></label>{currentBallot && <button className="inline-button" type="button" disabled={isReplay} onClick={restoreValues}>Restore committed values</button>}</div>
            <input ref={saltRef} className="salt-input" id="salt" name="salt" type="text" autoComplete="off" spellCheck={false} maxLength={64} value={draft.salt} disabled={isReplay} aria-invalid={saltError || undefined} aria-describedby={saltError ? 'salt-help salt-error' : 'salt-help'} onChange={e => updateDraft({ salt: e.target.value })} />
            <p id="salt-help" className="field-hint">A salt is extra text that hides a predictable choice. Keep it for the reveal.</p>
            {saltError && <p className="field-error" id="salt-error">Enter a mock salt of 1–64 characters, then try again.</p>}
            <details className="hash-details"><summary><Icon name="code" size={16} />Inspect commitment<span>SHA-256</span></summary><div className="hash-content"><p>Hash of the demo version, vote ID, voter, option and exact salt, encoded as a JSON array. Changing any value changes the commitment.</p><code>{JSON.stringify(['ballot-lab:v1', 'community-fund-001', voter, draft.option, draft.salt])}</code><span className="hash-label">Current inputs produce</span><code>{commitmentOf(voter, draft.option, draft.salt)}</code>{currentBallot && <><span className="hash-label">Stored commitment</span><code>{currentBallot.commitment}</code></>}</div></details>
            <div className="submit-row"><button className="button button-primary" type="submit" disabled={isReplay}><Icon name={mode === 'commit' ? 'lock' : 'eye'} />{mode === 'commit' ? 'Commit vote' : 'Reveal vote'}<Icon name="arrow" /></button><span className={`action-availability ${mode === 'commit' ? canCommit ? 'allowed' : '' : canReveal ? 'allowed' : ''}`}><span className="status-dot" />{(mode === 'commit' ? canCommit : canReveal) ? 'Allowed now' : 'Will be rejected'}<small>{mode === 'commit' ? currentBallot ? 'This voter already committed.' : phase !== 'Commit' ? 'The commit window is closed.' : 'One commitment per voter.' : currentBallot?.revealed != null ? 'This voter already revealed.' : phase !== 'Reveal' ? 'Reveal only at ticks 10–19.' : !currentBallot ? 'Commitment required first.' : 'Exact option and salt required.'}</small></span></div>
          </form>
          <div className="feedback-region" role="status" aria-live="polite">{feedback && !isReplay && <div className={`feedback ${feedback.accepted ? 'feedback-success' : 'feedback-error'}`}><Icon name={feedback.accepted ? 'check' : 'x'} /><div><strong>{feedback.accepted ? 'Accepted' : 'Rejected'} · {feedback.title}</strong><p>{feedback.message}</p><p className="feedback-change">{feedback.change}</p></div></div>}</div>
          <details className="failure-details"><summary>Test the rejection rules <span aria-hidden="true">+</span></summary><p>In the reveal phase, use a wrong salt before revealing, then try a duplicate after a successful reveal. Every attempt appears in the log.</p><div className="failure-actions"><button className="button button-small" disabled={isReplay || !canReveal} onClick={() => dispatch({ type: 'reveal', voter, option: draft.option, salt: commitmentOf(voter, draft.option, 'deliberately-wrong') === currentBallot?.commitment ? 'different-salt' : 'deliberately-wrong' })}>Try wrong salt</button><button className="button button-small" disabled={isReplay || phase !== 'Reveal' || currentBallot?.revealed == null} onClick={() => dispatch({ type: 'reveal', voter, ...draft })}>Try duplicate reveal</button></div></details>
        </section>

        <aside className="state-column" aria-label="Simulation state">
          <section className="panel tally-panel" aria-labelledby="tally-title"><div className="panel-heading"><div><p className="eyebrow">02 / Watch it unfold</p><h3 id="tally-title">{state.finalized ? 'Final tally' : 'Live tally'}</h3></div><span className={`tag ${state.finalized ? 'tag-final' : ''}`}>{state.finalized ? 'Final' : 'Provisional'}</span></div>
            <div className="vote-count"><strong>{count.revealed}<span>/ 3</span></strong><div>votes revealed<span>{count.committed} commitments stored</span></div><span className="tally-icon"><Icon name={state.finalized ? 'check' : 'eye'} size={25} /></span></div>
            <div className="tally-options">{OPTIONS.map((option, i) => <div className="tally-option" key={option}><div><span><span className="option-letter">{String.fromCharCode(65 + i)}</span>{option}</span><strong>{tally[i]}<span> {tally[i] === 1 ? 'vote' : 'votes'}</span></strong></div><div className="bar-track" aria-hidden="true"><span style={{ width: `${tally[i] / 3 * 100}%` }} /></div></div>)}</div>
            <p className={`result-label ${state.finalized ? 'result-final' : ''}`} data-testid="result">{state.finalized ? <Icon name="check" size={16} /> : <Icon name="lock" size={15} />}{resultLabel}</p>
            <button className="button finalize-button" disabled={isReplay || state.finalized} onClick={() => dispatch({ type: 'finalize' })}>{state.finalized ? 'Vote finalized' : 'Finalize vote'}<Icon name="check" size={17} /></button><p className="field-hint centered">{state.finalized ? `${3 - count.revealed} unrevealed votes excluded. Ties remain ties.` : state.tick >= 20 ? 'Allowed now · seals the current tally.' : 'Allowed from tick 20. Earlier attempts are rejected.'}</p>
          </section>
          <section className="panel voters-panel" aria-labelledby="voters-title"><div className="mini-heading"><h3 id="voters-title">Voter status</h3><span className="subtle">3 mock voters</span></div>{VOTERS.map((name, i) => { const ballot = state.ballots[name]; const status = ballot?.revealed != null ? 'Revealed' : ballot ? state.tick >= 20 ? 'Missed reveal' : 'Committed' : 'Not committed'; return <div className="voter-status" key={name}><span className={`avatar avatar-${i}`}>{name[0]}</span><strong>{name}</strong><span className={`voter-state ${status === 'Revealed' ? 'voter-revealed' : ''}`}>{status === 'Revealed' && <Icon name="check" size={13} />}{status}</span></div>; })}</section>
        </aside>
      </div>

      <section className="scenario-strip" aria-labelledby="scenario-title"><span className="scenario-icon"><Icon name="play" size={23} /></span><div className="scenario-copy"><h2 id="scenario-title">A little less setup. A little more discovery.</h2><p>Load a deterministic example, then replay each decision.</p></div><div className="scenario-controls"><label className="sr-only" htmlFor="scenario">Sample scenario</label><select id="scenario" value={scenario} onChange={e => setScenario(e.target.value)}>{SCENARIOS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select><button className="button" onClick={() => replace(selectedScenario.actions, `${selectedScenario.name} loaded. ${selectedScenario.description} Select Replay from start below.`)}>Load scenario<Icon name="arrow" size={16} /></button></div></section>

      <section className="panel event-panel" id="event-log" aria-labelledby="events-title"><div className="panel-heading"><div><p className="eyebrow">03 / Follow the evidence</p><h2 id="events-title">Event log <span className="event-count">{live.events.length}</span></h2></div><div className="log-controls"><label className="sr-only" htmlFor="event-filter">Filter events</label><select id="event-filter" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All events</option><option value="accepted">Accepted only</option><option value="rejected">Rejected only</option></select><button className="button button-small" disabled={!actions.length} onClick={() => { setFilter('all'); viewEvent(0); }}><Icon name="play" size={15} />Replay from start</button></div></div>
        <p className="log-description">Every action leaves a trace. Select an event to inspect the state it produced.</p>
        {isReplay && <div className="replay-controls"><button className="button button-small" disabled={cursor === 0} onClick={() => viewEvent(cursor - 1)}>Previous event</button><span>Event <strong>{cursor}</strong> / {actions.length}</span><button className="button button-small" disabled={cursor === actions.length} onClick={() => viewEvent(cursor + 1)}>Next event<Icon name="chevron" size={14} /></button><button className="inline-button" onClick={() => viewEvent(null)}>Return to live</button></div>}
        {filteredEvents.length === 0 ? <div className="empty-log"><span><Icon name={actions.length ? 'eye' : 'code'} size={24} /></span><h3>{actions.length ? 'No events match this filter' : 'Every vote has a story. Start yours.'}</h3><p>{actions.length ? 'Choose All events to see the full experiment.' : 'Commit your first vote above, or load a sample scenario.'}</p>{actions.length > 0 && <button className="button button-small" onClick={() => setFilter('all')}>Show all events</button>}</div> : <ol className="event-list">{filteredEvents.map(({ event, index }) => <li key={index} className={cursor === index + 1 ? 'event-selected' : ''}><button className="event-row" aria-current={cursor === index + 1 ? 'step' : undefined} onClick={() => viewEvent(index + 1)}><span className="event-index">{String(index + 1).padStart(2, '0')}</span><span className={`event-symbol ${event.accepted ? 'accepted' : 'rejected'}`}><Icon name={event.accepted ? 'check' : 'x'} size={15} /></span><span className="event-text"><strong>{event.title}</strong><span>{event.change}</span></span><span className={`event-outcome ${event.accepted ? 'accepted' : 'rejected'}`}>{event.accepted ? 'Accepted' : 'Rejected'}</span><span className="event-tick">t={event.tick}</span><Icon name="chevron" size={16} /></button>{cursor === index + 1 && <div className="event-detail"><p>{event.message}</p><code>{JSON.stringify(event.action)}</code><span>{event.code} · Mock inputs are intentionally visible.</span></div>}</li>)}</ol>}
        <div className="log-footer"><span><span className="status-dot" />Local events only</span><span>Session only · Refresh starts a new simulation</span></div>
      </section>

      <section id="how-it-works" className="explanation" aria-labelledby="how-title"><div className="explanation-heading"><p className="eyebrow">A peek under the hood</p><h2 id="how-title">Hide the choice. Keep the promise.</h2><p>Commit–reveal separates choosing from counting, so a commitment can’t be changed after seeing other votes.</p></div><div className="explanation-grid"><article><span className="explanation-number">01</span><h3>Commit privately</h3><p>Choose an option and a salt. A SHA-256 hash binds them to the voter. Only the commitment enters the voting state.</p></article><article><span className="explanation-number">02</span><h3>Reveal the proof</h3><p>Submit the same choice and salt during ticks 10–19. A matching hash adds one vote. Wrong salts and repeats are rejected.</p></article><article><span className="explanation-number">03</span><h3>Count what’s revealed</h3><p>At tick 20, anyone can finalize. Unrevealed votes are excluded. The most votes wins; tied options stay tied.</p></article></div>
        <div className="demo-notice"><Icon name="info" size={20} /><p><strong>A learning tool, not an audited on-chain voting product.</strong> All data is mock and stays in this page’s memory. Salts and choices are visible in the demo’s inputs and log; use no real secrets. Production voting needs secure randomness, private storage, identity checks and independent security review.</p></div>
      </section>
      <footer className="site-footer"><span className="footer-brand">ballot lab <span>/</span> A small experiment in collective decisions.</span><a href="#simulator">Back to simulator <span aria-hidden="true">↑</span></a></footer>
    </main>
  </>;
}
