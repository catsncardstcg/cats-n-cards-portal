# LINE LIFF Integration - Complete Setup Guide

## Overview
This guide will walk you through setting up LINE LIFF integration for your Cats N Cards TCG portal, enabling automatic user identification and TikTok username auto-fill.

---

## Part 1: LINE Developer Setup (15-20 minutes)

### Step 1: Create LINE Developer Account
1. Go to https://developers.line.biz/console/
2. Click "Log in with LINE"
3. Sign in with your LINE account
4. Accept the terms of service

### Step 2: Create Provider
1. Click **"Create a new provider"**
2. Provider name: `Cats N Cards TCG` (or your business name)
3. Click **"Create"**

### Step 3: Create LINE Login Channel
1. Click on your newly created provider
2. Click **"Create a new channel"**
3. Select **"LINE Login"**
4. Fill in the details:
   - **Channel name:** `Cats N Cards Portal`
   - **Channel description:** `TikTok customer portal for payments and delivery`
   - **App types:** Check **"Web app"**
   - **Email address:** Your email
5. Click **"Create"**

### Step 4: Create LIFF App
1. In your LINE Login channel, go to the **"LIFF"** tab
2. Click **"Add"** button
3. Fill in LIFF app details:
   - **LIFF app name:** `Cats N Cards Portal`
   - **Size:** Select **"Full"** (recommended)
   - **Endpoint URL:** Your portal URL
     - If testing locally: `http://localhost:8000/index.html`
     - If deployed: `https://yourdomain.com/index.html`
   - **Scopes:** Check **"profile"** (to get user info)
   - **Bot link feature:** Optional (leave as-is)
4. Click **"Add"**

### Step 5: Copy LIFF ID
1. After creating, you'll see your LIFF app listed
2. **COPY the LIFF ID** (format: `1234567890-abcdefgh`)
3. Save it - you'll need this in the next step!

---

## Part 2: Frontend Configuration (5 minutes)

### Update LIFF ID in liff-init.js

Open `liff-init.js` and replace `YOUR_LIFF_ID_HERE` with your actual LIFF ID:

```javascript
// Line 6
const LIFF_ID = '1234567890-abcdefgh'; // Replace with your LIFF ID
```

### Update Backend URL in user-mapping.js

Open `user-mapping.js` and replace the backend URL:

```javascript
// Line 8
const BACKEND_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
```

