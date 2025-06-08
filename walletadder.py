import requests
import json
from datetime import datetime

# Your wallet addresses
WALLETS = {
    "GJA1HEbxGnqBhBifH9uQauzXSB53to5rhDrzmKxhSU65": "Latuche",
    "G5nxEXuFMfV74DSnsrSatqCW32F34XUnBeq3PfDS7w5E": "Profit", 
    "FvTBarKFhrnhL9Q55bSJnMmAdXisayUb5u96eLejhMF9": "Scooter",
    "F72vY99ihQsYwqEDCfz7igKXA5me6vN2zqVsVUTpw6qL": "Jalen",
    "EdMG3CkMECJfrTFX6hkWyjRxmetDijLPG3TBP7gBkjS3": "Mazo",
    "EdDCRfDDeiiDXdntrP59abH4DXHFNU48zpMPYisDMjA7": "Mezoteric",
    "DpNVrtA3ERfKzX4F8Pi2CVykdJJjoNxyY5QgoytAwD26": "Gorilla",
    "DNfuF1L62WWyW3pNakVkyGGFzVVhj4Yr52jSmdTyeBHm": "Gake",
    "DfMxre4cKmvogbLrPigxmibVTTQDuzjdXojWzjCXXhzj": "Euris",
    "D3Z7weHeLGWA7eg1qwVB66NCs8YLxiDTBVE6Eb1tTmwg": "Andrew tate",
    "CyaE1VxvBrahnPWkqm5VsdCvyS2QmNht2UFrKJHga54o": "Cented",
    "CRVidEDtEUTYZisCxBZkpELzhQc9eauMLR3FWg74tReL": "Frank",
    "CpoC3hUDGDnEdSZF7egZTddgnKUeXVnoPJTNDUaM98GC": "Orangie",
    "BCnqsPEtA1TkgednYEebRpkmwFRJDCjMQcKZMMtEdArc": "Kreo",
    "ACTbvbNm5qTLuofNRPxFPMtHAAtdH1CtzhCZatYHy831": "Slidrzz",
    "8zFZHuSRuDpuAR7J6FzwyF3vKNx4CVW3DFHJerQhc7Zd": "Pow",
    "8deJ9xeUvXSJwicYptA9mHsU2rN2pDx37KWzkDkEXhU6": "Cooker",
    "831qmkeGhfL8YpcXuhrug6nHj1YdK3aXMDQUCo85Auh1": "Meechie",
    "73LnJ7G9ffBDjEBGgJDdgvLUhD5APLonKrNiHsKDCw5B": "Wadles",
    "62FZUSWPMX9pofoV1uWHMdzFJRjwMa1LHgh2zhdEB7Zj": "Blossom",
    "3pZ59YENxDAcjaKa3sahZJBcgER4rGYi4v6BpPurmsGj": "Kaden",
    "DScqtGwFoDTme2Rzdjpdb2w7CtuKc6Z8KF7hMhbx8ugQ": "Shaw",
    "8yJFWmVTQq69p6VJxGwpzW7ii7c5J9GRAtHCNMMQPydj": "Lexpro"
}

# Known program addresses to ignore (DEX, DeFi, etc.)
IGNORE_PROGRAMS = {
    "11111111111111111111111111111111",  # System Program
    "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",  # Raydium AMM
    "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",  # Raydium V4
    "JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB",   # Jupiter
    "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",   # Jupiter V6
    "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",   # Pump.fun
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",  # Token Program
    "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",  # Associated Token Program
}

# Minimum SOL amount to track
MIN_TRANSFER_AMOUNT = float(input("Minimum SOL transfer to track (e.g., 100): "))

# How many recent transactions to check per wallet
TRANSACTIONS_TO_CHECK = int(input("How many recent transactions to check per wallet (e.g., 50): "))

