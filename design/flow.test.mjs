// End-to-end checks for design/steady-design.html (journal, flags, reminder, new entry dialog, summary, PDF preview).
// Run from the project root:
//   npm i -D playwright && npx playwright install chromium
//   node design/flow.test.mjs
// Prints one PASS/FAIL line per check, then any page errors.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');
const f = 'file://' + (process.argv[2] || fileURLToPath(new URL('./steady-design.html', import.meta.url)));
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 900 } });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
await p.goto(f); await p.waitForTimeout(600);
const txt = s => p.locator(s).innerText();
console.log('title', await p.locator('#wk-title').innerText(), '| week', (await p.locator('.wd-n').allInnerTexts()).join(' '), '| days', (await p.locator('#days .dd-w').allInnerTexts()).join(' '));
const check = (name, ok, got) => { if (!ok) process.exitCode = 1; console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '  got: ' + JSON.stringify(got))); };
let t;
t = await txt('#appt-text'); check('reminder shows 3 flagged', t === 'Your appointment is on Tuesday 20 October. 3 flagged entries are ready to review.', t);
check('export disabled at load', await p.locator('#export').isDisabled(), '');
check('summary has 3 rows', await p.locator('#flags .entry').count() === 3, await p.locator('#flags .entry').count());
check('Worth flagging uses day layout', (await p.locator('#flags .day-date .dd-n').allInnerTexts()).join(',') === '14,7,1', await p.locator('#flags .day-date .dd-n').allInnerTexts());
check('Worth flagging shows time and Context', (await txt('#flags .entry >> nth=0')).includes('19:10') && (await txt('#flags .entry >> nth=0')).includes('Context'), await txt('#flags .entry >> nth=0'));
check('Include control has visible label in its name', (await p.getAttribute('#inc-e3', 'aria-label')).startsWith('Include'), '');
check('before review: hint shown, no preview button', await p.locator('#export-hint').isVisible() && await p.locator('#pdf-toggle').isHidden(), '');
await p.locator('#flags-end').scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
check('after review: preview button replaces hint', await p.locator('#export-hint').isHidden() && await p.locator('#pdf-toggle').isVisible() && !(await p.locator('#export').isDisabled()), '');
check('preview closed by default', (await p.getAttribute('#pdf-toggle', 'aria-expanded')) === 'false' && !(await p.locator('#pdf').isVisible()) && (await txt('#pdf-toggle')) === 'Show PDF preview', await txt('#pdf-toggle'));
await p.click('#pdf-toggle'); await p.waitForTimeout(100);
check('opens on click, label says Hide', await p.locator('#pdf').isVisible() && (await txt('#pdf-toggle')) === 'Hide PDF preview' && (await p.getAttribute('#pdf-toggle', 'aria-expanded')) === 'true', await txt('#pdf-toggle'));
check('PDF lists only included entries', (await p.locator('#pdf .p-row').count()) === 2, await p.locator('#pdf .p-row').count());
check('PDF keeps compact rows: date then Food/Symptoms, no Context, no controls', (await txt('#pdf .p-row >> nth=0')).replace(/\s+/g,' ').trim() === '14 Oct Food Pasta with tomato sauce. Symptoms Cramping in the evening. Not much sleep.' && (await p.locator('#pdf input, #pdf button').count()) === 0, await txt('#pdf .p-row >> nth=0'));
await p.uncheck('#inc-e3');
check('unticking removes it from PDF', (await p.locator('#pdf .p-row').count()) === 1, '');
check('excluded note shows on screen', await p.locator('#flags .entry >> nth=0').locator('.excl-note').isVisible(), '');
await p.check('#inc-e3');
await p.fill('#qe-1', '');
check('empty question left out of PDF', (await p.locator('#pdf .p-q li').count()) === 1, await p.locator('#pdf .p-q li').count());
await p.fill('#qe-1', "I've skipped meals a few times. Could that be affecting things?");
check('PDF paper stays white in dark mode', await p.evaluate(() => { document.documentElement.setAttribute('data-theme','dark'); const c = getComputedStyle(document.getElementById('pdf')).backgroundColor; document.documentElement.removeAttribute('data-theme'); return c; }) === 'rgb(255, 255, 255)', '');
check('journal order newest first', (await p.locator('#days .dd-n').allInnerTexts()).join(',') === '14,13', await p.locator('#days .dd-n').allInnerTexts());
// flag porridge
await p.click('#flag-e1'); await p.waitForTimeout(100);
t = await txt('#toast'); check('toast on flag', t === 'Added to your appointment summary.', t);
check('flag button pressed', await p.getAttribute('#flag-e1', 'aria-pressed') === 'true', '');
check('focus stays on flag', await p.evaluate(() => document.activeElement.id) === 'flag-e1', await p.evaluate(() => document.activeElement.id));
check('summary now 4 rows', await p.locator('#flags .entry').count() === 4, await p.locator('#flags .entry').count());
t = await txt('#appt-text'); check('reminder count 4', t.includes('4 flagged entries are'), t);
// unflag pasta
await p.click('#flag-e3'); await p.waitForTimeout(100);
t = await txt('#toast'); check('toast on unflag', t === 'Removed from your appointment summary.', t);
check('summary back to 3', await p.locator('#flags .entry').count() === 3, '');
// exclude checkbox persists across re-render
await p.uncheck('#inc-e5'); await p.click('#flag-e3'); await p.waitForTimeout(100);
check('exclusion kept after rerender', !(await p.isChecked('#inc-e5')), '');
check('reflagged entry included', await p.isChecked('#inc-e3'), '');
// quick add
check('no form visible before New entry', !(await p.locator('#entry-dlg').isVisible()), '');
await p.click('#new-entry'); await p.waitForTimeout(250);
check('dialog opens as modal', await p.evaluate(() => document.getElementById('entry-dlg').matches(':modal')), '');
check('focus on Food when opened', await p.evaluate(() => document.activeElement.id) === 'q-food', await p.evaluate(() => document.activeElement.id));
await p.click('#q-save'); await p.waitForTimeout(100);
check('empty save shows error, stays open', await p.locator('#q-error').isVisible() && await p.locator('#entry-dlg').isVisible(), '');
check('fields marked invalid', (await p.getAttribute('#q-food', 'aria-invalid')) === 'true', '');
// Esc keeps the draft
await p.fill('#q-food', 'Rice and <b>grilled</b> chicken.');
check('error clears on typing', await p.locator('#q-error').isHidden(), '');
await p.keyboard.press('Escape'); await p.waitForTimeout(150);
check('Esc closes', !(await p.locator('#entry-dlg').isVisible()), '');
check('focus returns to New entry', await p.evaluate(() => document.activeElement.id) === 'new-entry', await p.evaluate(() => document.activeElement.id));
t = await txt('#toast'); check('draft kept toast', t === 'Draft kept. Open New entry to finish it.', t);
await p.click('#new-entry'); await p.waitForTimeout(250);
check('draft restored on reopen', (await p.inputValue('#q-food')) === 'Rice and <b>grilled</b> chicken.', await p.inputValue('#q-food'));
await p.fill('#q-sym', 'Mild bloating after.');
await p.click('#ctx-travel');
await p.click('#q-sev summary'); await p.check('#sev-low');
await p.fill('#q-time', '13:20');
check('date defaults to today', (await p.inputValue('#q-date')) === '2026-10-18', await p.inputValue('#q-date'));
await p.click('#q-save'); await p.waitForTimeout(150);
check('dialog closes on save', !(await p.locator('#entry-dlg').isVisible()), '');
check('new day group at top', (await p.locator('#days .dd-n').allInnerTexts())[0] === '18', await p.locator('#days .dd-n').allInnerTexts());
const first = await txt('#days .day-group >> nth=0');
check('entry text escaped, shown literally', first.includes('Rice and <b>grilled</b> chicken.'), first);
check('severity shown', first.includes('Severity low'), first);
check('context shown', first.includes('Travel'), first);
check('form reset', (await p.inputValue('#q-food')) === '' && (await p.inputValue('#q-sym')) === '' && (await p.getAttribute('#ctx-travel', 'aria-pressed')) === 'false' && !(await p.locator('#q-sev').evaluate(e => e.open)), '');
check('week strip Sun marked', (await txt('#wd-18 .wd-w')) === 'Bloating', await txt('#wd-18 .wd-w'));
t = await txt('.journal-obs'); check('week sentence 4 of 7', t === 'This week: 4 of 7 logged days mentioned bloating.', t);
t = await txt('#pattern'); check('pattern updated', t.startsWith('23 entries across 34 days. Symptoms noted on 12 days'), t);
// appointment date
await p.click('#appt-change'); await p.fill('#appt-input', '2026-11-03'); await p.dispatchEvent('#appt-input', 'change');
check('summary header follows date change', (await txt('#sum-appt')) === 'Tuesday 3 November 2026', await txt('#sum-appt'));
check('PDF appointment follows date change', (await txt('#pdf .p-meta')).includes('Tuesday 3 November 2026'), '');
t = await txt('#appt-text'); check('far date: no review prompt', t.startsWith('Next appointment: Tuesday 3 November.') && await p.locator('#appt-review').isHidden(), t);
await p.fill('#appt-input', '2026-10-20'); await p.dispatchEvent('#appt-input', 'change');
t = await txt('#sum-appt'); check('summary header shows appointment', t === 'Tuesday 20 October 2026', t);
check('near date: review button back', await p.locator('#appt-review').isVisible(), '');
// review scrolls, export unlocks
await p.click('#appt-review'); await p.waitForTimeout(900);
await p.locator('#flags-end').scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
check('export unlocked after reading list', !(await p.locator('#export').isDisabled()), '');
// questions
await p.click('#q-add'); await p.click('#q-add');
check('4 questions max, add disabled', (await p.locator('#qs li').count()) === 4 && await p.locator('#q-add').isDisabled(), await p.locator('#qs li').count());
await p.click('#export'); await p.waitForTimeout(100);
t = await txt('#toast'); check('export toast honest', t === "PDF export isn't part of this preview.", t);
// log to yesterday
await p.click('#new-entry'); await p.waitForTimeout(250);
await p.fill('#q-food', 'Toast with jam.'); await p.fill('#q-date', '2026-10-17'); await p.click('#q-save'); await p.waitForTimeout(150);
t = await txt('#toast'); check('toast names the day', t === 'Entry saved to Saturday 17 October.', t);
check('Sat group appears', (await p.locator('#days .dd-n').allInnerTexts()).includes('17'), await p.locator('#days .dd-n').allInnerTexts());
check('date field reset to today', (await p.inputValue('#q-date')) === '2026-10-18', await p.inputValue('#q-date'));
t = await txt('#pattern'); check('pattern: 24 entries, 12 symptom days', t.startsWith('24 entries across 34 days. Symptoms noted on 12 days'), t);
const heads = await p.evaluate(() => [...document.querySelectorAll('h1,h2,h3,h4,.q,.say')].filter(h => { const prev = h.previousElementSibling; return prev && getComputedStyle(prev).fontSize.replace('px','') < 15 && prev.tagName === 'P'; }).map(h => h.textContent.trim()));
check('no small label directly above any heading', heads.length === 0, heads);
// symptom-only entry (nothing eaten)
await p.click('#new-entry'); await p.waitForTimeout(250);
await p.fill('#q-sym', 'Woke up with cramps.'); await p.click('#q-save'); await p.waitForTimeout(150);
check('symptom-only entry saves', !(await p.locator('#entry-dlg').isVisible()), '');
const top = await txt('#days .day-group >> nth=0');
check('Food shows None noted', top.includes('Woke up with cramps.') && /Food\s*None noted/.test(top), top.slice(0, 200));
// backdrop click closes
await p.click('#new-entry'); await p.waitForTimeout(250);
await p.mouse.click(5, 5); await p.waitForTimeout(150);
check('click outside closes', !(await p.locator('#entry-dlg').isVisible()), '');
// close button
await p.click('#new-entry'); await p.waitForTimeout(250); await p.click('#dlg-close'); await p.waitForTimeout(150);
check('close button closes', !(await p.locator('#entry-dlg').isVisible()), '');
await p.focus('#pdf-toggle'); await p.keyboard.press('Enter'); await p.waitForTimeout(100);
check('keyboard Enter toggles preview', (await p.getAttribute('#pdf-toggle', 'aria-expanded')) === (await p.locator('#pdf').isVisible() ? 'true' : 'false'), '');
console.log('errors', errs);
if (errs.length) process.exitCode = 1;
await b.close();
