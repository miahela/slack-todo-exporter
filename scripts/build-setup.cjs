'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src', 'capture.js'), 'utf8').replace(/\r\n/g, '\n');
const bookmarklet = 'javascript:' + encodeURIComponent(source + '\nvoid 0;');
const escape = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Slack to-do exporter setup</title><style>
*{box-sizing:border-box}body{margin:0;background:#f1f6f4;color:#172f2b;font:16px/1.65 system-ui,sans-serif}main{max-width:780px;margin:48px auto;padding:36px;background:#fff;border:1px solid #cbdad4;border-radius:18px}h1{font-size:32px;line-height:1.2;margin-top:0}h2{font-size:20px;margin-top:30px}.bookmark{display:inline-block;padding:14px 22px;border-radius:9px;background:#126c62;color:#fff;text-decoration:none;font-weight:700}.hint{font-size:14px;color:#4a625e}li{margin:12px 0}textarea{width:100%;height:160px;font:12px/1.5 monospace;padding:10px;border:1px solid #acbfb8;border-radius:6px}button{font:600 14px system-ui;padding:10px 16px;border:1px solid #acbfb8;border-radius:6px;cursor:pointer}summary{cursor:pointer;font-weight:600}code{background:#edf3f0;padding:2px 5px;border-radius:4px}#feedback{min-height:24px}img{width:100%;border:1px solid #cbdad4;border-radius:10px}@media(max-width:800px){main{margin:16px;padding:24px}}
</style></head><body><main>
<h1>Export your Slack to-dos</h1>
<p>Save message text, sender names, and links as TXT, CSV, or JSON. No installation or API key needed.</p>
<h2>1. Add the bookmark</h2>
<p>Press <strong>Ctrl + Shift + B</strong> to show the bookmarks bar. Drag this button onto it:</p>
<p><a class="bookmark" id="bookmark" href="${escape(bookmarklet)}">Export Slack to-dos</a></p>
<p class="hint">Run the bookmark from your browser bar while viewing Slack.</p>
<h2>2. Open To-dos in Slack</h2>
<p>Open <a href="https://app.slack.com/" target="_blank" rel="noopener">Slack in this browser</a>, choose your workspace, and open <strong>To-dos</strong>. Choose <strong>In-progress</strong> for unfinished tasks, or include all statuses and reminders for everything.</p>
<h2>3. Collect and download</h2>
<p>Click the bookmark, then <strong>Collect all shown to-dos</strong>. Keep the tab open while it scrolls. Check the final count against Slack, then choose a download format.</p>
<p class="hint">Export each workspace or view separately. Leave filters unchanged while collecting. Download before closing, refreshing, or changing views.</p>
<p class="hint">Capture stays local. The tool does not read tokens or cookies, post to Slack, or upload files. Only loaded items are available; custom tasks may lack a sender or link. Files are saved as links.</p>
<details><summary>If the panel finds no items or the bookmark does nothing</summary>
<p><strong>Zero items?</strong> Choose <strong>Pick a to-do</strong>, click a task's text, then collect again. Escape cancels picking. If that fails, <strong>Download page structure</strong> provides a diagnostic without message text or links.</p>
<p><strong>Cannot drag?</strong> Create a bookmark, edit its URL, and paste the full value below. Your browser or workplace may block bookmarklets.</p>
<button id="copy-bookmark" type="button">Copy bookmark URL</button><p id="feedback" class="hint" role="status"></p>
<textarea id="bookmark-url" readonly spellcheck="false" aria-label="Bookmark URL">${escape(bookmarklet)}</textarea>
<p>Source code for review or use in your Slack tab's developer console:</p>
<textarea readonly spellcheck="false" aria-label="Capture source code">${escape(source)}</textarea>
</details>
<p class="hint">Updating the exporter? Download your current capture, close its panel, then replace your bookmark using this setup page.</p>
</main><script>
document.getElementById('copy-bookmark').addEventListener('click',async()=>{
  const field=document.getElementById('bookmark-url');
  try{await navigator.clipboard.writeText(field.value);document.getElementById('feedback').textContent='Copied. Paste into the bookmark URL field.';}
  catch{field.focus();field.select();document.getElementById('feedback').textContent='Press Ctrl + C to copy the selected bookmark URL.';}
});
</script></body></html>`;
fs.writeFileSync(path.join(root, 'setup.html'), html);
console.log('Created setup.html; bookmark URL is ' + bookmarklet.length + ' characters.');