def get_recent_transactions(address):
    """Get recent transaction signatures for an address"""
    try:
        response = requests.post('https://api.mainnet-beta.solana.com', 
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "getSignaturesForAddress",
                "params": [address, {"limit": TRANSACTIONS_TO_CHECK}]
            })
        return response.json().get('result', [])
    except:
        return []

def get_transaction_details(signature):
    """Get detailed transaction info"""
    try:
        response = requests.post('https://api.mainnet-beta.solana.com', 
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "getTransaction",
                "params": [signature, {"encoding": "jsonParsed", "maxSupportedTransactionVersion": 0}]
            })
        return response.json().get('result')
    except:
        return None

def is_simple_sol_transfer(tx_data):
    """Check if this is a simple SOL transfer (not a DEX swap or program interaction)"""
    if not tx_data or not tx_data.get('transaction'):
        return False
    
    instructions = tx_data['transaction']['message'].get('instructions', [])
    
    # Should have only 1-2 instructions for simple transfers
    if len(instructions) > 2:
        return False
    
    for instruction in instructions:
        program_id = instruction.get('programId')
        
        # Allow system program (for SOL transfers)
        if program_id == "11111111111111111111111111111111":
            continue
            
        # If it involves any other program, it's likely a swap/DEX trade
        if program_id in IGNORE_PROGRAMS or program_id != "11111111111111111111111111111111":
            return False
    
    return True

def analyze_simple_transfer(tx_data, wallet_address):
    """Extract SOL transfer info from simple transactions only"""
    if not tx_data or not tx_data.get('meta'):
        return None
    
    # Only analyze simple SOL transfers
    if not is_simple_sol_transfer(tx_data):
        return None
    
    meta = tx_data['meta']
    
    # Check for balance changes (SOL transfers)
    pre_balances = meta.get('preBalances', [])
    post_balances = meta.get('postBalances', [])
    account_keys = tx_data['transaction']['message']['accountKeys']
    
    # Find our wallet in the account keys
    wallet_index = -1
    for i, account in enumerate(account_keys):
        if isinstance(account, dict):
            if account.get('pubkey') == wallet_address:
                wallet_index = i
                break
        elif account == wallet_address:
            wallet_index = i
            break
    
    if wallet_index == -1 or wallet_index >= len(pre_balances):
        return None
    
    # Calculate SOL change for our wallet
    pre_balance = pre_balances[wallet_index] / 1_000_000_000  # Convert lamports to SOL
    post_balance = post_balances[wallet_index] / 1_000_000_000
    sol_change = post_balance - pre_balance
    
    # Only track significant changes
    if abs(sol_change) >= MIN_TRANSFER_AMOUNT:
        # Find the receiving wallet (should be simple for basic transfers)
        other_address = None
        for i, (pre, post) in enumerate(zip(pre_balances, post_balances)):
            if i != wallet_index and abs(pre - post) >= (MIN_TRANSFER_AMOUNT * 1_000_000_000):
                if i < len(account_keys):
                    addr = account_keys[i]
                    if isinstance(addr, dict):
                        addr = addr.get('pubkey', 'Unknown')
                    other_address = addr
                    break
        
        if other_address:
            return {
                'sol_change': sol_change,
                'direction': 'OUT' if sol_change < 0 else 'IN',
                'amount': abs(sol_change),
                'other_address': other_address,
                'timestamp': tx_data.get('blockTime'),
                'signature': tx_data['transaction']['signatures'][0] if tx_data.get('transaction', {}).get('signatures') else 'Unknown'
            }
    
    return None