(You'll get this URL in Part 3)

---

## Part 3: Google Apps Script Backend Setup (20-30 minutes)

### Step 1: Create Google Sheet
1. Go to https://sheets.google.com
2. Create a new spreadsheet
3. Name it: `Cats N Cards Portal Database`

### Step 2: Create Required Sheets
Create these tabs (click + at the bottom):

1. **User_Mappings** - Add these column headers:
   - A1: `LINE User ID`
   - B1: `TikTok Username`
   - C1: `LINE Display Name`
   - D1: `LINE Profile Picture URL`
   - E1: `Registration Date`
   - F1: `Last Access Date`

2. **Address_Registrations** - Add headers:
   - A1: `Date`
   - B1: `TikTok Username`
   - C1: `Full Name`
   - D1: `Phone`
   - E1: `Address`
   - F1: `Notes`
   - G1: `Screenshot URL`
   - H1: `Status`
   - I1: `LINE User ID`
   - J1: `LINE Display Name`
   - K1: `LINE Picture URL`

3. **Delivery_Requests** - Add headers:
   - A1: `Date`
   - B1: `TikTok Username`
   - C1: `Receipt URL`
   - D1: `Status`
   - E1: `LINE User ID`
   - F1: `LINE Display Name`
   - G1: `LINE Picture URL`

4. **Payments** - Add headers:
   - A1: `Date`
   - B1: `TikTok Username`
   - C1: `Amount`
   - D1: `Points Earned`
   - E1: `Receipt URL`
   - F1: `Status`
   - G1: `LINE User ID`
   - H1: `LINE Display Name`
   - I1: `LINE Picture URL`

5. **Tracking_Numbers** - Add headers:
   - A1: `Date`
   - B1: `Customer Name`
   - C1: `Tracking Number`
   - D1: `Carrier`

6. **Points** - Add headers:
   - A1: `TikTok Username`
   - B1: `Current Points`
   - C1: `Lifetime Points`

### Step 3: Copy Google Sheet ID
1. Look at your sheet's URL: `https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit`
2. Copy the `SHEET_ID_HERE` part
3. Save it for the next step

### Step 4: Create Google Apps Script
1. In your Google Sheet, click **Extensions > Apps Script**
2. Delete any existing code in the editor
3. Open the file `backend-code.gs` from your portal folder
4. **Copy ALL the code** from `backend-code.gs`
5. **Paste it** into the Apps Script editor
6. At the top of the file (line 28), replace `YOUR_GOOGLE_SHEET_ID_HERE` with your Sheet ID:

```javascript
const SPREADSHEET_ID = 'your-actual-sheet-id-here';
```

7. Click **Save** (disk icon)

### Step 5: Deploy as Web App
1. Click **Deploy > New deployment**
2. Click the gear icon ⚙️ next to "Select type"
3. Select **"Web app"**
4. Fill in deployment settings:
   - **Description:** `Cats N Cards Portal API v1`
   - **Execute as:** **Me** (your account)
   - **Who has access:** **Anyone** (important!)
5. Click **"Deploy"**
6. **Grant permissions:**
   - Click **"Authorize access"**
   - Select your Google account
   - Click **"Advanced"** > **"Go to [project name] (unsafe)"**
   - Click **"Allow"**
7. **COPY the Web app URL** (starts with `https://script.google.com/macros/s/...`)
8. Click **"Done"**

### Step 6: Update Frontend with Backend URL

Update these files with your Web App URL:

1. **user-mapping.js** (line 8):
```javascript
const BACKEND_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
```

2. **payment.html** (line 374):
```javascript
const SCRIPT_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
```

3. **delivery.html** (line 522):
```javascript
const SCRIPT_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
```

---

## Part 4: Testing (10-15 minutes)

### Test Locally

1. **Start local server:**
```bash
cd "d:\Facebook\cats-n-cards-portal"
python -m http.server 8000
```

2. **Test in regular browser first:**
   - Open: http://localhost:8000
   - You should see the portal
   - You should see a message: "เปิดใน LINE เพื่อประสบการณ์ที่ดีขึ้น"

3. **Test in LINE:**
   - Open LINE app on your phone
   - Send yourself the link: `http://YOUR_COMPUTER_IP:8000`
     - Find your IP: Run `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
     - Example: `http://192.168.1.100:8000`
   - Click the link in LINE
   - It should open in LINE's in-app browser
   - You should see a popup asking for your TikTok username
   - Enter your TikTok username (e.g., @yourname)
   - Click "บันทึก / Save"
   - Check your Google Sheet - you should see the mapping in User_Mappings tab!

4. **Test Auto-Fill:**
   - In LINE browser, navigate to Payment page
   - TikTok username should be pre-filled!
   - Navigate to Delivery page
   - TikTok username should be pre-filled in all 3 tabs!

---

## Part 5: Deployment (Production)

### Option A: GitHub Pages (Free)

1. Create a GitHub repository
2. Push all your portal files
3. Go to Settings > Pages
4. Select source: main branch
5. Your site will be at: `https://yourusername.github.io/repository-name/`

### Option B: Netlify (Free)

1. Go to https://netlify.com
2. Drag and drop your portal folder
3. Your site will be deployed instantly
4. Get your URL: `https://random-name.netlify.app`

### Option C: Your Own Domain

1. Upload files to your web hosting
2. Use your custom domain (e.g., https://catsncards.com)

### After Deployment: Update LIFF Endpoint

1. Go back to LINE Developers Console
2. Go to your LIFF app settings
3. Update **Endpoint URL** to your production URL
4. Click **"Update"**

---

## Part 6: Share with Customers

### Create a Shareable LINE Link

Your portal link: `https://liff.line.me/YOUR_LIFF_ID`

Example messages to send in LINE:

```
🐱 Cats N Cards Portal

ตรวจสอบแต้ม ชำระเงิน จัดส่ง ทั้งหมดในที่เดียว!

👉 https://liff.line.me/1234567890-abcdefgh

✅ ไม่ต้องกรอก username ซ้ำอีกต่อไป!
```

---

## Troubleshooting

### LIFF Initialization Failed
- Check if LIFF ID is correct in `liff-init.js`
- Verify endpoint URL in LINE Developers Console matches your actual URL
- Make sure you're testing in LINE app, not regular browser

### Popup Doesn't Appear
- Check browser console for errors (F12)
- Verify backend URL is correct
- Check if Google Apps Script is deployed with "Anyone" access

### Username Not Auto-Filling
- Open browser console and check for LIFF errors
- Verify mapping was saved to Google Sheet
- Try clearing LINE cache and reopening

### Backend Errors
- Check Google Apps Script logs (Execution > Logs)
- Verify Google Sheet ID is correct
- Check if all required sheets exist with correct names

---

## Summary Checklist

- [ ] LINE Developer account created
- [ ] Provider and channel created
- [ ] LIFF app created and LIFF ID copied
- [ ] LIFF ID updated in `liff-init.js`
- [ ] Google Sheet created with all required tabs
- [ ] Google Apps Script code deployed
- [ ] Backend URL updated in all HTML files
- [ ] Tested locally in LINE browser
- [ ] TikTok username popup working
- [ ] Auto-fill working on all pages
- [ ] Deployed to production (GitHub Pages/Netlify/hosting)
- [ ] LIFF endpoint URL updated to production URL
- [ ] Shared portal link with customers via LINE

---

## Support

If you encounter issues:
1. Check browser console (F12) for errors
2. Check Google Apps Script logs
3. Verify all configuration values are correct
4. Test with a fresh LINE account

---

**Congratulations! 🎉**

Your portal now has LINE LIFF integration. Users will only need to enter their TikTok username once, and it will auto-fill everywhere!
