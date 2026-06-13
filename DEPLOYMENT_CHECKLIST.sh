#!/bin/bash
# GameZone Platform - Quick Deployment Checklist
# Copy and run through this list before launching

echo "🎮 GameZone Platform - Pre-Launch Checklist"
echo "=========================================="
echo ""

# 1. Files Check
echo "✓ Checking files..."
FILES_OK=true
if [ ! -f "firebase-config.js" ]; then echo "❌ firebase-config.js missing"; FILES_OK=false; fi
if [ ! -f "admin/admin.html" ]; then echo "❌ admin/admin.html missing"; FILES_OK=false; fi
if [ ! -f "admin/admin.js" ]; then echo "❌ admin/admin.js missing"; FILES_OK=false; fi
if [ ! -f "core/game-save.js" ]; then echo "❌ core/game-save.js missing"; FILES_OK=false; fi
if [ ! -f "core/friends-system.js" ]; then echo "❌ core/friends-system.js missing"; FILES_OK=false; fi
if [ ! -f "core/points-system.js" ]; then echo "❌ core/points-system.js missing"; FILES_OK=false; fi
if [ ! -f "core/game-management.js" ]; then echo "❌ core/game-management.js missing"; FILES_OK=false; fi
if [ ! -f "core/admin-management.js" ]; then echo "❌ core/admin-management.js missing"; FILES_OK=false; fi

if [ "$FILES_OK" = true ]; then
    echo "✅ All core files present!"
fi

# 2. Documentation Check
echo ""
echo "✓ Checking documentation..."
if [ -f "QUICKSTART.md" ]; then echo "✅ QUICKSTART.md"; fi
if [ -f "PLATFORM_GUIDE.md" ]; then echo "✅ PLATFORM_GUIDE.md"; fi
if [ -f "FEATURES_SUMMARY.md" ]; then echo "✅ FEATURES_SUMMARY.md"; fi
if [ -f "PLATFORM_README.md" ]; then echo "✅ PLATFORM_README.md"; fi

# 3. Firebase Setup Reminder
echo ""
echo "⚠️  Firebase Configuration Required:"
echo "   1. Go to firebase.google.com and create project"
echo "   2. Copy config to firebase-config.js"
echo "   3. Enable Email/Password authentication"
echo "   4. Create Firestore database"
echo "   5. Deploy firestore-advanced.rules"

# 4. Deploy Instructions
echo ""
echo "🚀 To Deploy:"
echo "   Firebase Hosting:"
echo "     npm install -g firebase-tools"
echo "     firebase login"
echo "     firebase deploy"
echo ""
echo "   Netlify:"
echo "     Connect GitHub repo"
echo "     Deploy from / directory"
echo ""
echo "   Local Testing:"
echo "     python3 -m http.server 8000"
echo "     Visit http://localhost:8000"

echo ""
echo "✅ Checklist complete! Ready to launch."
