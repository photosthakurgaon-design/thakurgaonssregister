import os
from PIL import Image, ImageDraw, ImageFont

def create_icon(size):
    # Create image with RGBA
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    pad = int(size * 0.08)
    
    # Outer rounded book cover (Dark Emerald / Royal Leather tone)
    # Background color: rich teal/emerald leather #064e3b or royal indigo #1e1b4b
    cover_color = (19, 78, 74, 255) # Deep Teal / Classic Ledger Green
    spine_color = (13, 148, 136, 255) # Lighter Teal Spine
    gold_accent = (245, 158, 11, 255) # Gold Amber
    cream_pages = (254, 243, 199, 255) # Warm ledger paper
    
    # Draw shadow
    shadow_box = [pad + 4, pad + 8, size - pad + 4, size - pad + 8]
    draw.rounded_rectangle(shadow_box, radius=int(size * 0.12), fill=(0, 0, 0, 60))
    
    # Draw book cover
    book_box = [pad, pad, size - pad, size - pad]
    radius = int(size * 0.12)
    draw.rounded_rectangle(book_box, radius=radius, fill=cover_color)
    
    # Draw spine on the left
    spine_w = int(size * 0.14)
    spine_box = [pad, pad, pad + spine_w, size - pad]
    # Draw left rounded rect and clip or draw with radius
    draw.rounded_rectangle(spine_box, radius=radius, fill=spine_color)
    # Fix right edge of spine
    draw.rectangle([pad + spine_w // 2, pad, pad + spine_w, size - pad], fill=spine_color)
    
    # Gold decorative vertical line along spine
    line_x = pad + spine_w + int(size * 0.015)
    draw.line([(line_x, pad + int(size * 0.08)), (line_x, size - pad - int(size * 0.08))], fill=gold_accent, width=max(2, int(size * 0.012)))
    
    # Draw inner ledger page cutout/inset
    page_pad_left = line_x + int(size * 0.05)
    page_pad_right = size - pad - int(size * 0.06)
    page_top = pad + int(size * 0.12)
    page_bottom = size - pad - int(size * 0.12)
    page_box = [page_pad_left, page_top, page_pad_right, page_bottom]
    draw.rounded_rectangle(page_box, radius=int(size * 0.04), fill=cream_pages)
    
    # Draw ruled ledger lines inside the page
    num_lines = 5
    page_h = page_bottom - page_top
    line_spacing = page_h / (num_lines + 1)
    
    # Red margin line on page
    red_margin_x = page_pad_left + int((page_pad_right - page_pad_left) * 0.22)
    draw.line([(red_margin_x, page_top + 4), (red_margin_x, page_bottom - 4)], fill=(225, 29, 72, 180), width=max(1, int(size * 0.008)))
    
    # Soft horizontal ledger lines
    for i in range(1, num_lines + 1):
        ly = page_top + int(i * line_spacing)
        draw.line([(page_pad_left + int(size * 0.03), ly), (page_pad_right - int(size * 0.03), ly)], 
                  fill=(148, 163, 184, 150), width=max(1, int(size * 0.007)))
    
    # Bookmark ribbon hanging down
    ribbon_w = int(size * 0.08)
    ribbon_x = size - pad - int(size * 0.16)
    ribbon_top = pad
    ribbon_bottom = pad + int(size * 0.38)
    draw.rectangle([ribbon_x, ribbon_top, ribbon_x + ribbon_w, ribbon_bottom], fill=(220, 38, 38, 255))
    # Ribbon V cutout
    draw.polygon([
        (ribbon_x, ribbon_bottom),
        (ribbon_x + ribbon_w // 2, ribbon_bottom - int(size * 0.04)),
        (ribbon_x + ribbon_w, ribbon_bottom)
    ], fill=cream_pages)
    
    # Central emblem or badge: Pen / Checklist symbol
    badge_cx = int(page_pad_left + (page_pad_right - page_pad_left) * 0.58)
    badge_cy = int(page_top + page_h * 0.52)
    badge_r = int(size * 0.14)
    draw.ellipse([badge_cx - badge_r, badge_cy - badge_r, badge_cx + badge_r, badge_cy + badge_r], fill=(13, 148, 136, 230))
    
    # Draw checkmark or pen symbol inside badge
    chk_p1 = (badge_cx - int(badge_r * 0.5), badge_cy)
    chk_p2 = (badge_cx - int(badge_r * 0.15), badge_cy + int(badge_r * 0.45))
    chk_p3 = (badge_cx + int(badge_r * 0.55), badge_cy - int(badge_r * 0.4))
    draw.line([chk_p1, chk_p2, chk_p3], fill=(255, 255, 255, 255), width=max(2, int(size * 0.03)), joint='curve')
    
    return img

os.makedirs('static/icons', exist_ok=True)

# Generate 192x192
icon_192 = create_icon(192)
icon_192.save('static/icons/icon-192.png', 'PNG')

# Generate 512x512
icon_512 = create_icon(512)
icon_512.save('static/icons/icon-512.png', 'PNG')

# Generate 96x96 and favicon
icon_96 = create_icon(96)
icon_96.save('static/icons/icon-96.png', 'PNG')

# Save ICO
icon_512.save('static/icons/favicon.ico', format='ICO', sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])

print("Icons generated successfully!")

