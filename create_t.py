#!/usr/bin/env python3
# create_transfers.py - Simple transfer creator

from datetime import datetime

transfers = []

print("TRANSFER CREATOR")
print("================")
print("Enter transfers (press Enter on empty line to finish)\n")

while True:
    print("\n--- New Transfer ---")
    wallet_name = input("Wallet Name: ").strip()
    
    if not wallet_name:
        break
        
    from_addr = input("From Address: ").strip()
    to_addr = input("To Address: ").strip()
    amount = input("Amount (SOL): ").strip()
    signature = input("Signature: ").strip()
    timestamp = input("Timestamp (e.g., May 29, 2025 05:16:28 +UTC): ").strip()
    
    transfers.append({
        'walletName': wallet_name,
        'from': from_addr,
        'to': to_addr,
        'amount': float(amount),
        'signature': signature,
        'timestamp': timestamp
    })
    
    print("✓ Transfer added!")

# Sort by date (most recent first)
def parse_date(date_str):
    clean_date = date_str.replace(' +UTC', '')
    return datetime.strptime(clean_date, '%B %d, %Y %H:%M:%S')

transfers.sort(key=lambda x: parse_date(x['timestamp']), reverse=True)

# Generate output
output_lines = []
for t in transfers:
    output_lines.append(f'''        {{
            walletName: "{t['walletName']}",
            from: "{t['from']}",
            to: "{t['to']}",
            amount: {t['amount']},
            signature: "{t['signature']}",
            timestamp: "{t['timestamp']}"
        }}''')

output = '    transfers: [\n' + ',\n'.join(output_lines) + '\n    ]'

# Save to file
with open('transfers.txt', 'w') as f:
    f.write(output)

print(f"\n✓ {len(transfers)} transfers saved to transfers.txt (sorted by most recent)")
print("Copy the content into your data.js file")