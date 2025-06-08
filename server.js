// server.js - Ghost Tracker Backend Server
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

// Configuration
const PORT = process.env.PORT || 3001;
const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '361627b6-ee29-4f85-aa18-71015c2486f1';
const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

// Middleware
app.use(cors({
    origin: '*'  // Allow all origins for testing
}));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Ghost Tracker Backend is running' });
});

// Get wallet balance endpoint
app.get('/api/balance/:address', async (req, res) => {
    const { address } = req.params;
    
    try {
        console.log(`Fetching balance for address: ${address}`);
        
        // Primary: Try Helius first
        try {
            const response = await axios.post(HELIUS_RPC_URL, {
                jsonrpc: '2.0',
                id: 1,
                method: 'getBalance',
                params: [address]
            }, {
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (response.data && !response.data.error) {
                const balanceInLamports = response.data.result.value;
                const balanceInSol = balanceInLamports / 1000000000;
                
                return res.json({
                    success: true,
                    address,
                    balance: balanceInSol,
                    source: 'helius'
                });
            }
        } catch (heliusError) {
            console.log('Helius failed, trying fallback endpoints...');
        }

        // Fallback endpoints
        const fallbackEndpoints = [
            'https://api.mainnet-beta.solana.com',
            'https://solana-api.projectserum.com'
        ];

        for (const endpoint of fallbackEndpoints) {
            try {
                const response = await axios.post(endpoint, {
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'getBalance',
                    params: [address]
                }, {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    timeout: 5000
                });

                if (response.data && !response.data.error) {
                    const balanceInLamports = response.data.result.value;
                    const balanceInSol = balanceInLamports / 1000000000;
                    
                    return res.json({
                        success: true,
                        address,
                        balance: balanceInSol,
                        source: endpoint
                    });
                }
            } catch (err) {
                continue;
            }
        }

        throw new Error('All RPC endpoints failed');

    } catch (error) {
        console.error('Error fetching balance:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch wallet balance',
            message: error.message
        });
    }
});

// Batch balance check endpoint
app.post('/api/balance/batch', async (req, res) => {
    const { addresses } = req.body;
    
    if (!addresses || !Array.isArray(addresses)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid request',
            message: 'Please provide an array of addresses'
        });
    }

    try {
        const results = [];
        
        for (const address of addresses) {
            try {
                const response = await axios.post(HELIUS_RPC_URL, {
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'getBalance',
                    params: [address]
                }, {
                    headers: {
                        'Content-Type': 'application/json',
                    }
                });

                if (response.data && !response.data.error) {
                    const balanceInLamports = response.data.result.value;
                    const balanceInSol = balanceInLamports / 1000000000;
                    
                    results.push({
                        address,
                        balance: balanceInSol,
                        status: 'success'
                    });
                } else {
                    results.push({
                        address,
                        balance: 0,
                        status: 'error',
                        error: 'Failed to fetch'
                    });
                }
                
                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                results.push({
                    address,
                    balance: 0,
                    status: 'error',
                    error: error.message
                });
            }
        }
        
        res.json({
            success: true,
            results
        });
        
    } catch (error) {
        console.error('Batch balance check error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Batch balance check failed',
            message: error.message
        });
    }
});

