@echo off
title গিটহাবে সম্পূর্ণ প্রজেক্ট আপলোড (Push to GitHub)
color 0A
chcp 65001 >nul
cls

echo ============================================================
echo   🚀 গিটহাবে সম্পূর্ণ প্রজেক্ট আপলোড করা হচ্ছে...
echo   (static ফোল্ডার সহ সকল ফাইল)
echo ============================================================
echo.

git init
git remote remove origin 2>nul
git remote add origin https://github.com/photosthakurgaon-design/thakurgaonssregister.git
git branch -M main
git add .
git commit -m "Upload full static assets, html, css, js and server"
git push -u origin main --force

echo.
echo ============================================================
echo   ✅ গিটহাবে সফলভাবে আপলোড সম্পন্ন হয়েছে!
echo   Render স্বয়ংক্রিয়ভাবে ২ মিনিটের মধ্যে লাইভ আপডেট করে নেবে।
echo ============================================================
pause

