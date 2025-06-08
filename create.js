// create-transfers.js - Interactive transfer creator

const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const transfers = [];

function ask(question) {
    return new Promise(resolve => rl.question(question, resolve));
}

function parseDate(dateStr) {
    const cleanDate = dateStr.replace(' +UTC', '');
    return new Date(cleanDate);
}

async function addTransfer() {
    console.log('\n--- ADD NEW TRANSFER ---');
    
    const walletName = await ask('Wallet Name: ');
    const from = await ask('From Address: ');
    const to = await ask('To Address: ');
    const amount = await ask('Amount (SOL): ');
    const signature = await ask('Signature: ');
    const timestamp = await ask('Timestamp (e.g., May 29, 2025 05:16:28 +UTC): ');
    
    transfers.push({
        walletName,
        from,
        to,
        amount: parseFloat(amount),
        signature,
        timestamp
    });
    
    console.log('\n✓ Transfer added!');
}

async function main() {
    console.log('GHOST TRANSFER CREATOR');
    console.log('=====================\n');
    
    let continueAdding = true;
    
    while (continueAdding) {
        await addTransfer();
        const answer = await ask('\nAdd another transfer? (y/n): ');
        continueAdding = answer.toLowerCase() === 'y';
    }
    
    // Sort by date (most recent first)
    transfers.sort((a, b) => {
        const dateA = parseDate(a.timestamp);
        const dateB = parseDate(b.timestamp);
        return dateB - dateA;
    });
    
    // Generate the output
    const output = transfers.map(t => 
`        {
            walletName: "${t.walletName}",
            from: "${t.from}",
            to: "${t.to}",
            amount: ${t.amount},
            signature: "${t.signature}",
            timestamp: "${t.timestamp}"
        }`
    ).join(',\n');
    
    const fullOutput = `    transfers: [\n${output}\n    ]`;
    
    // Save to file
    fs.writeFileSync('transfers-output.txt', fullOutput);
    
    console.log('\n✓ Transfers saved to transfers-output.txt');
    console.log(`✓ Total transfers: ${transfers.length}`);
    console.log('\nYou can copy the content from transfers-output.txt into your data.js file.');
    
    rl.close();
}

main();