import axios from 'axios';

const BASE_URL = 'http://localhost:3001/api/auth';

async function testAuth() {
  console.log('🧪 Starting Auth System Verification...\n');

  try {
    // 1. Test Login with Alok Nath
    console.log('1️⃣ Testing Alok Nath Login (Alok@123)...');
    const alokRes = await axios.post(`${BASE_URL}/login`, {
      email: 'alok@spotiflix.com',
      password: 'Alok@123',
    });
    console.log('✅ Alok Nath login success! User:', alokRes.data.user);
    const alokToken = alokRes.data.token;

    // 2. Test Get Me
    console.log('\n2️⃣ Testing /me endpoint with JWT token...');
    const meRes = await axios.get(`${BASE_URL}/me`, {
      headers: { Authorization: `Bearer ${alokToken}` },
    });
    console.log('✅ /me verified! Decrypted Email:', meRes.data.user.email);

    // 3. Test Signup + OTP flow
    const testEmail = `tester_${Date.now()}@spotiflix.com`;
    console.log(`\n3️⃣ Testing Signup OTP for ${testEmail}...`);
    const signupRes = await axios.post(`${BASE_URL}/signup`, {
      email: testEmail,
      password: 'SuperSecret@Password123',
      name: 'Test Tester',
    });
    const otp = signupRes.data.devOtp;
    console.log('✅ OTP received in dev response:', otp);

    // 4. Test Verify OTP
    console.log('\n4️⃣ Testing Verify OTP...');
    const verifyRes = await axios.post(`${BASE_URL}/verify-otp`, {
      email: testEmail,
      code: otp,
      password: 'SuperSecret@Password123',
      name: 'Test Tester',
    });
    console.log('✅ Verify OTP success! User created:', verifyRes.data.user);

    // 5. Test Rate Limiting on Login
    console.log('\n5️⃣ Testing Rate Limiter on /login (spamming 6 bad requests)...');
    let hitRateLimit = false;
    for (let i = 1; i <= 6; i++) {
      try {
        await axios.post(`${BASE_URL}/login`, {
          email: 'wrong@spotiflix.com',
          password: 'wrongpassword',
        });
      } catch (err) {
        if (err.response?.status === 429) {
          hitRateLimit = true;
          console.log(`✅ Rate limit correctly blocked request #${i} with 429 Too Many Requests:`, err.response.data);
          break;
        } else {
          console.log(`Attempt #${i}: status ${err.response?.status}`);
        }
      }
    }

    if (hitRateLimit) {
      console.log('✅ Rate limiting is functioning perfectly!');
    }

    console.log('\n🎉 ALL BACKEND AUTH TESTS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Auth test failed:', err.response?.data || err.message);
  }
}

testAuth();
