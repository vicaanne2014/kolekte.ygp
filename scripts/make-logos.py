# Membuat logo ringan dan ikon aplikasi dari docs/logo.png ke public/.
# Pakai:  python scripts/make-logos.py .   (butuh Pillow: pip install pillow)
import sys
from PIL import Image

root = sys.argv[1]
src = Image.open(root + "/docs/logo.png").convert("RGBA")
print("sumber:", src.size)


def square(size, bg=None, pad=0.08):
    """Logo di tengah kanvas persegi (logo berbentuk potret), dengan ruang di tepi."""
    canvas = Image.new("RGBA", (size, size), bg or (0, 0, 0, 0))
    inner = int(size * (1 - 2 * pad))
    w, h = src.size
    scale = inner / max(w, h)
    logo = src.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    canvas.paste(logo, ((size - logo.width) // 2, (size - logo.height) // 2), logo)
    return canvas


# Logo untuk tampilan (header, sidebar, halaman masuk): tinggi 240 px cukup untuk layar retina
h = 240
w = round(src.width * h / src.height)
src.resize((w, h), Image.LANCZOS).save(root + "/public/logo.png", optimize=True)

square(192).save(root + "/public/icon-192.png", optimize=True)
square(512).save(root + "/public/icon-512.png", optimize=True)
# iOS mengubah transparan jadi hitam, jadi ikon layar utama memakai latar putih
square(180, bg=(255, 255, 255, 255)).convert("RGB").save(root + "/public/apple-touch-icon.png", optimize=True)

import os
for f in ["logo.png", "icon-192.png", "icon-512.png", "apple-touch-icon.png"]:
    print(f, os.path.getsize(root + "/public/" + f), "byte")
