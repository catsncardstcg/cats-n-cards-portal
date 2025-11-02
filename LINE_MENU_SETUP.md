# 📱 LINE Rich Menu Setup Guide

## 🎯 Overview

Your LINE Rich Menu will have 3 buttons that link to your website:

```
┌─────────────────────────┐
│  🐱 Cats N Cards TCG   │
├─────────┬───────────────┤
│ ⭐สะสมแต้ม│   📺 ดูไลฟ์   │
│  POINTS  │     LIVE     │
├──────────┴───────────────┤
│      📦 ส่งของ         │
│       DELIVERY         │
└─────────────────────────┘
```

---

## 📋 Before You Start

You need:
- ✅ LINE Official Account
- ✅ Your website URL (e.g., `https://yourdomain.com`)
- ✅ Rich menu image (the one you sent with cats and Pokemon)

---

## 🚀 Step-by-Step Setup

### Step 1: Access LINE Official Account Manager

1. Go to https://manager.line.biz
2. Log in with your LINE account
3. Select your **Cats N Cards TCG** official account

---

### Step 2: Create Rich Menu

1. Click **"Home"** in left sidebar
2. Scroll down to **"Rich menus"** section
3. Click **"Create"** button

---

### Step 3: Basic Settings

**Rich Menu Title:**
```
Cats N Cards TCG Menu
```

**Display Period:**
- Select: **"Always display"**

**Menu Bar Text:**
- Thai: `เมนู` or `Menu`
- English: `Menu`

---

### Step 4: Upload Image

1. Click **"Upload image"**
2. Select your rich menu image (the one with cats and Pokemon)
3. **Image requirements:**
   - Size: 2500 x 1686 pixels (or 2500 x 843 for smaller)
   - Format: JPG or PNG
   - Max file size: 1MB

**Your image layout:**
```
Top section: Logo/header
Middle row: 2 buttons (Points | Live)
Bottom row: 1 wide button (Delivery)
```

---

### Step 5: Set Action Areas

Now you'll map clickable areas to your website pages.

#### Template Style:
Select: **"Custom"** or use template similar to your design

#### Action Areas (3 total):

**Area 1: Points (⭐สะสมแต้ม) - Top Left**
- **Position:** Top left button
- **Action:** Link
- **URL:** `https://your-website.com/points.html`
- **Link type:** In-app browser

**Area 2: Live (📺ดูไลฟ์) - Top Right**
- **Position:** Top right button
- **Action:** Link
- **URL:** `https://your-website.com/live.html`
- **Link type:** In-app browser

**Area 3: Delivery (📦ส่งของ) - Bottom**
- **Position:** Bottom wide button
- **Action:** Link
- **URL:** `https://your-website.com/delivery.html`
- **Link type:** In-app browser

---

### Step 6: Define Click Areas

**If using grid system:**

For your layout (2500 x 1686):
```
Points button (left):
- X: 0
- Y: 563
- Width: 1250
- Height: 563

Live button (right):
- X: 1250
- Y: 563
- Width: 1250
- Height: 563

Delivery button (bottom):
- X: 0
- Y: 1126
- Width: 2500
- Height: 560
```

**Adjust based on your actual image dimensions!**

---

### Step 7: Preview & Test

1. Click **"Preview"** button
2. Test on your phone:
   - Scan QR code shown
   - Click each button
   - Verify correct pages open

**What to check:**
- ✅ Points button → Opens points.html
- ✅ Live button → Opens live.html
- ✅ Delivery button → Opens delivery.html
- ✅ All pages display correctly
- ✅ Mobile-friendly layout

---

### Step 8: Save & Publish

1. Click **"Save"**
2. Click **"Apply to all users"** or set target audience
3. **Publish** the rich menu

**Set as default:**
- Make sure it's the default menu for new/existing users
- Enable "Display immediately"

---

## 🎨 Alternative: Use LINE's Template

If custom positioning is tricky:

1. Choose **"Template A"** (3 button layout)
2. Upload your image
3. LINE auto-maps buttons
4. Adjust if needed

---

## ✅ Verification Checklist

After publishing:
- [ ] Open your LINE Official Account
- [ ] Rich menu appears at bottom
- [ ] Tap Points → Opens points page
- [ ] Tap Live → Opens livestream page
- [ ] Tap Delivery → Opens delivery page
- [ ] All pages are mobile-responsive
- [ ] Images load correctly
- [ ] QR code visible on delivery page

