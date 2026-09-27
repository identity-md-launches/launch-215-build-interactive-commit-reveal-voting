import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import assert from 'node:assert/strict';

// A bounded server and browser session; both close before this command exits.
const dist = resolve('dist');
const evidence = resolve(process.env.EVIDENCE_DIR || 'artifacts');
await mkdir(evidence, { recursive: true });
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (!pathname.startsWith('/preview/')) throw new Error('Outside preview');
    const path = resolve(dist, pathname.slice('/preview/'.length) || 'index.html');
    if (!path.startsWith(dist + '/')) throw new Error('Outside dist');
    res.setHeader('Content-Type', types[extname(path)] || 'application/octet-stream');
    res.end(await readFile(path));
  } catch { res.statusCode = 404; res.end('Not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/preview/`;
const results = [];
const errors = [];
const requests = [];
let browser;
let page;
async function check(name, run) {
  await run();
  results.push({ name, result: 'pass' });
  console.log(`PASS ${name}`);
}
async function noOverflow() {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
}
async function tabTo(selector, max = 80) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    if (await page.locator(selector).evaluate(el => el === document.activeElement)) return;
  }
  throw new Error(`Keyboard could not reach ${selector}`);
}
async function loadScenario(id) {
  await page.locator('#scenario').selectOption(id);
  await page.getByRole('button', { name: 'Load scenario', exact: true }).click();
}
async function screenshot(name, fullPage = true) {
  const scrollY = await page.evaluate(() => window.scrollY);
  if (fullPage) await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: resolve(evidence, name), fullPage });
  if (fullPage) await page.evaluate(y => window.scrollTo(0, y), scrollY);
}
async function audit(label) {
  const report = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  const violations = report.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) }));
  await writeFile(resolve(evidence, `axe-${label}.json`), JSON.stringify({ violations, passes: report.passes.length, incomplete: report.incomplete.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })) }, null, 2));
  assert.deepEqual(violations, [], JSON.stringify(violations, null, 2));
}

