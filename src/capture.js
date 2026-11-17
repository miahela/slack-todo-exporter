(() => {
  'use strict';
  const key = '__slackTodoExporterV1';
  if (window[key]) { window[key].show(); return; }
  if (!/(^|\.)slack\.com$/.test(location.hostname) || !/^\/client\//.test(location.pathname)) {
    alert('Open Slack in your browser, choose To-dos, then click this bookmark again.');
    return;
  }

  const ROW = [
    '.p-later__item', '.p-later__saved_item', '.p-later__list-item',
    '.p-saved_for_later__item', '.p-todo__item', '.p-todos__item', '.p-to_dos__item', '.p-saved__item',
    '[data-qa="later_item"]', '[data-qa="saved_item"]', '[data-qa="todo_item"]',
    '[data-qa="to_do_item"]', '[data-qa="saved-item"]', '[data-qa="todo-item"]',
    '.c-virtual_list__item[data-item-key]', '[role="listitem"]'
  ].join(',');
  const BODY = '[data-qa="message-text"],[data-qa="message_text"],.c-message_kit__blocks,.c-message__body,.p-rich_text_block,[data-qa="todo_title"],.p-todo__text,.p-todos__text';
  const SENDER = '[data-qa="message_sender_name"],[data-qa="message_sender"],.c-message_kit__sender,.c-message__sender,.c-message__sender_button,[data-qa="sender_name"],.p-later__sender';
  const CHANNEL = '[data-qa="channel_name"],[data-qa="saved_item_channel"],.p-later__channel-name,.p-later__channel_name,.p-later__channel,.p-todo__channel';
  const REMINDER = '[data-qa="reminder_time"],[data-qa="due_date"],.p-later__reminder,.p-later__due_date,.p-later__due-date,.p-todo__due_date';
  const host = document.createElement('div');
  host.id = 'slack-todo-exporter-panel';
  host.style.cssText = 'position:fixed;top:80px;right:20px;z-index:2147483647;width:350px;max-width:calc(100vw - 32px);color-scheme:dark';
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = `:host{all:initial;color-scheme:dark}*{box-sizing:border-box}section{font:14px/1.5 system-ui,sans-serif;background:#20232b;color:#f3f4f7;border:1px solid #687080;border-radius:14px;padding:18px;box-shadow:0 12px 42px #0008}h2{font-size:18px;margin:0 0 6px}p{margin:8px 0;color:#d0d4dd}.small{font-size:12px}.status{font-size:12px;min-height:54px;white-space:pre-line}output{display:block;font-size:26px;font-weight:700;margin:10px 0}button{font:600 13px system-ui;cursor:pointer;background:#3c4352;color:white;border:1px solid #788397;border-radius:6px;padding:9px 10px}button:disabled{opacity:.5;cursor:default}button:hover:enabled{filter:brightness(1.15)}.primary{width:100%;background:#126c62;margin:8px 0}.buttons{display:flex;gap:7px;flex-wrap:wrap;margin:8px 0}.quiet{background:transparent;font-size:12px}.close{width:100%;margin-top:10px}label{display:block;margin-top:10px;font-size:12px}input{margin-right:7px}`;
  shadow.append(style);
  const make = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const panel = make('section');
  panel.setAttribute('aria-label', 'Slack to-do exporter');
  shadow.append(panel);
  panel.append(make('h2', 'Export Slack to-dos'), make('p', 'Open To-dos and choose the filters you want before collecting.', 'small'));
  const count = make('output', '0 items');
  const status = make('p', '', 'status');
  status.setAttribute('role', 'status');
  const collectButton = make('button', 'Collect all shown to-dos', 'primary');
  const exportButtons = make('div', undefined, 'buttons');
  const txtButton = make('button', 'Download .txt');
  const csvButton = make('button', 'Download .csv');
  const jsonButton = make('button', 'Download .json');
  exportButtons.append(txtButton, csvButton, jsonButton);
  const label = make('label');
  const incompleteOnly = document.createElement('input');
  incompleteOnly.type = 'checkbox';
  label.append(incompleteOnly, document.createTextNode('Exclude items visibly marked complete'));
  const helpButtons = make('div', undefined, 'buttons');
  const pickButton = make('button', 'Pick a to-do', 'quiet');
  const structureButton = make('button', 'Download page structure', 'quiet');
  helpButtons.append(pickButton, structureButton);
  const closeButton = make('button', 'Close and clear capture', 'quiet close');
  panel.append(count, status, collectButton, exportButtons, label,
    make('p', 'Text, sender, message link, and visible details. One workspace and current filters. Download before leaving this tab.', 'small'),
    helpButtons, closeButton);
  for (const button of panel.querySelectorAll('button')) button.type = 'button';
  document.documentElement.append(host);

  const captured = new Map();
  const aliases = new Map();
  const initialPath = location.pathname + location.search + location.hash;
  const teamId = location.pathname.match(/^\/client\/([^/]+)/)?.[1] || null;
  const pageTitle = document.title;
  const capturedView = /saved/i.test(location.pathname) ? 'Saved' : /later/i.test(location.pathname) ? 'Later / To-dos' : 'To-dos';
  const exportedScope = location.href;
  let running = false, closed = false, changed = false, runId = 0, scheduled = null;
  let manual = null, picking = false, hovered = null, oldOutline = '';
  let selectedTab = null;
  let stopReason = 'not_started';
  let scans = 0;
  let notice = 'Ready. Collect to scroll through your to-dos, or scroll the list yourself.';
  const startedAt = new Date().toISOString();
  const visible = node => !!node && node.isConnected && !node.closest('[hidden],[aria-hidden="true"],[inert]') && node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden';
  const allowed = node => visible(node) && !node.closest('nav,aside,[role="navigation"],[role="complementary"],[role="dialog"],.p-thread_view,.p-message_pane');
  const all = (root, selector) => Array.from(root.querySelectorAll(selector));

  function readText(node) {
    if (!node) return '';
    const blocks = new Set(['DIV', 'P', 'PRE', 'BLOCKQUOTE', 'LI', 'H1', 'H2', 'H3', 'H4', 'TR']);
    function walk(part) {
      if (part.nodeType === Node.TEXT_NODE) return part.textContent;
      if (part.nodeType !== Node.ELEMENT_NODE || part.hidden) return '';
      if (part.tagName === 'IMG') return part.getAttribute('alt') || '';
      if (part.getAttribute('aria-hidden') === 'true' || getComputedStyle(part).display === 'none') return '';
      if (['SCRIPT', 'STYLE', 'INPUT', 'SELECT', 'SVG'].includes(part.tagName)) return '';
      if ((part.tagName === 'BUTTON' || part.getAttribute('role') === 'button') && part !== node && !part.matches(SENDER)) return '';
      if (part.tagName === 'BR') return '\n';
      const text = Array.from(part.childNodes, walk).join('');
      return blocks.has(part.tagName) ? `\n${text}\n` : text;
    }
    return walk(node).replace(/\u200b/g, '').replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  function viewRoot() {
    if (manual?.container.isConnected) return manual.container;
    const roots = all(document, '[data-qa="later_view"],[data-qa="todo_view"],[data-qa="saved_view"],.p-later,.p-todos,.p-to_dos,.p-saved_for_later,.p-saved,main,[role="main"]');
    return roots.find(node => allowed(node) && /later|todo|to_dos|saved/.test(node.className + ' ' + node.getAttribute('data-qa')))
      || roots.find(allowed) || null;
  }

  function currentTab(root) {
    return all(root, '[role="tab"][aria-selected="true"]').filter(visible).map(node => readText(node)).join('|');
  }

  function validScope() {
    if (closed || changed) return false;
    const root = viewRoot();
    if (location.pathname + location.search + location.hash !== initialPath || selectedTab !== null && root && currentTab(root) !== selectedTab || manual && !manual.container.isConnected) {
      changed = true; running = false; runId++; stopReason = 'view_changed';
      notice = 'View changed. Capture stopped. Download the original capture, then close and run the bookmark again.';
      observer.disconnect();
      render();
      return false;
    }
    return true;
  }

  function rowsFor(root) {
    if (manual) return Array.from(manual.container.children).filter(node => node.matches(manual.selector) && allowed(node));
    const candidates = all(root, ROW).filter(allowed).filter(node => node.querySelector(BODY + ',' + SENDER) || /later|saved|todo|to_do/.test(node.className + ' ' + node.getAttribute('data-qa')) && readText(node));
    // Keep the card wrapper so its reminder and source metadata stay with the message.
    const set = new Set(candidates);
    return candidates.filter(node => {
      for (let parent = node.parentElement; parent && parent !== root; parent = parent.parentElement) if (set.has(parent)) return false;
      return true;
    });
  }

  function safeUrl(value) {
    try { const url = new URL(value, location.href); return /^https?:$/.test(url.protocol) ? url.href : null; } catch { return null; }
  }

  function sourceOf(row) {
    const links = all(row, 'a[href]').map(node => ({ node, url: safeUrl(node.getAttribute('href')) })).filter(link => link.url);
    const isMessage = link => {
      const url = new URL(link.url);
      return /(^|\.)slack\.com$/.test(url.hostname) && (/\/archives\/[CDG][A-Z0-9]+\/p\d{11,}/i.test(url.pathname) || /\/client\//.test(url.pathname) && (url.searchParams.has('message_ts') || /\/thread\//.test(url.pathname)));
    };
    // A Slack message pasted into the body is a content link, not this card's source.
    const messageLinks = links.filter(link => isMessage(link) && !link.node.closest(BODY));
    const source = messageLinks.find(link => link.node.matches('.c-timestamp,[data-qa="message_timestamp"]')) || messageLinks[0];
    const metadata = selector => all(row, selector).find(node => !node.closest(BODY));
    let channelId = row.getAttribute('data-channel-id') || metadata('[data-channel-id]')?.getAttribute('data-channel-id') || null;
    let ts = row.getAttribute('data-ts') || metadata('[data-saved-id][data-ts],[data-todo-id][data-ts],[data-channel-id][data-ts],a.c-timestamp[data-ts],[data-qa="message_timestamp"][data-ts]')?.getAttribute('data-ts') || null;
    let messageUrl = source?.url || null;
    let linkSource = source ? 'page' : null;
    if (source) {
      const url = new URL(source.url);
      channelId = url.pathname.match(/\/(?:archives|client\/[^/]+)\/([CDG][A-Z0-9]+)/i)?.[1] || channelId;
      const digits = url.pathname.match(/\/p(\d{11,})/)?.[1];
      ts = (digits ? digits.slice(0, -6) + '.' + digits.slice(-6) : url.searchParams.get('message_ts') || url.pathname.match(/\/thread\/[CDG][A-Z0-9]+-(\d+\.\d+)/i)?.[1]) || ts;
    }
    if (!channelId) {
      for (const link of links) {
        if (link.node.closest(BODY)) continue;
        if (!/(^|\.)slack\.com$/.test(new URL(link.url).hostname)) continue;
        channelId = new URL(link.url).pathname.match(/\/(?:archives|client\/[^/]+)\/([CDG][A-Z0-9]+)/i)?.[1] || null;
        if (channelId) break;
      }
    }
    if (!ts) {
      const value = row.getAttribute('data-item-key') || row.getAttribute('data-message-id') || '';
      ts = value.match(/\b(\d{10,}\.\d{1,6})\b/)?.[1] || null;
    }
    if (ts && !/^\d{10,}\.\d{1,6}$/.test(ts)) ts = null;
    if (channelId && !/^[CDG][A-Z0-9]+$/i.test(channelId)) channelId = null;
    if (!messageUrl && channelId && ts) {
      const [seconds, fraction] = ts.split('.');
      messageUrl = location.hostname === 'app.slack.com' && teamId
        ? `${location.origin}/client/${teamId}/${channelId}?message_ts=${ts}`
        : `${location.origin}/archives/${channelId}/p${seconds}${fraction.padEnd(6, '0')}`;
      linkSource = 'channel_and_timestamp';
    }
    return { links, channelId, ts, messageUrl, linkSource };
  }

  function extract(row) {
    const source = sourceOf(row);
    const senderNode = row.querySelector(SENDER);
    const sender = readText(senderNode) || senderNode?.getAttribute('data-user-name') || null;
    const bodies = all(row, BODY).filter(node => !node.parentElement.closest(BODY));
    const details = readText(row);
    const text = bodies.map(readText).filter(Boolean).join('\n\n') || details;
    if (!text && !source.messageUrl) return null;
    const channelNode = row.querySelector(CHANNEL) || source.links.find(link => !link.node.closest(BODY) && /\/client\/[^/]+\/[CDG][A-Z0-9]+\/?$/i.test(new URL(link.url).pathname))?.node;
    const reminderNode = row.querySelector(REMINDER) || row.querySelector('time[data-due-date]');
    const times = all(row, 'time[datetime]');
    const messageTime = times.find(node => !node.closest(REMINDER) && !node.hasAttribute('data-due-date'));
    const date = source.ts ? new Date(Number(source.ts) * 1000) : null;
    const timestamp = messageTime?.getAttribute('datetime') || (date && Number.isFinite(date.getTime()) ? date.toISOString() : null);
    const controls = all(row, 'button,[role="checkbox"],input[type="checkbox"]');
    const completed = row.getAttribute('data-todo-state') === 'completed' || row.getAttribute('data-status') === 'completed'
      || controls.some(node => {
        const label = node.getAttribute('aria-label') || '';
        return /mark (?:as )?(?:incomplete|in.progress)|move to in.progress/i.test(label)
          || node.matches('[role="checkbox"][aria-checked="true"],input[type="checkbox"]:checked') && /complete|done/i.test(label) && !/select/i.test(label);
      });
    const active = row.getAttribute('data-todo-state') === 'to_do' || controls.some(node => /mark (?:as )?complete/i.test(node.getAttribute('aria-label') || ''));
    const itemId = row.getAttribute('data-saved-id') || row.querySelector('[data-saved-id]')?.getAttribute('data-saved-id')
      || row.getAttribute('data-todo-id') || row.querySelector('[data-todo-id]')?.getAttribute('data-todo-id')
      || row.getAttribute('data-item-key') || row.getAttribute('data-message-id') || null;
    const warnings = [];
    if (!sender) warnings.push('Sender not exposed in the loaded card.');
    if (!source.messageUrl) warnings.push('Message link not exposed. This may be a custom to-do, a file, or an unavailable message.');
    if (!bodies.length) warnings.push('No separate message body found; text contains visible card details.');
    const links = source.links.filter(link => link.url !== source.messageUrl && !link.node.closest(SENDER) && !link.node.matches(CHANNEL + ',.c-timestamp')).map(link => ({ text: readText(link.node), url: link.url }));
    return {
      item_id: itemId, text, sender, sender_id: senderNode?.getAttribute('data-member-id') || senderNode?.getAttribute('data-user-id') || null,
      message_url: source.messageUrl, message_link_source: source.linkSource,
      channel: readText(channelNode) || null, channel_id: source.channelId,
      message_timestamp: timestamp, slack_timestamp: source.ts,
      status: completed ? 'completed' : active ? 'in_progress' : 'unknown',
      reminder: readText(reminderNode) || null, reminder_datetime: reminderNode?.getAttribute('datetime') || reminderNode?.querySelector('time[datetime]')?.getAttribute('datetime') || null,
      links: Array.from(new Map(links.map(link => [link.url, link])).values()),
      visible_details: details, warnings
    };
  }

  function scan() {
    if (!validScope()) return [];
    const root = viewRoot();
    if (!root) return [];
    const routeOK = /\/(?:later|saved|todos?|to[-_]dos)(?:\/|$)/i.test(location.pathname);
    const headingOK = all(root, 'h1,h2,[role="heading"]').some(node => visible(node) && /^(?:to[ -]?dos?|later|saved)(?:\s|$)/i.test(readText(node)));
    if (!routeOK && !headingOK && !manual) return [];
    if (selectedTab === null) selectedTab = currentTab(root);
    const rows = rowsFor(root);
    for (const row of rows) {
      const entry = extract(row);
      if (!entry) continue;
      const stableId = entry.item_id ? 'id:' + entry.item_id : null;
      const messageId = entry.channel_id && entry.slack_timestamp ? 'message:' + entry.channel_id + ':' + entry.slack_timestamp : entry.message_url ? 'url:' + entry.message_url : null;
      const identity = stableId && aliases.get(stableId) || messageId && aliases.get(messageId) || stableId || messageId || 'visible:' + JSON.stringify([entry.sender, entry.text, entry.reminder]);
      if (stableId) aliases.set(stableId, identity);
      if (messageId) aliases.set(messageId, identity);
      const previous = captured.get(identity);
      // Scrolling may temporarily hide metadata. Preserve fields already read.
      if (previous) for (const name of ['sender', 'sender_id', 'message_url', 'message_link_source', 'channel', 'channel_id', 'message_timestamp', 'slack_timestamp', 'reminder', 'reminder_datetime']) entry[name] ||= previous[name];
      entry.warnings = entry.warnings.filter(value => !(value.startsWith('Sender') && entry.sender) && !(value.startsWith('Message link') && entry.message_url));
      captured.set(identity, { ...entry, first_captured_at: previous?.first_captured_at || new Date().toISOString() });
    }
    scans++;
    render();
    return rows;
  }

  const entries = () => Array.from(captured.values()).filter(item => !incompleteOnly.checked || item.status !== 'completed');
  function render() {
    const items = entries();
    const missing = items.filter(item => !item.message_url || !item.sender).length;
    count.textContent = `${items.length} items`;
    status.textContent = notice + (missing ? `\n${missing === 1 ? '1 item has' : missing + ' items have'} a missing sender or message link; see warnings in JSON.` : '');
    collectButton.textContent = running ? 'Stop collecting' : 'Collect all shown to-dos';
    collectButton.disabled = changed || picking;
    pickButton.disabled = changed || running;
    for (const button of [txtButton, csvButton, jsonButton]) button.disabled = !items.length;
  }

  function scrollerFor(row) {
    for (let node = row; node && node !== document.documentElement; node = node.parentElement) {
      if (node.clientHeight > 0 && node.scrollHeight > node.clientHeight + 3 && /auto|scroll/.test(getComputedStyle(node).overflowY)) return node;
    }
    const scrolling = document.scrollingElement;
    return scrolling && scrolling.scrollHeight > scrolling.clientHeight + 3 ? scrolling : null;
  }
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function collect() {
    if (running) { running = false; runId++; stopReason = 'user_stopped'; notice = 'Stopped. Download the items collected so far, or collect again.'; render(); return; }
    if (!validScope()) return;
    let rows = scan();
    if (!rows.length) { stopReason = 'no_recognized_items'; notice = 'No to-do cards recognized. Open To-dos, then try Pick a to-do. If needed, download page structure for troubleshooting.'; render(); return; }
    running = true; stopReason = 'collecting'; const thisRun = ++runId;
    notice = 'Collecting from the top of this list. Keep this tab open and leave filters unchanged.'; render();
    const firstScroller = scrollerFor(rows[0]);
    if (firstScroller) { firstScroller.scrollTo({ top: 0, behavior: 'instant' }); await sleep(1100); }
    let stalled = 0, reachedBottom = false;
    for (let step = 0; step < 1200 && running && runId === thisRun && validScope(); step++) {
      rows = scan();
      const scroller = rows.length ? scrollerFor(rows[rows.length - 1]) : firstScroller;
      if (!scroller) { reachedBottom = true; break; }
      const before = [captured.size, scroller.scrollHeight, scroller.scrollTop];
      scroller.scrollBy({ top: Math.max(200, scroller.clientHeight * 0.65), behavior: 'instant' });
      await sleep(1100);
      if (!running || runId !== thisRun || !validScope()) return;
      scan();
      const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4;
      const unchanged = captured.size === before[0] && scroller.scrollHeight === before[1] && Math.abs(scroller.scrollTop - before[2]) < 2;
      stalled = unchanged ? stalled + 1 : 0;
      if (stalled >= 6) { reachedBottom = atBottom; break; }
    }
    if (!validScope() || thisRun !== runId) return;
    running = false;
    stopReason = reachedBottom ? 'visible_list_end' : 'scroll_stalled_or_limit';
    notice = reachedBottom ? 'Reached the end of the loaded list. Check the count against Slack before treating this as complete.' : 'Scrolling stopped. Scroll the list manually to capture anything else, then download.';
    render();
  }

  function packageData() {
    if (!changed) scan();
    const items = entries();
    return { schema_version: 1, exported_at: new Date().toISOString(), capture_started_at: startedAt,
      workspace_id: teamId, page_title: pageTitle, view: capturedView, source_url: exportedScope,
      selected_tab: selectedTab || null, captured_items: items.length, total_collected_items: captured.size,
      excluded_visibly_completed: incompleteOnly.checked, stop_reason: stopReason,
      completeness: 'Not independently verified. Only items loaded in the selected view and filters can be captured. Compare the count with Slack.',
      notes: 'Custom to-dos and unavailable messages may have no sender or message link. Missing fields are null. Files are links, not downloads. Dates and reminder text reflect the page.', items };
  }
  function transcript(data) {
    return [`Slack ${data.view}`, data.source_url, `Exported: ${data.exported_at}`, `Items: ${data.captured_items}`, data.completeness, '',
      ...data.items.map((item, i) => [
        `${i + 1}. ${item.sender || '(sender unavailable)'}${item.channel ? ' | ' + item.channel : ''}`,
        item.message_timestamp ? 'Message date: ' + item.message_timestamp : '',
        'Status: ' + item.status, item.reminder ? 'Reminder: ' + item.reminder : '', item.text,
        item.message_url || '(message link unavailable)', ...item.links.map(link => `${link.text || 'Link'}: ${link.url}`),
        ...item.warnings.map(value => 'Note: ' + value), ''
      ].filter(value => value !== '').join('\n'))].join('\n\n') + '\n';
  }
  function csv(data) {
    const fields = ['text', 'sender', 'message_url', 'channel', 'message_timestamp', 'status', 'reminder', 'reminder_datetime', 'channel_id', 'sender_id', 'links', 'visible_details', 'warnings'];
    const cell = value => {
      let text = value == null ? '' : Array.isArray(value) ? value.map(part => typeof part === 'string' ? part : part.url).join('\n') : String(value);
      // Prevent exported message text from becoming a spreadsheet formula.
      if (/^[\s\u0000-\u001f]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
      return '"' + text.replace(/"/g, '""') + '"';
    };
    return '\ufeff' + [fields.map(cell).join(','), ...data.items.map(item => fields.map(field => cell(item[field])).join(','))].join('\r\n') + '\r\n';
  }
  function download(content, extension, mime, prefix = 'slack-todos') {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const link = document.createElement('a');
    link.href = url; link.download = `${prefix}-${teamId || 'workspace'}-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`;
    document.documentElement.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  function pickCandidate(target) {
    const known = target.closest(ROW);
    if (known && allowed(known) && readText(known)) return known;
    for (let node = target; node && node !== document.body; node = node.parentElement) {
      if (!allowed(node) || !readText(node) || !node.querySelector(BODY + ',' + SENDER + ',button,[role="checkbox"],input[type="checkbox"]')) continue;
      const selector = signature(node);
      if (Array.from(node.parentElement.children).filter(sibling => sibling.matches(selector)).length >= 2) return node;
    }
    return null;
  }
  function signature(node) {
    return node.tagName.toLowerCase() + Array.from(node.classList).filter(name => !/active|selected|hover|focus|complete/i.test(name)).slice(0, 4).map(name => '.' + CSS.escape(name)).join('');
  }
  function unhighlight() { if (hovered) hovered.style.outline = oldOutline; hovered = null; }
  function stopPicking() { picking = false; unhighlight(); document.removeEventListener('click', pick, true); document.removeEventListener('pointermove', highlight, true); document.removeEventListener('keydown', escapePick, true); render(); }
  function highlight(event) {
    if (event.composedPath().includes(host)) return;
    const candidate = pickCandidate(event.target);
    if (candidate === hovered) return;
    unhighlight();
    if (candidate) { hovered = candidate; oldOutline = candidate.style.outline; candidate.style.outline = '3px solid #27b8a4'; }
  }
  function pick(event) {
    if (event.composedPath().includes(host)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const candidate = pickCandidate(event.target);
    if (!candidate) { notice = 'Could not identify a card there. Click the text of a to-do, or press Escape to cancel.'; render(); return; }
    manual = { container: candidate.parentElement, selector: signature(candidate) };
    stopPicking(); selectedTab = null;
    notice = 'List selected. Collect now, or scroll manually. Existing captured items are kept.';
    scan(); render();
  }
  function escapePick(event) { if (event.key === 'Escape') { stopPicking(); notice = 'Selection canceled.'; render(); } }

  collectButton.addEventListener('click', () => collect().catch(() => { running = false; stopReason = 'error'; notice = 'Automatic scrolling stopped. Scroll manually to capture more items, then download.'; render(); }));
  txtButton.addEventListener('click', () => download(transcript(packageData()), 'txt', 'text/plain;charset=utf-8'));
  csvButton.addEventListener('click', () => download(csv(packageData()), 'csv', 'text/csv;charset=utf-8'));
  jsonButton.addEventListener('click', () => download(JSON.stringify(packageData(), null, 2), 'json', 'application/json'));
  incompleteOnly.addEventListener('change', render);
  pickButton.addEventListener('click', () => {
    if (picking) { stopPicking(); notice = 'Selection canceled.'; render(); return; }
    picking = true; notice = 'Click the text of one to-do in Slack. A green outline shows the detected card. Press Escape to cancel.';
    document.addEventListener('click', pick, true); document.addEventListener('pointermove', highlight, true); document.addEventListener('keydown', escapePick, true); render();
  });
  structureButton.addEventListener('click', () => {
    // Structure only: no message text, links, IDs, cookies, storage, or input values.
    const root = viewRoot();
    const structure = root ? [root, ...all(root, '*')].slice(0, 1000).map(node => ({
      tag: node.tagName.toLowerCase(), classes: Array.from(node.classList).filter(value => !/\d{8,}|@|xox/i.test(value)),
      qa: /^[a-z_-]{1,80}$/i.test(node.getAttribute('data-qa') || '') ? node.getAttribute('data-qa') : null,
      role: node.getAttribute('role'), depth: (() => { let n = node, d = 0; while (n !== root && n.parentElement) { n = n.parentElement; d++; } return d; })()
    })) : [];
    download(JSON.stringify({ format: 'slack-page-structure-v1', elements: structure }, null, 2), 'json', 'application/json', 'slack-page-structure');
  });

  const observer = new MutationObserver(() => {
    if (scheduled !== null || closed || changed || picking) return;
    scheduled = setTimeout(() => { scheduled = null; scan(); }, 150);
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  const timer = setInterval(() => { if (!picking) scan(); }, 1500);
  window[key] = { show: () => { host.style.display = 'block'; } };
  closeButton.addEventListener('click', () => {
    if (captured.size && !confirm('Clear the captured items and close? Download first if you want to keep them.')) return;
    closed = true; running = false; runId++; stopPicking(); observer.disconnect(); clearInterval(timer);
    if (scheduled !== null) clearTimeout(scheduled);
    captured.clear(); aliases.clear(); host.remove(); delete window[key];
  });
  scan(); render();
})();
