// test-backend.js - Test script for Ghost Tracker Backend

const axios = require('axios');

const BACKEND_URL = 'http://localhost:3001';

// Test wallet addresses (well-known Solana addresses)
const TEST_WALLETS = [
    {
        name: 'Coinbase 2',
        address: '2ojv9BAiHUrvsm9gxDe7fJSzbNZSJcxZvf8dqmWGHG8S'
    },
    {
        name: 'Binance 1',
        address: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'
    },
    {
        name: 'FTX Exchange',
        address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'
    }
];

async function testHealthEndpoint() {
    console.log('\n🏥 Testing Health Endpoint...');
    try {
        const response = await axios.get(`${BACKEND_URL}/health`);
        console.log('✅ Health check passed:', response.data);
        return true;
    } catch (error) {
        console.error('❌ Health check failed:', error.message);
        return false;
    }
}

async function testSingleBalance() {
    console.log('\n💰 Testing Single Balance Endpoint...');
    const testWallet = TEST_WALLETS[0];
    
    try {
        const response = await axios.get(`${BACKEND_URL}/api/balance/${testWallet.address}`);
        console.log(`✅ Balance for ${testWallet.name}:`, response.data);
        return true;
    } catch (error) {
        console.error('❌ Single balance test failed:', error.message);
        return false;
    }
}

async function testBatchBalance() {
    console.log('\n📊 Testing Batch Balance Endpoint...');
    const addresses = TEST_WALLETS.map(w => w.address);
    
    try {
        const response = await axios.post(`${BACKEND_URL}/api/balance/batch`, {
            addresses
        });
        
        console.log('✅ Batch balance results:');
        response.data.results.forEach((result, index) => {
            const wallet = TEST_WALLETS[index];
            console.log(`   ${wallet.name}: ${result.balance} SOL (${result.status})`);
        });
        return true;
    } catch (error) {
        console.error('❌ Batch balance test failed:', error.message);
        return false;
    }
}

async function testInvalidAddress() {
    console.log('\n🚫 Testing Invalid Address Handling...');
    const invalidAddress = 'invalid-address-123';
    
    try {
        const response = await axios.get(`${BACKEND_URL}/api/balance/${invalidAddress}`);
        console.log('⚠️  Unexpected success for invalid address');
        return false;
    } catch (error) {
        if (error.response && error.response.status === 500) {
            console.log('✅ Invalid address properly rejected');
            return true;
        }
        console.error('❌ Unexpected error:', error.message);
        return false;
    }
}

async function testTransactions() {
    console.log('\n📜 Testing Transactions Endpoint...');
    const testWallet = TEST_WALLETS[0];
    
    try {
        const response = await axios.get(`${BACKEND_URL}/api/transactions/${testWallet.address}?limit=5`);
        console.log(`✅ Found ${response.data.transactions.length} recent transactions`);
        return true;
    } catch (error) {
        console.error('❌ Transactions test failed:', error.message);
        return false;
    }
}

async function runAllTests() {
    console.log('🚀 Starting Ghost Tracker Backend Tests');
    console.log('=====================================');
    
    let totalTests = 0;
    let passedTests = 0;
    
    // Check if server is running
    const healthOk = await testHealthEndpoint();
    totalTests++;
    if (healthOk) passedTests++;
    
    if (!healthOk) {
        console.log('\n❌ Server is not running! Please start the backend server first.');
        console.log('Run: npm start (or npm run dev)');
        return;
    }
    
    // Run other tests
    const tests = [
        testSingleBalance,
        testBatchBalance,
        testInvalidAddress,
        testTransactions
    ];
    
    for (const test of tests) {
        const passed = await test();
        totalTests++;
        if (passed) passedTests++;
    }
    
    // Summary
    console.log('\n=====================================');
    console.log(`📊 Test Summary: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
        console.log('✅ All tests passed! Backend is working correctly.');
    } else {
        console.log('⚠️  Some tests failed. Check the errors above.');
    }
}

// Run tests
runAllTests().catch(console.error);