try {
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('requestfailed', r => errors.push(`${r.url()}: ${r.failure()?.errorText}`));
  page.on('response', r => { requests.push({ path: new URL(r.url()).pathname, status: r.status(), local: new URL(r.url()).origin === new URL(url).origin }); if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  await check('Desktop: static subpath, empty state, loaded local font, no overflow', async () => {
    await expect(page).toHaveTitle('Ballot lab — Commit. Reveal. Decide.');
    await expect(page.getByTestId('tick')).toHaveText('00');
    await expect(page.getByText('Every vote has a story. Start yours.')).toBeVisible();
    assert.equal(await page.evaluate(() => document.fonts.check('500 16px Inter')), true);
    await noOverflow();
    await screenshot('desktop.png');
    await audit('desktop');
  });
  await check('Keyboard: skip link, salt error, commit, reveal, finalize', async () => {
    await page.keyboard.press('Tab');
    await expect(page.locator('.skip-link')).toBeFocused();
    await page.keyboard.press('Enter');
    await tabTo('#salt');
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.press('Backspace');
    await tabTo('.button-primary');
    assert.equal(await page.locator('.button-primary').evaluate(el => getComputedStyle(el).outlineWidth), '3px');
    await screenshot('keyboard-focus.png', false);
    await page.keyboard.press('Enter');
    await expect(page.locator('#salt')).toBeFocused();
    await expect(page.locator('#salt')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#salt-error')).toBeVisible();
    await page.keyboard.type('keyboard-salt');
    await tabTo('.button-primary');
    await page.keyboard.press('Enter');
    await expect(page.locator('.feedback')).toContainText('Alice committed a vote');
    await tabTo('.clock-next');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('tick')).toHaveText('10');
    await tabTo('.button-primary');
    await page.keyboard.press('Enter');
    await expect(page.locator('.vote-count')).toContainText('1');
    await expect(page.locator('.feedback')).toContainText('Alice revealed a vote');
    await tabTo('.clock-next');
    await page.keyboard.press('Enter');
    await tabTo('.finalize-button');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('result')).toHaveText('Community garden wins');
  });
  await check('Refresh clears in-memory state, input drafts and event history', async () => {
    await page.reload();
    await expect(page.getByTestId('tick')).toHaveText('00');
    await expect(page.locator('#salt')).toHaveValue('alice-fern-17');
    await expect(page.locator('.event-count')).toHaveText('0');
    assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
  });
  await check('Rejected actions: early finalize, duplicate commit, wrong salt, recovery, duplicate reveal', async () => {
    await page.locator('.finalize-button').click();
    await expect(page.locator('.feedback')).toContainText('Too early to finalize');
    await page.locator('.button-primary').click();
    await page.locator('.button-primary').click();
    await expect(page.locator('.feedback')).toContainText('already committed');
    await page.locator('.clock-next').click();
    await page.locator('.failure-details summary').click();
    await page.getByRole('button', { name: 'Try wrong salt', exact: true }).click();
    await expect(page.locator('.feedback')).toContainText('Commitment does not match');
    const pairs = await page.evaluate(() => {
      function rgb(value) { return value.match(/[\d.]+/g).slice(0, 3).map(Number); }
      function luminance(values) { return values.map(x => x / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4).reduce((sum, x, i) => sum + x * [.2126, .7152, .0722][i], 0); }
      const checks = [['Primary button', '.button-primary', 'color', null], ['Muted intro', '.intro-copy', 'color', null], ['Phase label', '.phase-active strong', 'color', null], ['Error text', '.feedback-error', 'color', null], ['Control border', '#salt', 'border-top-color', null], ['Focus on white', '.button-primary', '--focus', '#ffffff']];
      return checks.map(([name, selector, property, background]) => {
        const element = document.querySelector(selector);
        let parent = element;
        while (!background && parent) {
          const bg = getComputedStyle(parent).backgroundColor;
          if (bg !== 'rgba(0, 0, 0, 0)') background = bg;
          parent = parent.parentElement;
        }
        let foreground = getComputedStyle(element).getPropertyValue(property).trim();
        if (foreground.startsWith('#')) { const probe = document.createElement('span'); probe.style.color = foreground; element.append(probe); foreground = getComputedStyle(probe).color; probe.remove(); }
        if (background === '#ffffff') background = 'rgb(255, 255, 255)';
        const l1 = luminance(rgb(foreground)); const l2 = luminance(rgb(background));
        return { name, foreground, background, ratio: Number(((Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05)).toFixed(2)) };
      });
    });
    await writeFile(resolve(evidence, 'contrast.json'), JSON.stringify(pairs, null, 2));
    for (const pair of pairs) assert.ok(pair.ratio >= (pair.name.includes('border') || pair.name.includes('Focus') ? 3 : 4.5), `${pair.name}: ${pair.ratio}`);
    await expect(page.locator('.vote-count > strong')).toHaveText('0/ 3');
    await screenshot('wrong-salt.png', false);
    await page.locator('#salt').fill('edited-mock-value');
    await page.getByRole('button', { name: 'Restore committed values' }).click();
    await expect(page.locator('#salt')).toHaveValue('alice-fern-17');
    await page.locator('.button-primary').click();
    await page.getByRole('button', { name: 'Try duplicate reveal', exact: true }).click();
    await expect(page.locator('.feedback')).toContainText('Duplicate reveal rejected');
    await expect(page.locator('.vote-count > strong')).toHaveText('1/ 3');
    await audit('errors');
  });
  await check('Reset clears state; Undo restores it; new action consumes Undo', async () => {
    const events = await page.locator('.event-count').textContent();
    await page.getByRole('button', { name: 'Reset simulation' }).click();
    await expect(page.locator('.event-count')).toHaveText('0');
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(page.locator('.event-count')).toHaveText(events);
    await page.getByRole('button', { name: 'Reset simulation' }).click();
    await page.locator('.button-primary').click();
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toHaveCount(0);
  });
  await check('Scenario outcomes: complete, missed reveal, tie and deterministic errors', async () => {
    await loadScenario('complete');
    await expect(page.getByTestId('result')).toHaveText('Community garden wins');
    await expect(page.locator('.vote-count > strong')).toHaveText('3/ 3');
    await loadScenario('missing');
    await expect(page.locator('.vote-count > strong')).toHaveText('2/ 3');
    await expect(page.locator('.voter-status').last()).toContainText('Missed reveal');
    await loadScenario('tie');
    await expect(page.getByTestId('result')).toHaveText('The vote is tied');
    await loadScenario('failures');
    const first = await page.locator('.event-list').innerText();
    await loadScenario('failures');
    assert.equal(await page.locator('.event-list').innerText(), first);
    await expect(page.locator('.event-count')).toHaveText('12');
    await page.locator('#event-filter').selectOption('rejected');
    await expect(page.locator('.event-row')).toHaveCount(3);
    await page.locator('#event-filter').selectOption('all');
  });
  await check('Replay is read-only; previous/next and event selection reconstruct state; live state retained', async () => {
    await page.getByRole('button', { name: 'Replay from start' }).click();
    await expect(page.getByTestId('tick')).toHaveText('00');
    await expect(page.locator('.button-primary')).toBeDisabled();
    await expect(page.locator('#salt')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Previous event', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Next event', exact: false }).click();
    await expect(page.locator('.voter-status').first()).toContainText('Committed');
    await page.getByRole('button', { name: 'Previous event', exact: true }).click();
    await expect(page.locator('.voter-status').first()).toContainText('Not committed');
    await page.locator('.event-row').nth(5).click();
    await expect(page.getByTestId('tick')).toHaveText('10');
    await expect(page.locator('.event-detail')).toContainText('COMMITMENT_MISMATCH');
    await expect(page.locator('.vote-count > strong')).toHaveText('0/ 3');
    await screenshot('replay.png', false);
    await page.getByRole('button', { name: 'Return to live', exact: true }).first().click();
    await expect(page.getByTestId('tick')).toHaveText('20');
    await expect(page.getByTestId('result')).toHaveText('Community garden wins');
    await expect(page.locator('.event-count')).toHaveText('12');
  });
  await check('Filtered empty state provides recovery; empty finalization has no winner', async () => {
    await loadScenario('complete');
    await page.locator('#event-filter').selectOption('rejected');
    await expect(page.getByText('No events match this filter')).toBeVisible();
    await page.getByRole('button', { name: 'Show all events' }).click();
    await expect(page.locator('.event-row')).toHaveCount(9);
    await page.getByRole('button', { name: 'Reset simulation' }).click();
    await page.locator('.clock-next').click();
    await page.locator('.clock-next').click();
    await page.locator('.finalize-button').click();
    await expect(page.getByTestId('result')).toHaveText('No votes revealed');
  });
  await check('390px mobile: touch-sized main controls, radio keys, voting, long hashes, replay and reset', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
    await noOverflow();
    await screenshot('mobile-390.png');
    await screenshot('mobile-viewport.png', false);
    await audit('mobile');
    for (const selector of ['.button-primary', '.clock-next', '.voter-choice', '.option-choice', '#salt']) {
      const box = await page.locator(selector).first().boundingBox();
      assert.ok(box.height >= 44 && box.width >= 44, `${selector} is ${box.width}×${box.height}`);
    }
    await page.locator('input[name=voter]').first().focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('radio', { name: 'B Bob' })).toBeChecked();
    await page.locator('input[name=option]').first().focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('input[name=option]').nth(1)).toBeChecked();
    await page.locator('#salt').fill('s'.repeat(64));
    await page.locator('.hash-details summary').click();
    await noOverflow();
    await page.locator('.button-primary').click();
    await page.locator('.clock-next').click();
    await page.locator('.button-primary').click();
    await expect(page.locator('.feedback')).toContainText('Bob revealed a vote');
    await loadScenario('failures');
    await page.locator('.event-row').nth(5).click();
    await noOverflow();
    await screenshot('mobile-replay.png');
    await page.getByRole('button', { name: 'Return to live', exact: true }).first().click();
    await page.getByRole('button', { name: 'Reset simulation' }).click();
    await expect(page.locator('.event-count')).toHaveText('0');
  });
  await check('Reflow at 320px and 820px, 200% text enlargement, reduced motion and forced colors', async () => {
    for (const width of [320, 820]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
      await noOverflow();
      await screenshot(`reflow-${width}.png`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => document.documentElement.style.fontSize = '200%');
    await noOverflow();
    assert.equal(await page.locator('.voter-choice, .option-choice, .phase-track li').evaluateAll(nodes => nodes.every(el => el.scrollWidth <= el.clientWidth)), true, 'Enlarged labels fit inside each choice and phase');
    await screenshot('text-200.png');
    await screenshot('text-200-viewport.png', false);
    await page.locator('.ballot-panel').screenshot({ path: resolve(evidence, 'text-200-ballot.png') });
    await page.evaluate(() => document.documentElement.style.fontSize = '');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await page.locator('.button-primary').evaluate(el => getComputedStyle(el).transitionDuration), '0s');
    await page.emulateMedia({ forcedColors: 'active' });
    await page.locator('#salt').focus();
    await tabTo('.button-primary');
    assert.notEqual(await page.locator('.button-primary').evaluate(el => getComputedStyle(el).outlineStyle), 'none');
    await screenshot('forced-colors.png', false);
    await page.emulateMedia({ forcedColors: 'none', reducedMotion: 'no-preference' });
  });
  await check('No browser errors, failed resources, remote requests or storage writes', async () => {
    assert.deepEqual(errors, []);
    assert.ok(requests.every(r => r.local && r.path.startsWith('/preview/')));
    assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
  });
  await writeFile(resolve(evidence, 'browser-results.json'), JSON.stringify({ browser: browser.version(), results, errors, requests: [...new Map(requests.map(r => [r.path, r])).values()] }, null, 2));
} catch (error) {
  if (page) await screenshot('check-failure.png');
  await writeFile(resolve(evidence, 'browser-results.json'), JSON.stringify({ results, errors, failure: String(error) }, null, 2));
  throw error;
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