def main():
    print(f"🔍 Scanning {len(WALLETS)} wallets for PURE SOL TRANSFERS >= {MIN_TRANSFER_AMOUNT} SOL...")
    print(f"📊 Checking last {TRANSACTIONS_TO_CHECK} transactions per wallet")
    print(f"⚠️  Ignoring DEX swaps, meme coin buys, and program interactions")
    print(f"✅ Only tracking simple wallet-to-wallet SOL transfers\n")
    
    all_transfers = []
    
    for address, name in WALLETS.items():
        print(f"Scanning {name}...")
        
        # Get recent transaction signatures
        signatures = get_recent_transactions(address)
        
        transfers_found = 0
        for sig_data in signatures:
            signature = sig_data['signature']
            
            # Get transaction details
            tx_details = get_transaction_details(signature)
            
            # Analyze for simple SOL transfers only
            transfer_info = analyze_simple_transfer(tx_details, address)
            
            if transfer_info:
                transfer_info['wallet_name'] = name
                transfer_info['wallet_address'] = address
                all_transfers.append(transfer_info)
                transfers_found += 1
        
        print(f"  -> Found {transfers_found} pure SOL transfers")
    
    # Sort by timestamp (newest first)
    all_transfers.sort(key=lambda x: x.get('timestamp', 0), reverse=True)
    
    # Generate the Ghost Tracker transfer data
    print(f"\n🎯 Found {len(all_transfers)} PURE SOL transfers (no DEX/meme coin trades)!")
    
    if len(all_transfers) == 0:
        print("No pure SOL transfers found. This is normal if they only trade and don't move between wallets.")
        return
    
    # Create transfers for Ghost Tracker format
    ghost_transfers = []
    for transfer in all_transfers:
        timestamp = datetime.fromtimestamp(transfer['timestamp']).isoformat() + 'Z' if transfer['timestamp'] else datetime.now().isoformat() + 'Z'
        
        # Determine from/to addresses
        if transfer['direction'] == 'OUT':
            from_addr = transfer['wallet_address']
            to_addr = transfer['other_address']
        else:
            from_addr = transfer['other_address']
            to_addr = transfer['wallet_address']
        
        ghost_transfer = {
            "walletName": transfer['wallet_name'],
            "from": from_addr,
            "to": to_addr,
            "amount": transfer['amount'],
            "signature": transfer['signature'],
            "timestamp": timestamp
        }
        ghost_transfers.append(ghost_transfer)
    
    # Generate the transfers section for Ghost Tracker
    with open("ghost_transfers.txt", "w") as f:
        f.write("    // TRANSFERS - Pure SOL wallet-to-wallet transfers only\n")
        f.write("    transfers: [\n")
        
        for i, transfer in enumerate(ghost_transfers):
            comma = "," if i < len(ghost_transfers) - 1 else ""
            f.write(f"        {{\n")
            f.write(f"            walletName: \"{transfer['walletName']}\",\n")
            f.write(f"            from: \"{transfer['from']}\",\n")
            f.write(f"            to: \"{transfer['to']}\",\n")
            f.write(f"            amount: {transfer['amount']},\n")
            f.write(f"            signature: \"{transfer['signature']}\",\n")
            f.write(f"            timestamp: \"{transfer['timestamp']}\"\n")
            f.write(f"        }}{comma}\n")
        
        f.write("    ]\n")
    
    print(f"\n✅ Generated ghost_transfers.txt with {len(ghost_transfers)} pure SOL transfers")
    print("\nPure SOL transfers found (wallet migrations):")
    print("=" * 80)
    
    for transfer in all_transfers[:10]:  # Show first 10
        direction_emoji = "📤" if transfer['direction'] == 'OUT' else "📥"
        timestamp_str = datetime.fromtimestamp(transfer['timestamp']).strftime('%Y-%m-%d %H:%M:%S') if transfer['timestamp'] else 'Unknown'
        other_addr = transfer['other_address'][:8] + "..." + transfer['other_address'][-8:] if len(transfer['other_address']) > 16 else transfer['other_address']
        print(f"{direction_emoji} {transfer['wallet_name']}: {transfer['amount']:.2f} SOL {transfer['direction']} {other_addr} - {timestamp_str}")
    
    if len(all_transfers) > 10:
        print(f"... and {len(all_transfers) - 10} more transfers")

if __name__ == "__main__":
    main()