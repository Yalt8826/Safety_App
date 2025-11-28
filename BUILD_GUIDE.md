# Women's Safety App - Build Guide

## 🚀 Build for Your Phone

### Step 1: Install Expo Go App
- **Android**: Download from Google Play Store
- **iOS**: Download from App Store

### Step 2: Start Development Server
```bash
npm start
```

### Step 3: Test on Your Phone
1. Open Expo Go app on your phone
2. Scan the QR code from terminal/browser
3. App will load on your phone instantly!

## 📱 Build APK for Android

### Step 1: Create Expo Account
```bash
eas login
```

### Step 2: Build APK
```bash
npm run build:android
```

### Step 3: Download APK
- EAS will provide download link
- Install APK directly on Android phone

## 🔧 Local Development

### Quick Start
```bash
# Install dependencies
npm install

# Start development server
npm start

# For Android device
npm run android

# For iOS device (Mac only)
npm run ios
```

## 📋 Features Ready for Mobile

✅ **Emergency SOS** - Send alerts to contacts
✅ **Voice/Video Calls** - Call emergency contacts  
✅ **Location Tracking** - Real GPS coordinates
✅ **Emergency Detection** - Voice recognition for "help"
✅ **AR Navigation** - Camera-based directions
✅ **Contact Management** - Add/remove trusted contacts
✅ **Evidence Recording** - Audio/video capture

## 🔐 Permissions Required

- **Location** - For emergency location sharing
- **Camera** - For AR navigation and recording
- **Microphone** - For emergency detection
- **Phone** - For making emergency calls
- **SMS** - For sending emergency messages

## 🛠️ Environment Setup

Make sure your `.env` file has:
```
EXPO_PUBLIC_TEST_MODE=false
EXPO_PUBLIC_FIREBASE_API_KEY=your_key
EXPO_PUBLIC_TWILIO_SID=your_sid
```

## 📞 Support

- Test with Expo Go first
- Build APK for permanent installation
- All features work on real devices