#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 The Sandwich Project - Comprehensive Test Suite');
console.log('=' .repeat(60));

async function runTest(testName, command, args = []) {
  return new Promise((resolve, reject) => {
    console.log(`\n📋 Running ${testName}...`);
    
    const child = spawn(command, args, {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${testName} PASSED`);
        resolve();
      } else {
        console.log(`❌ ${testName} FAILED (exit code: ${code})`);
        reject(new Error(`${testName} failed`));
      }
    });
    
    child.on('error', (error) => {
      console.log(`💥 ${testName} CRASHED:`, error.message);
      reject(error);
    });
  });
}

async function runAllTests() {
  const failures = [];
  
  try {
    // 1. Permission Matrix Test (most critical)
    console.log('\n🔐 TESTING PERMISSIONS...');
    await runTest('Permission Matrix', 'node', ['test/permission-matrix.test.js']);
  } catch (error) {
    failures.push('Permission Matrix');
  }
  
  try {
    // 2. Integration Tests
    console.log('\n🔄 TESTING INTEGRATION FLOWS...');
    await runTest('Integration Tests', 'npx', ['jest', 'test/integration', '--verbose']);
  } catch (error) {
    failures.push('Integration Tests');
  }
  
  try {
    // 3. Regression Tests
    console.log('\n🩺 TESTING ROUTE HEALTH...');
    await runTest('Regression Tests', 'npx', ['jest', 'test/regression', '--verbose']);
  } catch (error) {
    failures.push('Regression Tests');
  }
  
  // Summary
  console.log('\n' + '=' .repeat(60));
  if (failures.length === 0) {
    console.log('🎉 ALL TESTS PASSED! Your app is healthy.');
    console.log('✅ Authentication working correctly');
    console.log('✅ Permissions properly configured');
    console.log('✅ Critical routes functioning');
    process.exit(0);
  } else {
    console.log('🚨 TEST FAILURES DETECTED:');
    failures.forEach(test => console.log(`   ❌ ${test}`));
    console.log(`\nTotal failed: ${failures.length}`);
    console.log('\n🔧 Check the output above for specific issues to fix.');
    process.exit(1);
  }
}

// Check if server is running first
async function checkServerHealth() {
  try {
    const response = await fetch('http://localhost:5000/api/projects');
    if (response.status === 500) {
      throw new Error('Server returning 500 errors');
    }
    console.log('✅ Server is running and responding');
    return true;
  } catch (error) {
    console.log('❌ Server health check failed:', error.message);
    console.log('💡 Make sure your server is running with: npm run dev');
    return false;
  }
}

// Main execution
(async () => {
  console.log('🏥 Checking server health first...');
  
  const serverHealthy = await checkServerHealth();
  if (!serverHealthy) {
    process.exit(1);
  }
  
  await runAllTests();
})();