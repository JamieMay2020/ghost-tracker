// Ghost Tracker - Updated Frontend with Backend Integration

// Backend configuration
const BACKEND_URL = 'http://localhost:3001'; // Change this to your backend URL

// Data source from data.js file
let data = {
    wallets: {},
    transfers: []
};

// Fetch wallet balance from backend
async function fetchWalletBalance(address) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/balance/${address}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            return result.balance;
        } else {
            throw new Error(result.message || 'Failed to fetch balance');
        }
    } catch (error) {
        console.error('Error fetching balance:', error);
        throw error;
    }
}

// Scan multiple wallets with progress updates using batch endpoint
async function scanWalletBalances(wallets, progressCallback) {
    const results = [];
    const batchSize = 5; // Process 5 wallets at a time
    
    for (let i = 0; i < wallets.length; i += batchSize) {
        const batch = wallets.slice(i, Math.min(i + batchSize, wallets.length));
        const addresses = batch.map(w => w.address);
        
        try {
            progressCallback && progressCallback(i, wallets.length, batch[0]);
            
            const response = await fetch(`${BACKEND_URL}/api/balance/batch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ addresses })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                // Match results with wallet data
                batch.forEach((wallet, index) => {
                    const result = data.results.find(r => r.address === wallet.address);
                    if (result) {
                        results.push({
                            ...wallet,
                            balance: result.balance,
                            lastUpdated: new Date().toISOString(),
                            status: result.status
                        });
                    }
                });
            }
        } catch (error) {
            console.error(`Failed to fetch batch starting at ${i}:`, error);
            // Add error results for this batch
            batch.forEach(wallet => {
                results.push({
                    ...wallet,
                    balance: wallet.balance || 0,
                    lastUpdated: new Date().toISOString(),
                    status: 'error',
                    error: error.message
                });
            });
        }
    }
    
    return results;
}

// Check backend health on startup
async function checkBackendHealth() {
    try {
        const response = await fetch(`${BACKEND_URL}/health`);
        const data = await response.json();
        console.log('Backend health check:', data);
        return true;
    } catch (error) {
        console.error('Backend is not reachable:', error);
        alert('Warning: Backend server is not running. Please start the backend server for wallet scanning to work.');
        return false;
    }
}

// Scan all wallets for large transfers
async function scanWalletTransfers() {
    const scanBtn = document.getElementById('scan-transfers-btn');
    const scanText = document.getElementById('scan-transfers-text');
    const progressDiv = document.getElementById('transfer-scan-progress');
    
    if (!scanBtn) return;
    
    const wallets = Object.values(data.wallets);
    
    if (wallets.length === 0) {
        alert('No wallets to scan');
        return;
    }
    
    // Show progress
    scanBtn.disabled = true;
    scanText.textContent = 'SCANNING TRANSFERS...';
    if (progressDiv) progressDiv.style.display = 'block';
    
    try {
        console.log(`Scanning transfers for ${wallets.length} wallets`);
        
        const response = await fetch(`${BACKEND_URL}/api/transfers/scan-all`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                wallets: wallets.map(w => ({ name: w.name, address: w.address })),
                minAmount: 50
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            // Clear existing transfers
            data.transfers = [];
            
            // Add new transfers to data
            result.transfers.forEach((transfer, index) => {
                data.transfers.push({
                    id: `scan_${Date.now()}_${index}`,
                    walletName: transfer.walletName,
                    amount: transfer.amount,
                    from: transfer.from,
                    to: transfer.to,
                    signature: transfer.signature,
                    timestamp: new Date(transfer.timestamp * 1000).toISOString(),
                    type: transfer.type,
                    fee: transfer.fee || 0
                });
            });
            
            // Update UI
            updateUI();
            
            // Show analysis results
            if (result.analysis && result.analysis.suspiciousPatterns.length > 0) {
                let alertMessage = `Found ${result.analysis.suspiciousPatterns.length} transfers between tracked wallets:\n\n`;
                result.analysis.suspiciousPatterns.forEach(p => {
                    alertMessage += `${p.walletName} → ${p.amount.toFixed(2)} SOL\n`;
                });
                alert(alertMessage);
            } else if (result.count === 0) {
                alert('No large transfers (50+ SOL) found in recent transactions');
            } else {
                alert(`Found ${result.count} large transfers. Check the alerts feed.`);
            }
        }
        
    } catch (error) {
        console.error('Transfer scan failed:', error);
        alert(`Scan failed: ${error.message}`);
    } finally {
        scanBtn.disabled = false;
        scanText.textContent = 'SCAN FOR LARGE TRANSFERS';
        if (progressDiv) progressDiv.style.display = 'none';
    }
}

// Initialize transfer scanner button
function initializeTransferScanner() {
    const scanBtn = document.getElementById('scan-transfers-btn');
    if (scanBtn) {
        scanBtn.addEventListener('click', scanWalletTransfers);
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
    // Check backend health
    await checkBackendHealth();
    
    loadDataFromFile();
    initializeNavigation();
    initializeModal();
    initializeWalletForm();
    initializeRefreshButton();
    initializeTransferScanner(); // Add this line
    updateUI();
});

// Load data from GHOST_DATA (defined in data.js)
function loadDataFromFile() {
    if (window.GHOST_DATA) {
        // Convert wallet array to object for easier access
        data.wallets = {};
        window.GHOST_DATA.wallets.forEach(wallet => {
            data.wallets[wallet.address] = {
                ...wallet,
                status: wallet.status || 'unknown',
                lastUpdated: wallet.lastUpdated || new Date().toISOString()
            };
        });
        
        // Add IDs to transfers if not present
        data.transfers = window.GHOST_DATA.transfers.map((transfer, index) => ({
            ...transfer,
            id: transfer.id || `transfer_${Date.now()}_${index}`
        }));
        
        console.log('Data loaded from data.js:', {
            wallets: Object.keys(data.wallets).length,
            transfers: data.transfers.length
        });
    } else {
        console.error('GHOST_DATA not found. Make sure data.js is loaded before script.js');
    }
}

// Navigation
function initializeNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const allLinks = document.querySelectorAll('.nav-link');
            const allSections = document.querySelectorAll('.section');
            
            allLinks.forEach(l => l.classList.remove('active'));
            allSections.forEach(s => s.classList.remove('active'));
            
            this.classList.add('active');
            
            const target = this.getAttribute('href');
            const targetSection = document.querySelector(target);
            
            if (targetSection) {
                targetSection.classList.add('active');
            }
        });
    });
}

// Modal
function initializeModal() {
    const modal = document.getElementById('transfer-modal');
    const closeBtn = modal.querySelector('.close');
    
    closeBtn.onclick = function() {
        modal.style.display = 'none';
    };
    
    window.onclick = function(event) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };
    
    // Remove delete functionality since data is managed in file
    const deleteBtn = document.getElementById('delete-transfer');
    if (deleteBtn) {
        deleteBtn.style.display = 'none';
    }
}

// Add wallet form handling
function initializeWalletForm() {
    const form = document.getElementById('add-wallet-form');
    const addBtn = document.getElementById('add-wallet-btn');
    const addText = document.getElementById('add-wallet-text');
    
    if (!form || !addBtn || !addText) {
        console.log('Wallet form elements not found, skipping initialization');
        return;
    }
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const name = document.getElementById('wallet-name').value.trim();
        const address = document.getElementById('wallet-address').value.trim();
        
        if (!name || !address) {
            alert('Please fill in both fields');
            return;
        }
        
        // Validate Solana address format (basic check)
        if (address.length < 32 || address.length > 44) {
            alert('Invalid Solana address format. Should be 32-44 characters.');
            return;
        }
        
        // Check if wallet already exists
        if (data.wallets[address]) {
            alert('Wallet already exists');
            return;
        }
        
        // Disable form
        addBtn.disabled = true;
        addText.textContent = 'SCANNING BALANCE...';
        
        try {
            console.log(`Scanning balance for wallet: ${name} (${address})`);
            
            // Fetch balance from backend
            const balance = await fetchWalletBalance(address);
            
            console.log(`Balance fetched successfully: ${balance} SOL`);
            
            // Add to data with custom flag
            data.wallets[address] = {
                name: name,
                address: address,
                balance: balance,
                lastUpdated: new Date().toISOString(),
                status: 'success',
                isCustom: true  // Mark as custom-added wallet
            };
            
            // Update UI
            updateUI();
            
            // Clear form
            form.reset();
            
            alert(`Wallet "${name}" added successfully!\nBalance: ${balance.toFixed(4)} SOL`);
            
        } catch (error) {
            console.error('Error adding wallet:', error);
            alert(`Failed to scan wallet balance:\n${error.message}\n\nPlease make sure the backend server is running.`);
        } finally {
            addBtn.disabled = false;
            addText.textContent = 'ADD WALLET & SCAN BALANCE';
        }
    });
}

// Refresh all wallet balances
function initializeRefreshButton() {
    const refreshBtn = document.getElementById('refresh-all-btn');
    const refreshText = document.getElementById('refresh-text');
    const progressDiv = document.getElementById('scan-progress');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    const currentWalletText = document.getElementById('current-wallet');
    
    if (!refreshBtn) {
        console.log('Refresh button not found, skipping initialization');
        return;
    }
    
    refreshBtn.addEventListener('click', async function() {
        const wallets = Object.values(data.wallets);
        
        if (wallets.length === 0) {
            alert('No wallets to refresh');
            return;
        }
        
        // Show progress
        refreshBtn.disabled = true;
        refreshText.textContent = 'SCANNING...';
        if (progressDiv) progressDiv.style.display = 'block';
        
        try {
            console.log(`Starting balance refresh for ${wallets.length} wallets`);
            
            const results = await scanWalletBalances(wallets, (current, total, wallet) => {
                const percentage = ((current + 1) / total) * 100;
                if (progressFill) progressFill.style.width = `${percentage}%`;
                if (progressText) progressText.textContent = `${current + 1}/${total}`;
                if (currentWalletText) currentWalletText.textContent = `Scanning ${wallet.name}...`;
            });
            
            // Update data with results
            results.forEach(wallet => {
                data.wallets[wallet.address] = wallet;
            });
            
            // Update UI
            updateUI();
            
            // Update last refresh time
            const lastUpdateElement = document.getElementById('last-update-time');
            if (lastUpdateElement) {
                lastUpdateElement.textContent = new Date().toLocaleTimeString();
            }
            
            const successCount = results.filter(w => w.status === 'success').length;
            const errorCount = results.filter(w => w.status === 'error').length;
            
            console.log(`Balance refresh completed: ${successCount} successful, ${errorCount} failed`);
            
            if (errorCount > 0) {
                alert(`Refresh completed with some errors:\n${successCount} wallets updated successfully\n${errorCount} wallets failed to update`);
            }
            
        } catch (error) {
            console.error('Refresh failed:', error);
            alert(`Scan failed: ${error.message}`);
        } finally {
            refreshBtn.disabled = false;
            refreshText.textContent = 'REFRESH ALL BALANCES';
            if (progressDiv) progressDiv.style.display = 'none';
        }
    });
}

// Update UI
function updateUI() {
    updateStats();
    updateTransferFeed();
    updateWalletGrid();
}

function updateStats() {
    // Update home stats
    const walletCount = Object.keys(data.wallets).length;
    const alertCount = data.transfers.length;
    
    // Calculate 24h volume
    const now = new Date();
    const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const volume24h = data.transfers
        .filter(t => new Date(t.timestamp) > dayAgo)
        .reduce((sum, t) => sum + t.amount, 0);
    
    const walletCountEl = document.getElementById('wallet-count');
    const alertCountEl = document.getElementById('alert-count');
    const volume24hEl = document.getElementById('volume-24h');
    const totalWalletsEl = document.getElementById('total-wallets');
    
    if (walletCountEl) walletCountEl.textContent = walletCount;
    if (alertCountEl) alertCountEl.textContent = alertCount;
    if (volume24hEl) volume24hEl.textContent = `${volume24h.toFixed(2)} SOL`;
    if (totalWalletsEl) totalWalletsEl.textContent = walletCount;
    
    const totalBalance = Object.values(data.wallets)
        .reduce((sum, w) => sum + (w.balance || 0), 0);
    const totalBalanceEl = document.getElementById('total-balance');
    if (totalBalanceEl) totalBalanceEl.textContent = totalBalance.toFixed(2);
}

function updateTransferFeed() {
    const feed = document.getElementById('alerts-feed');
    if (!feed) return;
    
    if (data.transfers.length === 0) {
        feed.innerHTML = `
            <div class="empty-state">
                <p>NO TRANSFERS RECORDED YET</p>
                <p class="empty-hint">Add transfers to data.js file</p>
            </div>
        `;
        return;
    }
    
    feed.innerHTML = '';
    
    data.transfers.forEach(transfer => {
        const alertItem = createAlertItem(transfer);
        feed.appendChild(alertItem);
    });
}

function createAlertItem(transfer) {
    const item = document.createElement('div');
    item.className = 'alert-item';
    
    if (transfer.amount >= 1000) {
        item.classList.add('critical');
    } else if (transfer.amount >= 500) {
        item.classList.add('warning');
    }
    
    const timeAgo = getTimeAgo(new Date(transfer.timestamp));
    const transferType = transfer.type || 'TRANSFER';
    const typeClass = transferType === 'SENT' ? 'sent' : 'received';
    
    item.innerHTML = `
        <div class="alert-content">
            <div class="alert-wallet">${transfer.walletName}</div>
            <div class="alert-details">
                <div class="alert-message">
                    <span class="transfer-type ${typeClass}">${transferType}</span>
                    ${transfer.amount.toFixed(2)} SOL
                </div>
                <div class="alert-addresses">${truncateAddress(transfer.from)} → ${truncateAddress(transfer.to)}</div>
            </div>
            <div class="alert-meta">
                <span class="alert-amount">${transfer.amount.toFixed(2)} SOL</span>
                <span class="alert-time">${timeAgo}</span>
            </div>
        </div>
    `;
    
    item.addEventListener('click', () => showTransferDetails(transfer));
    
    return item;
}

function updateWalletGrid() {
    const grid = document.getElementById('wallet-grid');
    if (!grid) return;
    
    const walletArray = Object.values(data.wallets);
    
    if (walletArray.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <p>NO WALLETS TRACKED</p>
                <p class="empty-hint">Add wallets above to start tracking</p>
            </div>
        `;
        return;
    }
    
    // Sort wallets: custom wallets first, then by name
    walletArray.sort((a, b) => {
        if (a.isCustom && !b.isCustom) return -1;
        if (!a.isCustom && b.isCustom) return 1;
        return a.name.localeCompare(b.name);
    });
    
    grid.innerHTML = '';
    
    walletArray.forEach(wallet => {
        const card = createWalletCard(wallet);
        grid.appendChild(card);
    });
}

function createWalletCard(wallet) {
    const card = document.createElement('div');
    card.className = 'wallet-card';
    
    // Add custom class if it's a custom wallet
    if (wallet.isCustom) {
        card.classList.add('custom-wallet');
    }
    
    const statusClass = wallet.status === 'error' ? 'error' : 
                       wallet.status === 'loading' ? 'loading' : 'success';
    
    const statusText = wallet.status === 'error' ? 'SCAN FAILED' :
                      wallet.status === 'loading' ? 'SCANNING...' : 
                      wallet.lastUpdated ? `UPDATED ${getTimeAgo(new Date(wallet.lastUpdated))}` : 'NEVER UPDATED';
    
    card.innerHTML = `
        <div class="wallet-header">
            <div class="wallet-name">${wallet.name}</div>
            ${wallet.isCustom ? '<span class="custom-badge">CUSTOM</span>' : ''}
        </div>
        <div class="wallet-address">${truncateAddress(wallet.address)}</div>
        <div class="wallet-balance ${statusClass}">${(wallet.balance || 0).toFixed(4)} SOL</div>
        <div class="balance-status">${statusText}</div>
        <div class="wallet-actions">
            <button class="wallet-button" onclick="copyAddress('${wallet.address}')">COPY ADDRESS</button>
            <button class="wallet-button" onclick="viewOnSolscan('${wallet.address}')">VIEW ON SOLSCAN</button>
            <button class="wallet-button danger" onclick="removeWallet('${wallet.address}')">REMOVE</button>
        </div>
    `;
    
    return card;
}

// Remove wallet function
window.removeWallet = function(address) {
    if (confirm('Are you sure you want to remove this wallet?')) {
        delete data.wallets[address];
        updateUI();
    }
};

// Transfer Details Modal
function showTransferDetails(transfer) {
    const modal = document.getElementById('transfer-modal');
    if (!modal) return;
    
    const elements = {
        walletName: document.getElementById('transfer-wallet-name'),
        amount: document.getElementById('transfer-amount'),
        fromAddress: document.getElementById('from-address'),
        toAddress: document.getElementById('to-address'),
        signature: document.getElementById('tx-signature'),
        time: document.getElementById('tx-time'),
        solscanLink: document.getElementById('solscan-link'),
        twitterBtn: document.getElementById('share-twitter')
    };
    
    if (elements.walletName) elements.walletName.textContent = transfer.walletName;
    if (elements.amount) elements.amount.textContent = `${transfer.amount.toFixed(4)} SOL`;
    if (elements.fromAddress) elements.fromAddress.textContent = transfer.from;
    if (elements.toAddress) elements.toAddress.textContent = transfer.to;
    if (elements.signature) elements.signature.textContent = truncateAddress(transfer.signature);
    if (elements.time) elements.time.textContent = new Date(transfer.timestamp).toLocaleString();
    
    // Set Solscan link
    if (elements.solscanLink) {
        elements.solscanLink.href = `https://solscan.io/tx/${transfer.signature}`;
    }
    
    // Set Twitter share
    if (elements.twitterBtn) {
        elements.twitterBtn.onclick = function() {
            const text = `I just watched ${transfer.walletName} transfer ${transfer.amount.toFixed(2)} SOL from ${(transfer.from)} to ${(transfer.to)} using Ghost Monitor`;
            const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
            window.open(url, '_blank');
        };
    }
    
    modal.style.display = 'block';
}

// Utility Functions
function truncateAddress(address) {
    if (!address) return '';
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return `${seconds}S AGO`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}M AGO`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}H AGO`;
    return `${Math.floor(seconds / 86400)}D AGO`;
}

// Global functions for wallet actions
window.copyAddress = function(address) {
    navigator.clipboard.writeText(address).then(() => {
        alert('ADDRESS COPIED');
    }).catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = address;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('ADDRESS COPIED');
    });
};

window.viewOnSolscan = function(address) {
    window.open(`https://solscan.io/account/${address}`, '_blank');
};

// Auto-refresh every 30 seconds if data.js changes
setInterval(() => {
    if (window.GHOST_DATA && 
        (window.GHOST_DATA.transfers.length !== data.transfers.length ||
         window.GHOST_DATA.wallets.length !== Object.keys(data.wallets).length)) {
        loadDataFromFile();
        updateUI();
        console.log('Data refreshed from file');
    }
}, 30000);