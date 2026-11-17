'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright-core');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src', 'capture.js'), 'utf8').replace(/\r\n/g, '\n');
const base = 'https://app.slack.com/client/TDEMO/todos';
const ts = index => `${1700000000 + index}.000123`;
const permalink = index => `https://example-workspace.slack.com/archives/CDEMO/p${1700000000 + index}000123`;

function row(index, options = {}) {
  const sender = index % 2 ? 'Bob Reed' : 'Alice Morgan';
  return `<article class="${options.unrecognized ? 'task-shell' : 'p-later__item'}" data-saved-id="S${index}" ${options.hidden ? 'hidden' : ''} ${options.derived ? `data-channel-id="CDEMO" data-ts="${ts(index)}"` : ''}>
    ${options.custom || options.unavailable ? '' : `<button class="c-message__sender_button" data-member-id="U${index}">${sender}</button>`}
    ${options.custom || options.unavailable ? '' : '<a class="p-later__channel-name" href="https://app.slack.com/client/TDEMO/CDEMO">#project-demo</a>'}
    ${options.custom || options.unavailable || options.derived ? '' : `<a class="c-timestamp" data-ts="${ts(index)}" href="${permalink(index)}${index === 0 ? '?thread_ts=1699999999.000001&amp;cid=CDEMO' : ''}">9:30 AM</a>`}
    ${options.unavailable ? '<p>Original message is no longer available.</p>' : `<div class="${options.custom ? 'p-todo__text' : 'c-message_kit__blocks'}">${options.formula ? '=SUM(1,2)' : options.custom ? 'Write a draft project plan' : `Task ${index}<br>Second line, with &quot;quotes&quot; <img aria-hidden="true" alt=":wave:" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7">`}${index === 0 ? '<p><a href="https://example.org/brief?version=2&amp;type=draft">Project brief</a></p><a href="https://files.slack.com/files-pri/TDEMO-FDEMO/brief.pdf">brief.pdf</a>' : ''}</div>`}
    ${index === 0 ? '<span class="p-later__reminder"><time datetime="2026-11-18T09:00:00Z">Tomorrow at 9 AM</time></span>' : ''}
    <button aria-label="${options.completed ? 'Mark incomplete' : 'Mark complete'}">${options.completed ? 'Undo complete' : 'Complete'}</button>
    <button aria-label="More actions">Actions</button>
  </article>`;
}