---

## 📱 Testing Tips

**Test on different devices:**
- iPhone
- Android
- Different screen sizes

**Test user journey:**
1. New user sees rich menu
2. Clicks Delivery
3. Can register successfully
4. Clicks Points
5. Can check points
6. Clicks Live
7. Opens TikTok

---

## 🎯 Pro Tips

### Tip 1: Menu Bar Text
Use emoji to make it stand out:
```
📋 เมนู
🐱 Menu
⭐ เริ่มต้น
```

### Tip 2: Promote the Menu
**In your messages:**
```
"👇 กดเมนูด้านล่างเพื่อ:"
"⭐ เช็คแต้ม"
"📺 ดูไลฟ์"
"📦 ขอจัดส่ง"
```

### Tip 3: Update Regularly
Change menu seasonally:
- Special event buttons
- Holiday themes
- New product announcements

### Tip 4: Analytics
LINE provides rich menu analytics:
- Check which button is clicked most
- Optimize based on user behavior
- A/B test different layouts

---

## 🔧 Troubleshooting

### Buttons not clicking
- Check action areas are correct
- Verify coordinates match your image
- Try using template instead of custom

### Wrong pages opening
- Double-check URLs (no typos)
- Ensure https:// prefix
- Test URLs in browser first

### Image not uploading
- Resize to exact dimensions
- Compress file size < 1MB
- Use JPG instead of PNG
- Check image isn't corrupted

### Menu not showing for users
- Verify it's published
- Check "Apply to all users" is selected
- Set display period correctly
- User might need to restart LINE

---

## 📊 Example URLs

Replace `your-website.com` with your actual domain:

**If using GitHub Pages:**
```
https://username.github.io/cats-n-cards-portal/points.html
https://username.github.io/cats-n-cards-portal/live.html
https://username.github.io/cats-n-cards-portal/delivery.html
```

**If using Netlify:**
```
https://cats-n-cards.netlify.app/points.html
https://cats-n-cards.netlify.app/live.html
https://cats-n-cards.netlify.app/delivery.html
```

**If using custom domain:**
```
https://catsnCards.com/points.html
https://catsncards.com/live.html
https://catsncards.com/delivery.html
```

---

## 🎨 Design Recommendations

**Your current image is great!** It has:
- ✅ Clear sections
- ✅ Cute cat/Pokemon theme
- ✅ Thai text labels
- ✅ Visual hierarchy

**If you want to update:**
- Keep 2500x1686 dimensions
- Maintain visual separation between buttons
- Use high contrast colors
- Include icons for each section
- Make text readable on mobile

---

## 📱 User Experience

**What customers see:**

1. **Open LINE chat**
   → Rich menu appears at bottom

2. **Tap menu icon**
   → Menu expands full screen

3. **Tap any button**
   → Opens web page in LINE browser

4. **Close page**
   → Returns to LINE chat

**Seamless experience!** No app switching needed.

---

## 🚀 Launch Announcement

**After setup, announce to customers:**

**Message 1: Introduction**
```
🎉 เปิดตัวระบบใหม่!

กดเมนูด้านล่างได้เลย:
⭐ สะสมแต้ม - ซื้อทุก 250 บาท = 1 แต้ม
📺 ดูไลฟ์ - ชมสินค้าใหม่ทุกวัน
📦 ส่งของ - จัดส่งสะดวกรวดเร็ว

ลองใช้งานกันได้เลย! 🐱✨
```

**Message 2: Benefits**
```
💰 แต้มสามารถแลกได้:
• 3 แต้ม = ส่งฟรี
• 5 แต้ม = การ์ดโปรโม
• 10 แต้ม = ส่วนลด 50 บาท
และอื่นๆ อีกมากมาย!

กดเมนู ⭐ สะสมแต้ม เพื่อดูรายการแลก
```

---

## ✅ Final Checklist

Before announcing:
- [ ] Rich menu published
- [ ] All 3 buttons work
- [ ] Website pages load correctly
- [ ] Mobile-responsive
- [ ] QR code visible
- [ ] Tested on multiple devices
- [ ] Welcome message prepared
- [ ] TikTok bio updated with link

---

**You're all set!** 🎉

Your LINE Rich Menu is now your customers' gateway to:
- ⭐ Earning points
- 📺 Watching livestreams
- 📦 Easy deliveries

**Enjoy the automated workflow!** 🚀
