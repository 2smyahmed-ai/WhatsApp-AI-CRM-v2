# 🔍 Debug: WhatsApp Session Widget Not Loading

Your system is clearly working (611 messages today!) but the warm-up widget shows "Initializing session data..." instead of displaying the actual data.

---

## 🧪 Step 1: Check API Response

Open your browser's **Developer Tools** and test the API directly:

```javascript
// In your browser console, run:
fetch('/api/whatsapp/status', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
  }
})
.then(r => r.json())
.then(data => console.log(JSON.stringify(data, null, 2)))
```

**Expected output should show**:
```json
{
  "status": "connected",
  "connectedPhone": "+1234567890",
  "error": null,
  "queueDepth": 0,
  "session": {
    "createdAt": "2026-06-10T...",
    "dayNumber": 4,
    "warmup": {
      "active": true,
      "phaseName": "new",
      "dailyLimit": 20,
      "dailySent": 611,
      "dailyRemaining": -591,
      "fullyUnlockedAt": "2026-06-25T...",
      "perMinuteCap": 20
    }
  }
}
```

**If `session` is `null`**, that's the problem. Continue to Step 2.

---

## 🧪 Step 2: Check Network Tab

1. Open DevTools (F12)
2. Go to **Network** tab
3. Refresh dashboard (Ctrl+R)
4. Find the `/api/whatsapp/status` request
5. Click it and check:
   - **Status**: Should be `200`
   - **Time**: Should be `<100ms`
   - **Response**: Should include `session` object

**If response time is >5 seconds**, the API is hanging.

---

## 🔧 Step 3: Check Backend Database

The issue is likely that **WhatsAppSession record doesn't exist**. Run these commands in your database:

```sql
-- Check if WhatsAppSession exists
SELECT * FROM "WhatsAppSession" LIMIT 5;

-- If empty, the session was never saved to DB
-- That means Baileys auth state wasn't persisted

-- Check Messages to confirm data exists
SELECT COUNT(*) as total_messages, 
       COUNT(CASE WHEN "fromMe" = true THEN 1 END) as sent_today
FROM "Message"
WHERE DATE("timestamp") = CURRENT_DATE;
```

---

## ✅ Solution: Force Session Creation

If `WhatsAppSession` table is empty but you have messages, the Baileys session wasn't persisted. Do this:

### Option A: Quick Reset (Recommended)
1. Stop dev server (Ctrl+C)
2. Delete the auth directory:
   ```bash
   rm -rf auth_info_baileys
   ```
3. Restart dev server:
   ```bash
   npm run dev
   ```
4. Scan QR code again (if needed)
5. Dashboard should now show warm-up widget

### Option B: Manual Database Entry
If you want to keep existing messages, manually insert a session:

```sql
INSERT INTO "WhatsAppSession" ("id", "sessionId", "data", "createdAt", "updatedAt")
VALUES (
  'cuid_here',
  'default',
  '{}',
  NOW(),
  NOW()
);
```

---

## 📊 Expected Warm-up Display

Once session loads, widget should show:

```
WhatsApp Session                    🟢 Connected

WARM-UP PERIOD
Day 4 of 15    ████████░░░░░░░░░░  27%
Full capacity unlocks June 28

TODAY'S MESSAGES
611 / 50 sent   ████████████████░░  ⚠️
Resets at midnight

ℹ️ These limits protect your account from bans.
   Limits increase automatically each week.
```

**Note**: Your 611 messages today exceeds the warm-up limit!  
This shows the warm-up gate isn't enforcing yet (which is fine for testing).

---

## 🚨 Why 611 Messages Exceeds Limit?

Looking at your dashboard:
- Day 4 of warm-up should have max 50 messages
- You have 611 messages
- This means either:
  1. **Session is older than Day 4** (Day 15+, so no limit)
  2. **Warm-up isn't being enforced** (gate not in sender.ts)
  3. **Different session** (messages from before warm-up was added)

---

## ✅ Verification Checklist

- [ ] Run the console command above
- [ ] Check if `session` object appears in response
- [ ] If `session` is null, check WhatsAppSession table
- [ ] If table empty, do Option A (Quick Reset)
- [ ] Refresh dashboard and verify widget displays
- [ ] Should see warm-up progress bars

---

## 🔗 Related Files

If you want to debug further:
- Backend: `apps/backend/src/api/routes/whatsapp.routes.ts` (status endpoint)
- Backend: `apps/backend/src/lib/status-cache.ts` (caching logic)
- Frontend: `apps/frontend/hooks/useSessionStatus.ts` (API fetching)
- Frontend: `apps/frontend/components/dashboard/SessionStatusWidget.tsx` (display)

---

## 💬 Still Stuck?

If widget still won't load after these steps:
1. Check browser console for errors (F12)
2. Check backend logs for `whatsapp_status` errors
3. Verify `/api/whatsapp/status` returns data (not null)
4. Verify `getSessionId()` returns valid sessionId