function fixture(content, extra = '', tab = false) {
  return `<!doctype html><html><head><title>To-dos | Example Workspace | Slack</title><style>
    body{margin:0;font:15px/1.5 Arial;color:#202532;background:#f7f8fa}main{margin-left:180px;width:680px;padding:24px}aside{position:fixed;left:0;top:0;width:160px;height:100vh;background:#34183c;color:white;padding:20px}article{padding:18px;background:white;border:1px solid #ddd;margin:10px 0;border-radius:8px;min-height:100px}a{color:#126c62}button{margin:4px;border:0;background:#eee;padding:5px}.c-message__sender_button{font-size:15px;font-weight:bold;background:transparent;padding:0}.p-later__channel-name,.c-timestamp{font-size:12px;margin-left:10px}.p-later__reminder{display:block;color:#976000;font-size:13px}.c-message_kit__blocks,.p-todo__text{margin:10px 0}#list{max-height:600px;overflow-y:auto}h1{margin-top:0}
    </style></head><body><aside>Example Workspace<br><br>Home<br>To-dos<br>Saved${row(98)}</aside>
    <main class="p-later"><h1>To-dos</h1>${tab ? '<div role="tablist"><button role="tab" aria-selected="true">In progress</button><button role="tab" aria-selected="false">Completed</button></div>' : ''}<div id="list">${content}</div></main>
    <div class="p-thread_view">${row(99)}</div>${extra}</body></html>`;
}

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CAPTURE_BROWSER_CHANNEL ? { channel: process.env.CAPTURE_BROWSER_CHANNEL } : {}) });
  try {
    const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1400, height: 980 } });
    const page = await context.newPage();
    let html = '';
    const requests = [];
    page.on('request', request => requests.push(request.url()));
    await context.route('**/*', route => {
      if (route.request().isNavigationRequest() && route.request().url().startsWith('https://app.slack.com/')) return route.fulfill({ contentType: 'text/html', body: html });
      if (route.request().url().startsWith('file:')) return route.continue();
      return route.abort();
    });
    const open = async (content, url = base) => { html = content; await page.goto(url); await page.evaluate(source); };
    const download = async name => {
      const event = page.waitForEvent('download');
      await page.getByRole('button', { name, exact: true }).click();
      const result = await event;
      return { filename: result.suggestedFilename(), content: fs.readFileSync(await result.path(), 'utf8') };
    };
    const json = async () => JSON.parse((await download('Download .json')).content);

    await open(fixture(row(0) + row(1, { completed: true, formula: true }) + row(2, { custom: true }) + row(3, { derived: true }) + row(4, { unavailable: true }) + row(5, { hidden: true })));
    let data = await json();
    assert.equal(data.captured_items, 5);
    assert.equal(data.items[0].sender, 'Alice Morgan');
    assert.equal(data.items[0].sender_id, 'U0');
    assert.equal(data.items[0].channel, '#project-demo');
    assert.ok(data.items[0].text.startsWith('Task 0\nSecond line, with "quotes" :wave:'));
    assert.equal(data.items[0].message_url, permalink(0) + '?thread_ts=1699999999.000001&cid=CDEMO');
    assert.equal(data.items[0].slack_timestamp, ts(0));
    assert.equal(data.items[0].message_timestamp, new Date(Number(ts(0)) * 1000).toISOString());
    assert.equal(data.items[0].reminder, 'Tomorrow at 9 AM');
    assert.equal(data.items[0].reminder_datetime, '2026-11-18T09:00:00Z');
    assert.ok(!data.items[0].text.includes('Complete'));
    assert.deepEqual(data.items[0].links.map(link => link.url), ['https://example.org/brief?version=2&type=draft', 'https://files.slack.com/files-pri/TDEMO-FDEMO/brief.pdf']);
    assert.equal(data.items[1].sender, 'Bob Reed');
    assert.equal(data.items[1].status, 'completed');
    assert.equal(data.items[2].sender, null);
    assert.equal(data.items[2].message_url, null);
    assert.equal(data.items[2].warnings.length, 2);
    assert.equal(data.items[3].message_url, base.replace('/todos', '/CDEMO') + '?message_ts=' + ts(3));
    assert.equal(data.items[3].message_link_source, 'channel_and_timestamp');
    assert.equal(data.items[4].text, 'Original message is no longer available.');
    assert.equal(data.items[4].warnings.length, 3);
    assert.ok(!data.items.some(item => ['S5', 'S98', 'S99'].includes(item.item_id)));
    assert.equal(data.completeness.startsWith('Not independently verified.'), true);
    assert.equal(data.workspace_id, 'TDEMO');
    console.log('PASS: sender buttons, text, line breaks, emoji, exact links, reconstructed links, timestamps, reminders, custom tasks, missing metadata, and scope.');

    await page.getByLabel('Exclude items visibly marked complete').check();
    assert.equal((await json()).captured_items, 4);
    await page.getByLabel('Exclude items visibly marked complete').uncheck();
    assert.equal((await json()).captured_items, 5);
    const txt = await download('Download .txt');
    assert.ok(txt.content.includes('Alice Morgan | #project-demo'));
    assert.ok(txt.content.includes(permalink(0)));
    assert.ok(txt.content.includes('(message link unavailable)'));
    assert.ok(txt.filename.startsWith('slack-todos-TDEMO-'));
    const csv = await download('Download .csv');
    assert.ok(csv.content.startsWith('\ufeff"text","sender","message_url"'));
    assert.ok(csv.content.includes('"\'=SUM(1,2)"'));
    assert.ok(csv.content.includes('""quotes""'));
    assert.ok(csv.content.includes('\r\n'));
    console.log('PASS: completion filtering, TXT, UTF-8 CSV, quote escaping, and spreadsheet formula protection.');

    await page.evaluate(() => {
      const row = document.querySelector('[data-saved-id="S0"]');
      row.querySelector('.c-message__sender_button').remove();
      row.querySelector('.c-timestamp').remove();
      row.querySelector('.c-message_kit__blocks').append(document.createTextNode(' Edited.'));
    });
    data = await json();
    assert.equal(data.captured_items, 5);
    assert.equal(data.items[0].sender, 'Alice Morgan');
    assert.ok(data.items[0].message_url.includes('/p1700000000000123'));
    assert.ok(data.items[0].text.endsWith('Edited.'));
    assert.deepEqual(data.items[0].warnings, []);
    const diagnostic = JSON.parse((await download('Download page structure')).content);
    assert.ok(diagnostic.elements.some(element => element.classes.includes('p-later__item')));
    for (const privateValue of ['Alice', 'Bob Reed', 'Task 0', 'https:', 'U0', 'TDEMO', 'Tomorrow', 'brief.pdf']) assert.ok(!JSON.stringify(diagnostic).includes(privateValue), privateValue + ' should not appear in structure diagnostics.');
    assert.equal(requests.filter(url => !url.startsWith('data:')).length, 1, 'The helper should make no network requests.');
    console.log('PASS: stable deduplication, updates, retaining previously visible metadata, content-free diagnostics, and no network calls.');

    await page.evaluate(() => history.pushState({}, '', '/client/TOTHER/todos'));
    await page.waitForFunction(() => document.querySelector('#slack-todo-exporter-panel').shadowRoot.textContent.includes('View changed.'));
    data = await json();
    assert.equal(data.workspace_id, 'TDEMO');
    assert.equal(data.captured_items, 5);
    assert.equal(data.stop_reason, 'view_changed');
    assert.ok(await page.getByRole('button', { name: 'Collect all shown to-dos', exact: true }).isDisabled());

    await open(fixture(row(0), '', true), 'https://app.slack.com/client/TDEMO/later');
    assert.equal((await json()).selected_tab, 'In progress');
    await page.evaluate(() => {
      const tabs = document.querySelectorAll('[role="tab"]');
      tabs[0].setAttribute('aria-selected', 'false'); tabs[1].setAttribute('aria-selected', 'true');
      document.querySelector('#list').innerHTML = '<article class="p-later__item" data-saved-id="SNEW"><div class="p-todo__text">Unrelated new tab</div></article>';
    });
    await page.waitForFunction(() => document.querySelector('#slack-todo-exporter-panel').shadowRoot.textContent.includes('View changed.'));
    assert.equal((await json()).captured_items, 1);
    assert.equal((await json()).items[0].item_id, 'S0');
    console.log('PASS: switching workspaces, routes, or selected tabs stops collection and retains the original export.');

    await open(fixture(row(7, { unrecognized: true }) + row(8, { unrecognized: true })));
    assert.ok(await page.getByRole('button', { name: 'Download .json', exact: true }).isDisabled());
    await page.getByRole('button', { name: 'Collect all shown to-dos', exact: true }).click();
    await page.getByRole('button', { name: 'Pick a to-do', exact: true }).click();
    await page.locator('.task-shell .c-message_kit__blocks').first().hover();
    assert.equal(await page.locator('.task-shell').first().evaluate(node => node.style.outline), 'rgb(39, 184, 164) solid 3px');
    await page.locator('.task-shell .c-message_kit__blocks').first().click();
    data = await json();
    assert.equal(data.captured_items, 2);
    assert.equal(data.items[0].sender, 'Bob Reed');
    assert.equal(await page.locator('.task-shell').first().evaluate(node => node.style.outline), '');
    assert.equal(page.url(), base);
    await page.getByRole('button', { name: 'Pick a to-do', exact: true }).click();
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('status').filter({ hasText: 'Selection canceled.' }).count(), 1);
    console.log('PASS: picking an unrecognized card layout, canceling selection, and preventing the selection click from activating Slack controls.');

    const virtual = `<script>
      const list=document.getElementById('list');list.style.height='220px';let start=3;let busy=false;
      window.draw=()=>{list.innerHTML=Array.from({length:Math.min(5,12-start)},(_,n)=>'<div class="c-virtual_list__item" data-item-key="item-'+(start+n)+'"><article class="p-later__item" data-saved-id="S'+(start+n)+'"><button class="c-message__sender_button">User '+(start+n)+'</button><div class="c-message_kit__blocks">Virtual task '+(start+n)+'</div></article></div>').join('');};
      window.draw();list.scrollTop=80;
      list.addEventListener('scroll',()=>{if(busy)return;let next=start;if(list.scrollTop===0&&start>0)next=0;else if(list.scrollTop+list.clientHeight>=list.scrollHeight-5&&start+5<12)next=Math.min(7,start+4);if(next===start)return;busy=true;setTimeout(()=>{start=next;window.draw();list.scrollTop=1;busy=false;},120);});
    </script>`;
    html = fixture('', virtual);
    await page.goto(base);
    await page.evaluate(source);
    assert.equal((await json()).captured_items, 5);
    await page.getByRole('button', { name: 'Collect all shown to-dos', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#slack-todo-exporter-panel').shadowRoot.textContent.includes('Reached the end of the loaded list.'), undefined, { timeout: 45000 });
    data = await json();
    assert.equal(data.captured_items, 12);
    assert.deepEqual(data.items.map(item => item.item_id).sort(), Array.from({ length: 12 }, (_, i) => 'S' + i).sort());
    assert.equal(data.stop_reason, 'visible_list_end');
    assert.ok(data.items.every(item => item.sender === 'User ' + item.item_id.slice(1)));
    console.log('PASS: collection starts at the top, handles virtualized rows, retains every item, and reports an unverified visible-list end.');

    html = fixture(row(10) + row(11), '<style>#list{height:150px}</style>');
    await page.goto(base);
    await page.evaluate(source);
    await page.getByRole('button', { name: 'Collect all shown to-dos', exact: true }).click();
    await page.getByRole('button', { name: 'Stop collecting', exact: true }).click();
    assert.equal((await json()).stop_reason, 'user_stopped');
    await page.evaluate(source);
    assert.equal(await page.locator('#slack-todo-exporter-panel').count(), 1);
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Close and clear capture', exact: true }).click();
    assert.equal(await page.locator('#slack-todo-exporter-panel').count(), 0);
    assert.ok(await page.evaluate(() => !window.__slackTodoExporterV1));
    console.log('PASS: stopping, repeated bookmark invocation, and clearing captured data.');

    const guide = await context.newPage();
    await guide.goto(pathToFileURL(path.join(root, 'setup.html')).href);
    const bookmark = await guide.locator('#bookmark').getAttribute('href');
    assert.equal(decodeURIComponent(bookmark.slice('javascript:'.length)), source + '\nvoid 0;');
    assert.equal(await guide.locator('#bookmark-url').inputValue(), bookmark);
    await page.evaluate(url => { const a = document.createElement('a'); a.id = 'test-bookmark'; a.href = url; a.textContent = 'Run bookmark'; document.querySelector('main').append(a); }, bookmark);
    await page.locator('#test-bookmark').click();
    await page.locator('#slack-todo-exporter-panel').waitFor({ state: 'attached' });
    assert.equal(await page.locator('#slack-todo-exporter-panel').count(), 1);
    assert.equal((await json()).captured_items, 2);
    console.log('PASS: the self-contained setup page contains and executes the exact bookmark code.');

    html = fixture(row(0));
    await page.goto('https://app.slack.com/client/TDEMO/CGENERAL');
    await page.evaluate(() => document.querySelector('h1').textContent = '#general');
    await page.evaluate(source);
    assert.ok(await page.getByRole('button', { name: 'Download .json', exact: true }).isDisabled());
    console.log('PASS: ordinary channel views are not automatically captured.');

    await open(fixture('<article class="p-later__item" data-saved-id="SLINK"><div class="p-todo__text">Review this other message: <a href="https://other.slack.com/archives/COTHER/p1700000001000123">related thread</a></div></article>'));
    const linked = (await json()).items[0];
    assert.equal(linked.message_url, null);
    assert.equal(linked.channel_id, null);
    assert.equal(linked.links[0].url, 'https://other.slack.com/archives/COTHER/p1700000001000123');
    console.log('PASS: Slack links pasted in a message are kept as content and never mistaken for the original message link.');

    await open(fixture(row(6)));
    await page.evaluate(() => {
      const row = document.querySelector('main [data-saved-id="S6"]');
      row.setAttribute('data-channel-id', 'CWRONG');
      row.setAttribute('data-ts', '1700000999.000001');
      row.insertAdjacentHTML('beforeend', '<span role="checkbox" aria-label="Select to-do" aria-checked="true"></span>');
    });
    const selected = (await json()).items[0];
    assert.equal(selected.channel_id, 'CDEMO');
    assert.equal(selected.slack_timestamp, ts(6));
    assert.equal(selected.status, 'in_progress');
    console.log('PASS: original message links take precedence over stale attributes, and bulk-selection checkboxes do not mark tasks completed.');

    await open(fixture('<div class="new-card"><p>Custom card one</p><button aria-label="Mark complete">Complete</button></div><div class="new-card"><p>Custom card two</p><button aria-label="Mark complete">Complete</button></div>'));
    await page.getByRole('button', { name: 'Pick a to-do', exact: true }).click();
    await page.getByText('Custom card one', { exact: true }).click();
    assert.equal((await json()).captured_items, 2);
    console.log('PASS: manual fallback can capture card details even when all message-specific selectors have changed.');

    if (process.argv.includes('--screenshot')) {
      html = fixture(row(0) + row(1, { completed: true }) + row(2, { custom: true }))
        .replace(row(98), '').replace('<div class="p-thread_view">' + row(99) + '</div>', '').replace(/[ \t]+$/gm, '');
      fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
      fs.writeFileSync(path.join(root, 'docs', 'demo.html'), html);
      await page.setViewportSize({ width: 1400, height: 850 });
      await page.goto(base);
      await page.evaluate(source);
      await page.screenshot({ path: path.join(root, 'docs', 'screenshot.png') });
      console.log('Created docs/screenshot.png with fictional data.');
    }
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