// Get large SOL transfers for a wallet using Helius Enhanced API
app.get('/api/transfers/:address', async (req, res) => {
    const { address } = req.params;
    const { minAmount = 50 } = req.query;
    
    try {
        console.log(`Scanning transfers for ${address} (min: ${minAmount} SOL)`);
        
        // Use Helius Enhanced Transactions API
        const response = await axios.post(`https://api.helius.xyz/v0/addresses/${address}/transactions?api-key=${HELIUS_API_KEY}`, {
            limit: 100,
            type: ['TRANSFER']
        });

        if (!response.data) {
            throw new Error('No data received from Helius');
        }

        // Filter for large SOL transfers (not token transfers)
        const largeTransfers = [];
        
        for (const tx of response.data) {
            // Check if it's a native SOL transfer
            if (tx.type === 'TRANSFER' && tx.tokenTransfers && tx.tokenTransfers.length === 0) {
                // Get the amount in SOL (from lamports)
                const amount = (tx.amount || 0) / 1000000000;
                
                if (amount >= parseFloat(minAmount)) {
                    // Determine if this wallet sent or received
                    const isSender = tx.source === address;
                    
                    largeTransfers.push({
                        signature: tx.signature,
                        timestamp: tx.timestamp,
                        amount: amount,
                        type: isSender ? 'SENT' : 'RECEIVED',
                        from: tx.source,
                        to: tx.destination || 'Unknown',
                        description: tx.description || `Transferred ${amount.toFixed(2)} SOL`,
                        fee: (tx.fee || 0) / 1000000000
                    });
                }
            }
        }

        // Sort by timestamp (newest first)
        largeTransfers.sort((a, b) => b.timestamp - a.timestamp);

        res.json({
            success: true,
            address,
            transfers: largeTransfers,
            count: largeTransfers.length
        });
        
    } catch (error) {
        console.error('Error fetching transfers:', error.message);
        
        // Fallback to basic RPC method
        try {
            console.log('Trying fallback method...');
            const signatures = await axios.post(HELIUS_RPC_URL, {
                jsonrpc: '2.0',
                id: 1,
                method: 'getSignaturesForAddress',
                params: [address, { limit: 100 }]
            });

            if (signatures.data && signatures.data.result) {
                // Get transaction details for each signature
                const transfers = [];
                
                for (const sig of signatures.data.result.slice(0, 20)) { // Limit to 20 to avoid rate limits
                    try {
                        const txResponse = await axios.post(HELIUS_RPC_URL, {
                            jsonrpc: '2.0',
                            id: 1,
                            method: 'getTransaction',
                            params: [sig.signature, { encoding: 'jsonParsed' }]
                        });

                        if (txResponse.data && txResponse.data.result) {
                            const tx = txResponse.data.result;
                            const meta = tx.meta;
                            
                            if (meta && !meta.err) {
                                // Calculate SOL transfer amount
                                const preBalance = meta.preBalances[0] / 1000000000;
                                const postBalance = meta.postBalances[0] / 1000000000;
                                const amount = Math.abs(preBalance - postBalance);
                                
                                if (amount >= parseFloat(minAmount)) {
                                    transfers.push({
                                        signature: sig.signature,
                                        timestamp: sig.blockTime,
                                        amount: amount,
                                        type: preBalance > postBalance ? 'SENT' : 'RECEIVED',
                                        from: address,
                                        to: 'Check on Solscan',
                                        fee: (meta.fee || 0) / 1000000000
                                    });
                                }
                            }
                        }
                    } catch (txError) {
                        console.error('Error fetching transaction:', txError.message);
                    }
                }
                
                res.json({
                    success: true,
                    address,
                    transfers,
                    count: transfers.length,
                    note: 'Using fallback method - limited details available'
                });
            } else {
                throw new Error('Fallback method failed');
            }
        } catch (fallbackError) {
            res.status(500).json({
                success: false,
                error: 'Failed to fetch transfers',
                message: error.message
            });
        }
    }
});

// Scan all wallets for large transfers
app.post('/api/transfers/scan-all', async (req, res) => {
    const { wallets, minAmount = 50 } = req.body;
    
    if (!wallets || !Array.isArray(wallets)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid request',
            message: 'Please provide an array of wallet objects'
        });
    }

    try {
        const allTransfers = [];
        
        for (const wallet of wallets) {
            console.log(`Scanning transfers for ${wallet.name}...`);
            
            try {
                // Get transfers for this wallet
                const response = await axios.get(`http://localhost:${PORT}/api/transfers/${wallet.address}?minAmount=${minAmount}`);
                
                if (response.data.success && response.data.transfers) {
                    // Add wallet info to each transfer
                    const walletsTransfers = response.data.transfers.map(t => ({
                        ...t,
                        walletName: wallet.name,
                        walletAddress: wallet.address
                    }));
                    
                    allTransfers.push(...walletsTransfers);
                }
                
                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 500));
                
            } catch (error) {
                console.error(`Error scanning ${wallet.name}:`, error.message);
            }
        }
        
        // Sort all transfers by timestamp (newest first)
        allTransfers.sort((a, b) => b.timestamp - a.timestamp);
        
        // Analyze patterns
        const analysis = analyzeTransferPatterns(allTransfers, wallets);
        
        res.json({
            success: true,
            transfers: allTransfers,
            count: allTransfers.length,
            analysis
        });
        
    } catch (error) {
        console.error('Scan all error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Scan failed',
            message: error.message
        });
    }
});

// Helper function to analyze transfer patterns
function analyzeTransferPatterns(transfers, wallets) {
    const walletAddresses = new Set(wallets.map(w => w.address.toLowerCase()));
    const connections = {};
    const suspiciousPatterns = [];
    
    transfers.forEach(transfer => {
        const from = transfer.from.toLowerCase();
        const to = transfer.to.toLowerCase();
        
        // Check if transfer is between tracked wallets
        if (walletAddresses.has(from) && walletAddresses.has(to)) {
            suspiciousPatterns.push({
                type: 'INTERNAL_TRANSFER',
                from: transfer.from,
                to: transfer.to,
                amount: transfer.amount,
                timestamp: transfer.timestamp,
                walletName: transfer.walletName
            });
        }
        
        // Track connections
        if (!connections[from]) connections[from] = { sent: 0, received: 0, addresses: new Set() };
        if (!connections[to]) connections[to] = { sent: 0, received: 0, addresses: new Set() };
        
        if (transfer.type === 'SENT') {
            connections[from].sent += transfer.amount;
            connections[from].addresses.add(to);
        } else {
            connections[to].received += transfer.amount;
            connections[to].addresses.add(from);
        }
    });
    
    return {
        suspiciousPatterns,
        totalVolume: transfers.reduce((sum, t) => sum + t.amount, 0),
        uniqueAddresses: Object.keys(connections).length,
        connections: Object.entries(connections).map(([addr, data]) => ({
            address: addr,
            totalSent: data.sent,
            totalReceived: data.received,
            connectedWallets: Array.from(data.addresses)
        }))
    };
}

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: err.message
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Ghost Tracker Backend running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    process.exit(0);
});
