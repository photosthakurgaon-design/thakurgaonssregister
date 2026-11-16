import os
import sys
import subprocess
import re
import time
import threading
import urllib.request
import qrcode
import server

CLOUDFLARED_URL = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
CLOUDFLARED_EXE = os.path.join(os.path.dirname(__file__), "cloudflared.exe")

def ensure_cloudflared():
    if not os.path.exists(CLOUDFLARED_EXE):
        print("=" * 65)
        print("🌐 প্রথমবার অনলাইন করার জন্য Cloudflare Tunnel ডাউনলোড হচ্ছে...")
        print("অনুগ্রহ করে কয়েক সেকেন্ড অপেক্ষা করুন (এটি মাত্র একবার হবে)...")
        print("=" * 65)
        try:
            def report_progress(block_num, block_size, total_size):
                if total_size > 0:
                    percent = min(100, int(block_num * block_size * 100 / total_size))
                    sys.stdout.write(f"\rডাউনলোড অগ্রগতি: {percent}% [{block_num * block_size // (1024*1024)} MB / {total_size // (1024*1024)} MB]")
                    sys.stdout.flush()
                    
            urllib.request.urlretrieve(CLOUDFLARED_URL, CLOUDFLARED_EXE, reporthook=report_progress)
            print("\n✅ Cloudflare Tunnel সফলভাবে ডাউনলোড সম্পন্ন হয়েছে!\n")
        except Exception as e:
            print(f"\n❌ ডাউনলোড করতে সমস্যা হয়েছে: {e}")
            print("বিকল্প হিসেবে আপনি Render.com এ ২৪/৭ ফ্রি হোস্ট করতে পারেন (README.md দেখুন)।")
            return False
    return True

def run_flask():
    server.app.run(host='0.0.0.0', port=5000, debug=False, use_reloader=False)

def start_tunnel():
    if not ensure_cloudflared():
        return

    # Start Flask server in background thread
    t = threading.Thread(target=run_flask, daemon=True)
    t.start()
    time.sleep(1.5)

    print("=" * 65)
    print("🚀 পাবলিক অনলাইন লিংক প্রস্তুত করা হচ্ছে...")
    print("=" * 65)

    # Launch cloudflared tunnel
    process = subprocess.Popen(
        [CLOUDFLARED_EXE, "tunnel", "--url", "http://127.0.0.1:5000"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1
    )

    tunnel_url = None
    url_pattern = re.compile(r'https://[a-zA-Z0-9-]+\.trycloudflare\.com')

    # Read output line by line to catch the public URL
    for line in iter(process.stderr.readline, ''):
        match = url_pattern.search(line)
        if match:
            tunnel_url = match.group(0)
            break

    if tunnel_url:
        print("\n" + "=" * 65)
        print("🎉 অভিনন্দন! আপনার রেজিস্টার খাতা এখন ইন্টারনেটে লাইভ!")
        print("=" * 65)
        print(f"🌐 আপনার স্থায়ী অনলাইন লিংক:\n   {tunnel_url}")
        print("=" * 65)
        print("📱 এই লিংকটি আপনার মোবাইলের যেকোনো ব্রাউজারে (Chrome/Safari) খুলুন")
        print("   বা যেকোনো নেটওয়ার্ক (4G/5G/WiFi) থেকে এন্ট্রি দিন ও খাতা দেখুন।")
        print("=" * 65)

        # Generate terminal QR code for phone scanning
        try:
            qr = qrcode.QRCode()
            qr.add_data(tunnel_url)
            qr.print_ascii(invert=True)
        except Exception:
            pass

        # Also launch browser
        try:
            import webbrowser
            webbrowser.open(tunnel_url)
        except Exception:
            pass

        # Keep alive
        try:
            process.wait()
        except KeyboardInterrupt:
            print("\nঅনলাইন সার্ভার বন্ধ করা হচ্ছে...")
            process.terminate()
    else:
        print("❌ টানেল লিংক তৈরি করতে বিলম্ব হচ্ছে।")

if __name__ == '__main__':
    start_tunnel()

