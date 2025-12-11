# Manage Discount Usage - Quick Reference

## Overview
Admin tool to query and reset discount usage for NFT serials that provide holder discounts.

**Location:** `scripts/interactions/ForeverMinter/admin/manageDiscountUsage.js`

## Features
- ✅ Query discount usage for multiple serials at once
- ✅ View detailed usage statistics (used/remaining/percentage)
- ✅ Reset discount usage back to zero (admin only)
- ✅ Batch operations for efficiency
- ✅ Automatic verification of admin rights
- ✅ Confirmation prompts before resets

## Quick Start

### Query Usage
```bash
# Check single serial
node scripts/interactions/ForeverMinter/admin/manageDiscountUsage.js query 0.0.123456 1

# Check multiple serials
node scripts/interactions/ForeverMinter/admin/manageDiscountUsage.js query 0.0.123456 1 2 3 5 8 13 21
```

### Reset Usage (Admin Only)
```bash
# Reset single serial
node scripts/interactions/ForeverMinter/admin/manageDiscountUsage.js reset 0.0.123456 1

# Reset multiple serials
node scripts/interactions/ForeverMinter/admin/manageDiscountUsage.js reset 0.0.123456 1 2 3 5 8
```

## Command Syntax

```
node manageDiscountUsage.js <action> <tokenId> [serials...]
```

**Parameters:**
- `action` - Either `query` or `reset`
- `tokenId` - The discount token ID (e.g., `0.0.123456`)
- `serials` - One or more serial numbers (space-separated)

## Output Examples

### Query Output
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Discount Token Configuration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Token: 0.0.4728371
Discount: 25%
Max Uses Per Serial: 8

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Current Discount Usage
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Serial #1:
   Status: ✅ UNUSED
   Used: 0/8 (0.0%)
   Remaining: 8

Serial #42:
   Status: 🟡 ACTIVE
   Used: 3/8 (37.5%)
   Remaining: 5

Serial #100:
   Status: ❌ EXHAUSTED
   Used: 8/8 (100.0%)
   Remaining: 0

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total Serials Checked: 3
✅ Unused: 1
🟡 Partially Used: 1
❌ Exhausted: 1
```

### Reset Output
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  RESET DISCOUNT USAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  WARNING: This will reset discount usage for the following serials:

   Serial #42: 3 → 0 uses
   Serial #100: 8 → 0 uses

💡 After reset, these serials will have their full discount uses available again.
   This is useful when serials return to the team or for promotional resets.

Do you want to proceed with the reset? [y/N]: y

🔐 Verifying admin rights...
✅ Admin rights confirmed

⛽ Estimating gas...

   Gas Limit: 200,000
   Gas Price: 0.000001 tinybar/gas
   Estimated Cost: 0.00200 HBAR

📝 Resetting discount usage...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Reset Complete!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎉 Discount usage has been reset for:
   • Serial #42 → 8 uses available
   • Serial #100 → 8 uses available
```

## Use Cases

### 1. Serial Returns to Team
When a used serial comes back to the team inventory:
```bash
# Check current usage
node scripts/interactions/ForeverMinter/admin/manageDiscountUsage.js query 0.0.4728371 42

# Reset if needed
node scripts/interactions/ForeverMinter/admin/manageDiscountUsage.js reset 0.0.4728371 42
```

### 2. Promotional Campaign
Reset multiple high-tier serials for a special event:
```bash
# Reset legendary serials 1-10
node scripts/interactions/ForeverMinter/admin/manageDiscountUsage.js reset 0.0.4728371 1 2 3 4 5 6 7 8 9 10
```

### 3. Regular Monitoring
Check usage on valuable serials periodically:
```bash
# Check all legendary serials
node scripts/interactions/ForeverMinter/admin/manageDiscountUsage.js query 0.0.4728371 1 10 100 1000
```

### 4. Batch Operations
Query or reset many serials efficiently:
```bash
# Query 20 serials at once
node scripts/interactions/ForeverMinter/admin/manageDiscountUsage.js query 0.0.4728371 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20
```

## Error Handling

### Common Errors

**Token not configured:**
```
❌ Error: Token 0.0.123456 is not configured as a discount token

💡 Tip: Use addDiscountTier.js to add this token as a discount token first
```

**Not an admin:**
```
❌ Error: Account 0.0.12345 is not an admin
   Only admins can reset discount usage
```

**No usage to reset:**
```
ℹ️  All selected serials already have zero usage. Nothing to reset.
```

## Gas Costs

**Query Operations:** Free (read-only)

**Reset Operations:**
- Base: ~150,000 gas
- Per Serial: ~25,000 gas
- Example: 5 serials = ~275,000 gas ≈ 0.00275 HBAR (at 0.000001 tinybar/gas)

## Notes

- ✅ Query is always free (read-only operation)
- ⚠️  Reset requires admin role
- 🔒 Reset operations require confirmation
- 📊 Batch operations are more gas-efficient than individual calls
- 💡 Only serials with usage > 0 will be reset (automatic filtering)
- 🎯 Reset is permanent - serials get full uses restored

## Related Scripts

- `addDiscountTier.js` - Configure tokens as discount tokens
- `updateDiscountTier.js` - Modify discount tier settings
- `removeDiscountTier.js` - Remove discount token configuration
- `checkDiscounts.js` - Check user's discount eligibility

## Contract Functions Used

### Query
- `getTokenTierIndex(address)` - Get tier index for token
- `getDiscountTier(uint256)` - Get tier configuration
- `getBatchSerialDiscountUsage(address, uint256[])` - Get usage counts

### Reset
- `isAdmin(address)` - Verify admin rights
- `resetSerialDiscountUsage(address, uint256[])` - Reset usage (emits `SerialDiscountUsageReset` event)
