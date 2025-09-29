// Test script to verify all endpoints work with mock data
const axios = require('axios');

const BASE_URL = 'https://backend-xc4z.vercel.app';

async function testEndpoint(method, url, data = null, description) {
  try {
    const config = {
      method: method.toUpperCase(),
      url: BASE_URL + url,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (data && (method.toUpperCase() === 'POST' || method.toUpperCase() === 'PUT')) {
      config.data = data;
    }

    const response = await axios(config);

    console.log(`✅ ${description}`);
    console.log(`   Status: ${response.status}`);
    console.log(`   Data: ${JSON.stringify(response.data, null, 2)}`);
    console.log('');

    return true;
  } catch (error) {
    console.log(`❌ ${description}`);
    console.log(`   Error: ${error.response?.status} - ${error.response?.statusText}`);
    console.log(`   Message: ${error.message}`);
    console.log('');

    return false;
  }
}

async function runTests() {
  console.log('🧪 Testing All Backend Endpoints with Mock Data\n');
  console.log('=' .repeat(50));

  let passed = 0;
  let failed = 0;

  // Test basic endpoints
  if (await testEndpoint('GET', '/', null, 'Root endpoint')) passed++; else failed++;
  if (await testEndpoint('GET', '/health', null, 'Health check')) passed++; else failed++;
  if (await testEndpoint('GET', '/test', null, 'Test endpoint')) passed++; else failed++;

  // Test auth endpoints
  if (await testEndpoint('POST', '/auth/login', { email: 'test@example.com', password: 'password' }, 'Login')) passed++; else failed++;
  if (await testEndpoint('POST', '/auth/register', { username: 'testuser', email: 'test@example.com', password: 'password' }, 'Register')) passed++; else failed++;

  // Test team endpoints
  if (await testEndpoint('GET', '/teams', null, 'Get teams')) passed++; else failed++;
  if (await testEndpoint('GET', '/teams/1/members', null, 'Get team members')) passed++; else failed++;
  if (await testEndpoint('GET', '/teams/invitations', null, 'Get team invitations')) passed++; else failed++;

  // Test team messages
  if (await testEndpoint('GET', '/teams/1/messages', null, 'Get team messages')) passed++; else failed++;
  if (await testEndpoint('POST', '/teams/1/messages', { message: 'Test message' }, 'Send team message')) passed++; else failed++;

  // Test task endpoints
  if (await testEndpoint('GET', '/tasks/get-task', null, 'Get tasks')) passed++; else failed++;
  if (await testEndpoint('GET', '/tasks/time/active', null, 'Get active timer')) passed++; else failed++;
  if (await testEndpoint('GET', '/tasks/reminders', null, 'Get task reminders')) passed++; else failed++;

  // Test task-specific endpoints
  if (await testEndpoint('GET', '/tasks/1/attachments', null, 'Get task attachments')) passed++; else failed++;
  if (await testEndpoint('GET', '/tasks/1/comments', null, 'Get task comments')) passed++; else failed++;
  if (await testEndpoint('GET', '/tasks/1/time', null, 'Get task time logs')) passed++; else failed++;

  // Test timer control endpoints
  if (await testEndpoint('POST', '/tasks/1/time/start', { description: 'Test work' }, 'Start timer')) passed++; else failed++;
  if (await testEndpoint('POST', '/tasks/1/time/stop', {}, 'Stop timer')) passed++; else failed++;
  if (await testEndpoint('DELETE', '/tasks/time/123', null, 'Delete time log')) passed++; else failed++;

  // Test user endpoints
  if (await testEndpoint('GET', '/users', null, 'Get users')) passed++; else failed++;
  if (await testEndpoint('GET', '/users/profile', null, 'Get user profile')) passed++; else failed++;

  // Test milestone endpoints
  if (await testEndpoint('GET', '/milestones', null, 'Get milestones')) passed++; else failed++;

  console.log('=' .repeat(50));
  console.log(`📊 Test Results: ${passed} passed, ${failed} failed`);

  if (failed === 0) {
    console.log('🎉 All endpoints are working correctly!');
  } else {
    console.log('⚠️  Some endpoints have issues that need to be fixed.');
  }
}

// Run tests
runTests().catch(console.error);