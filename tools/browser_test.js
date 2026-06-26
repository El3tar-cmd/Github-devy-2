#!/usr/bin/env node

const actionType = process.argv[2];
const arg1 = process.argv[3];
const arg2 = process.argv[4];

if (!actionType) {
  console.log(`
🌐 WORKSPACE BROWSER AUTOMATION TOOL
-----------------------------------
Usage:
  node tools/browser_test.js click "<css_selector>"
  node tools/browser_test.js type "<css_selector>" "<text>"
  node tools/browser_test.js navigate "<url_or_subpath>"
  node tools/browser_test.js refresh
  node tools/browser_test.js get-html

Examples:
  node tools/browser_test.js type "#username" "my-admin-user"
  node tools/browser_test.js click "button[type='submit']"
  node tools/browser_test.js get-html
`);
  process.exit(1);
}

async function run() {
  const payload = { type: actionType };
  if (actionType === 'click') payload.selector = arg1;
  if (actionType === 'type') {
    payload.selector = arg1;
    payload.text = arg2;
  }
  if (actionType === 'navigate') payload.url = arg1;

  console.log(`📡 Sending action to Sandbox Browser: ${actionType} ${arg1 || ''} ${arg2 || ''}...`);

  try {
    const res = await fetch('http://127.0.0.1:9876/api/browser/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`❌ HTTP Error: ${res.status} - ${errText}`);
      process.exit(1);
    }

    const data = await res.json();
    if (data.success) {
      console.log(`\n✅ Automation Success!`);
      console.log(`📍 Current Browser URL: ${data.url}`);
      if (data.html) {
         console.log(`-----------------------------------------------`);
         console.log(data.html.slice(0, 1500) + (data.html.length > 1500 ? '\n... (truncated)' : ''));
         console.log(`-----------------------------------------------`);
         console.log(`📄 Page DOM HTML length: ${data.html.length} chars.`);
      }
    } else {
      console.error(`❌ Execution Failed: ${data.error || 'Unknown error'}`);
    }
  } catch (err) {
    console.error(`❌ Connection failure: ${err.message}`);
    console.error(`Make sure the Express server is running and the web-app preview is open in your browser tab!`);
  }
}

run();
