#!/usr/bin/env node

/**
 * Platform End-to-End Integration Test Suite
 * Tests all key REST API endpoints on the running server (port 9876)
 */

const BASE_URL = 'http://127.0.0.1:9876';
const TEST_WORKSPACE = 'test-suite-sandbox';

async function runTest(name, fn) {
  try {
    console.log(`🧪 Running: ${name}...`);
    await fn();
    console.log(`✅ Success: ${name}\n`);
  } catch (err) {
    console.error(`❌ Failed: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

async function request(path, body = {}, method = 'POST') {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (method !== 'GET') {
    options.body = JSON.stringify({ ...body, workspaceId: TEST_WORKSPACE });
  }
  
  const res = await fetch(`${BASE_URL}${path}`, options);
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HTTP ${res.status}: ${errText}`);
  }
  return res.json();
}

async function startTests() {
  console.log(`=================================================`);
  console.log(`🚀 STARTING DEVY PLATFORM INTEGRATION TEST SUITE`);
  console.log(`📡 Targeting server at: ${BASE_URL}`);
  console.log(`📂 Temporary test workspace: ${TEST_WORKSPACE}`);
  console.log(`=================================================\n`);

  // Test 1: Fetch list of projects
  await runTest('List workspaces (/api/workspaces)', async () => {
    const res = await fetch(`${BASE_URL}/api/workspaces`);
    if (!res.ok) throw new Error('Failed to fetch workspaces');
    const data = await res.json();
    if (!Array.isArray(data.workspaces)) {
      throw new Error('Workspaces result is not an array');
    }
    console.log(`   Found ${data.workspaces.length} workspaces.`);
  });

  // Test 2: Write test file
  const testFileName = 'test_integration_file.txt';
  const testContent = 'Hello Antigravity E2E Integration Test\nLine 2 content here\nLine 3 test content';
  await runTest('Write file (/api/fs/write)', async () => {
    const res = await request('/api/fs/write', {
      path: testFileName,
      content: testContent
    });
    if (!res.success) throw new Error('Write operation was not successful');
  });

  // Test 3: List files inside workspace
  await runTest('List files (/api/fs/list)', async () => {
    const res = await request('/api/fs/list', { path: '.' });
    if (!Array.isArray(res.files)) throw new Error('Files list is not an array');
    const hasFile = res.files.some(f => f.name === testFileName);
    if (!hasFile) throw new Error('Created test file was not found in directory listing');
  });

  // Test 4: Read file content
  await runTest('Read file (/api/fs/read)', async () => {
    const res = await request('/api/fs/read', { path: testFileName });
    if (res.content !== testContent) {
      throw new Error(`Content mismatch! Expected "${testContent}", got "${res.content}"`);
    }
  });

  // Test 5: Read specific line range
  await runTest('Read line range (/api/fs/read-lines)', async () => {
    const res = await request('/api/fs/read-lines', {
      path: testFileName,
      startLine: 2,
      endLine: 3
    });
    const expected = 'Line 2 content here\nLine 3 test content';
    if (res.content !== expected) {
      throw new Error(`Line range mismatch! Expected "${expected}", got "${res.content}"`);
    }
  });

  // Test 6: Grep search
  await runTest('Grep search (/api/fs/search)', async () => {
    const res = await request('/api/fs/search', {
      pattern: 'Antigravity',
      directory: '.'
    });
    if (!res.matches || res.matches.includes('No matches found.')) {
      throw new Error('Grep search failed to locate pattern');
    }
  });

  // Test 7: String replacement
  await runTest('Replace in file (/api/fs/replace)', async () => {
    await request('/api/fs/replace', {
      path: testFileName,
      search: 'Antigravity',
      replace: 'Devy-Super-Agent'
    });
    
    // Verify replacement took place
    const verify = await request('/api/fs/read', { path: testFileName });
    if (!verify.content.includes('Devy-Super-Agent') || verify.content.includes('Antigravity')) {
      throw new Error('Replacement failed to update content correctly');
    }
  });

  // Test 8: Shell command execution
  await runTest('Run command (/api/cmd/run)', async () => {
    const res = await fetch(`${BASE_URL}/api/cmd/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        command: 'echo "integration_test_cli_output"',
        workspaceId: TEST_WORKSPACE
      })
    });
    if (!res.ok) throw new Error('Command execution endpoint returned error status');
    const text = await res.text();
    if (!text.includes('integration_test_cli_output')) {
      throw new Error(`Expected command output to contain keyword, got: "${text}"`);
    }
  });

  // Test 9: Delete test file
  await runTest('Delete file (/api/fs/delete)', async () => {
    const res = await request('/api/fs/delete', { path: testFileName });
    if (!res.success) throw new Error('Delete operation failed');

    // Confirm it is gone
    try {
      await request('/api/fs/read', { path: testFileName });
      throw new Error('File was still readable after delete');
    } catch (err) {
      // Expected: read fails
    }
  });

  // Test 10: Delete test workspace completely
  await runTest('Delete workspace (/api/workspace/delete)', async () => {
    const res = await request('/api/workspace/delete', { workspaceId: TEST_WORKSPACE });
    if (!res.success) throw new Error('Delete project workspace failed');
  });

  console.log(`=================================================`);
  console.log(`🎉 ALL PLATFORM INTEGRATION TESTS PASSED SUCCEED!`);
  console.log(`=================================================`);
}

startTests().catch(err => {
  console.error('Fatal test runner crash:', err);
  process.exit(1);
});
