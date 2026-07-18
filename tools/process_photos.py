#!/usr/bin/env python3
"""Process raw photos into the quiz app: orient, resize, strip metadata, assign."""
import json, os, re, shutil
from PIL import Image, ImageOps

RAW = os.path.expanduser("~/Desktop/quiz-raw-photos")
OUT = "/Users/elik.k/git/anniversary-quiz/assets/photos"
CATALOG = "/private/tmp/claude-593428027/-Users-elik-k-git-anniversary-quiz/9bed49eb-45d4-48e2-a455-4cc337e473a4/scratchpad/catalog.json"
MAX_DIM = 1600
QUALITY = 80

# folder -> ordered list of source paths (relative to RAW)
ASSIGN = {
    "q01": ["army/arrmy1.jpg", "army/army3.jpg", "army/army2.jpg"],
    "q02": ["army/army2.jpg", "army/army3.jpg"],
    "q03": ["general/general3.jpg", "general/general.jpg", "general/general2.jpg"],
    "q04": ["china - q 4-5-6/P6140114.JPG", "china - q 4-5-6/P5170142.JPG",
            "china - q 4-5-6/P5170151.JPG", "china - q 4-5-6/P5200247.JPG",
            "china - q 4-5-6/P6050049.JPG", "china - q 4-5-6/P5240150.JPG",
            "china - q 4-5-6/P5300178.JPG", "china - q 4-5-6/P6160255.JPG"],
    "q05": ["china - q 4-5-6/P6050155.JPG", "china - q 4-5-6/P5300102.JPG",
            "china - q 4-5-6/P5300088.JPG", "china - q 4-5-6/P5300140.JPG",
            "china - q 4-5-6/P5310204.JPG", "china - q 4-5-6/P6050076.JPG",
            "china - q 4-5-6/P5270019.JPG", "china - q 4-5-6/P5210070.JPG",
            "china - q 4-5-6/P5210066.JPG"],
    "q06": ["china - q 4-5-6/P6080524.JPG", "china - q 4-5-6/P6080489.JPG",
            "china - q 4-5-6/P6080518.JPG", "china - q 4-5-6/P6090601.JPG",
            "china - q 4-5-6/P6090606.JPG", "china - q 4-5-6/P6090580.JPG",
            "china - q 4-5-6/P6080561.JPG", "china - q 4-5-6/P6090572.JPG",
            "china - q 4-5-6/P6070359.JPG"],
    "q07": ["germany/germany2.jpg", "germany/germany3.jpg",
            "germany/germany1.jpg", "germany/germany4.jpg"],
    "q08": ["general/general5.jpg", "general/general6.jpg", "general/general4.jpg"],
    "q09": ["china - q 4-5-6/P5260252.JPG", "china - q 4-5-6/P5260253.JPG",
            "china - q 4-5-6/P5280056.JPG", "china - q 4-5-6/P5280043.JPG",
            "general/general7.jpg"],
    "q10": ["stock/Larnaca.jpg", "stock/Church_of_Saint_Lazarus,_Larnaca.jpg"],
    "q11": ["laputz the dog/laputz5.jpg", "laputz the dog/laputz3.jpg",
            "laputz the dog/laputz.jpg", "laputz the dog/laputz copy.jpg",
            "yonatan/yonatan2.jpg", "yonatan/IMG_9014.jpeg"],
    "q12": ["stock/Venice.jpg", "stock/Colosseum.jpg",
            "stock/Amalfi_Coast.jpg", "stock/Cinque_Terre.jpg"],
    "q13": ["yonatan/yonatan1 copy.jpg", "yonatan/yonatan7.jpg",
            "yonatan/yonatan2 copy.jpg", "yonatan/IMG_5043.jpeg",
            "yonatan/yonatan1.jpg", "yonatan/yonatan3.jpg",
            "yonatan/yonatan5.jpg", "yonatan/yonatan6.jpg",
            "yonatan/yonatan8.jpg"],
    "intro": ["general/general3.jpg", "yonatan/yonatan3.jpg", "general/general8.jpg",
              "yonatan/yonatan1.jpg", "general/general4.jpg", "yonatan/yonatan2.jpg",
              "general/general.jpg", "yonatan/yonatan6.jpg", "general/general2.jpg"],
    "finale": ["general/general6.jpg", "general/general8.jpg",
               "yonatan/yonatan1 copy.jpg", "yonatan/yonatan7.jpg",
               "yonatan/IMG_9014.jpeg", "yonatan/yonatan2 copy.jpg",
               "yonatan/IMG_5043.jpeg", "yonatan/yonatan2.jpg",
               "yonatan/yonatan4.jpg", "yonatan/yonatan5.jpg",
               "yonatan/yonatan8.jpg", "yonatan/yonatan6.jpg",
               "yonatan/yonatan3.jpg"],
}

catalog = {p["file"]: p for p in json.load(open(CATALOG))}

def focus_to_pos(hint):
    """Map a free-text focus hint to a CSS-ish object position."""
    h = (hint or "").lower()
    x = "50%"
    y = "42%"  # faces are usually above center
    if "left" in h: x = "35%"
    if "right" in h: x = "65%"
    if "top" in h or "upper" in h: y = "30%"
    if "bottom" in h or "lower" in h: y = "65%"
    if "wide" in h or "scenery" in h or "group" in h: x, y = "50%", "45%"
    return f"{x} {y}"

manifest = {}
total_bytes = 0
if os.path.exists(OUT):
    shutil.rmtree(OUT)
for folder, sources in ASSIGN.items():
    os.makedirs(os.path.join(OUT, folder), exist_ok=True)
    entries = []
    for i, rel in enumerate(sources, 1):
        src = os.path.join(RAW, rel)
        img = Image.open(src)
        img = ImageOps.exif_transpose(img)  # bake rotation into pixels
        img = img.convert("RGB")
        img.thumbnail((MAX_DIM, MAX_DIM), Image.LANCZOS)
        name = f"{i:02d}.jpg"
        dst = os.path.join(OUT, folder, name)
        img.save(dst, "JPEG", quality=QUALITY, optimize=True, progressive=True)
        # saving via PIL without exif= drops all metadata (EXIF/GPS)
        sz = os.path.getsize(dst)
        total_bytes += sz
        meta = catalog.get(src.replace("/private", ""), catalog.get(src, {}))
        w, h = img.size
        entries.append({
            "src": f"assets/photos/{folder}/{name}",
            "w": w, "h": h,
            "pos": focus_to_pos(meta.get("focus_hint", "")),
        })
        print(f"{folder}/{name} <- {rel} ({w}x{h}, {sz//1024}KB)")
    manifest[folder] = entries

with open("/Users/elik.k/git/anniversary-quiz/js/data/manifest.js", "w") as f:
    f.write("// Generated by process_photos.py — photo manifest per question\n")
    f.write("window.PHOTOS = ")
    json.dump(manifest, f, indent=1)
    f.write(";\n")

print(f"\nTOTAL: {total_bytes/1024/1024:.1f} MB across {sum(len(v) for v in ASSIGN.values())} photos")
