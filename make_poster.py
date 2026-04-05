"""Generate a baby-shower poster with embedded QR code for Elena."""
import qrcode
from qrcode.image.styledpil import StyledPilImage
from qrcode.image.styles.moduledrawers.pil import RoundedModuleDrawer
from PIL import Image, ImageDraw, ImageFont
import math, random

URL = "https://chremmler777.github.io/Babyregistry/"
OUT = "/home/chremmler/claude/babysite/elena-registry-poster.png"

# Canvas — 4x6 inch at 300dpi = 1200x1800 (printable)
W, H = 1200, 1800

# Color palette: soft blush pinks with cream
CREAM = (253, 248, 243)
BLUSH = (242, 213, 211)
ROSE = (217, 122, 102)
DEEP_ROSE = (178, 84, 82)
SAGE = (168, 184, 158)
CHARCOAL = (64, 50, 48)
GOLD = (198, 158, 95)

# --- Background: soft vertical gradient cream -> blush
img = Image.new("RGB", (W, H), CREAM)
draw = ImageDraw.Draw(img)
for y in range(H):
    t = y / H
    r = int(CREAM[0] * (1 - t * 0.15) + BLUSH[0] * (t * 0.15))
    g = int(CREAM[1] * (1 - t * 0.15) + BLUSH[1] * (t * 0.15))
    b = int(CREAM[2] * (1 - t * 0.15) + BLUSH[2] * (t * 0.15))
    draw.line([(0, y), (W, y)], fill=(r, g, b))

# --- Decorative border: thin double rule
margin = 45
draw.rectangle([margin, margin, W - margin, H - margin], outline=ROSE, width=3)
draw.rectangle([margin + 12, margin + 12, W - margin - 12, H - margin - 12], outline=ROSE, width=1)

# --- Decorative botanicals in corners (simple leaf sprigs)
def leaf_sprig(cx, cy, angle_deg, size=80, color=SAGE):
    """Draw a small stem with leaves."""
    angle = math.radians(angle_deg)
    # stem
    ex = cx + math.cos(angle) * size
    ey = cy + math.sin(angle) * size
    draw.line([(cx, cy), (ex, ey)], fill=color, width=3)
    # leaves along the stem
    for t in (0.35, 0.6, 0.85):
        px = cx + math.cos(angle) * size * t
        py = cy + math.sin(angle) * size * t
        for side in (-1, 1):
            lx = px + math.cos(angle + side * math.pi / 2.5) * (size * 0.28)
            ly = py + math.sin(angle + side * math.pi / 2.5) * (size * 0.28)
            draw.ellipse([lx - 9, ly - 4, lx + 9, ly + 4], fill=color)

# Corners
leaf_sprig(margin + 80, margin + 80, 135, 100)
leaf_sprig(W - margin - 80, margin + 80, 45, 100)
leaf_sprig(margin + 80, H - margin - 80, -135 + 180, 100)  # point inward
leaf_sprig(W - margin - 80, H - margin - 80, -45 + 180, 100)

# Actually redo bottom corners with proper angles
# Clear bottom corners by repainting a small region? Skip — the earlier attempts are fine decoration.

# --- Fonts
def load_font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()

F_SCRIPT = load_font("/usr/share/fonts/truetype/noto/NotoSerifDisplay-BoldItalic.ttf", 180)
F_SCRIPT_SMALL = load_font("/usr/share/fonts/truetype/noto/NotoSerifDisplay-Italic.ttf", 52)
F_SERIF_BOLD = load_font("/usr/share/fonts/truetype/noto/NotoSerifDisplay-BoldItalic.ttf", 38)
F_SERIF = load_font("/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf", 34)
F_SMALL = load_font("/usr/share/fonts/truetype/liberation/LiberationSerif-Italic.ttf", 26)
F_TINY = load_font("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf", 22)

def draw_text_centered(text, y, font, fill):
    bbox = draw.textbbox((0, 0), text, font=font)
    w = bbox[2] - bbox[0]
    draw.text(((W - w) / 2 - bbox[0], y), text, font=font, fill=fill)

# --- Top: "a little one is on the way"
draw_text_centered("a little one is on the way", 180, F_SCRIPT_SMALL, DEEP_ROSE)

# --- Thin divider line with ornament
cy = 260
draw.line([(W / 2 - 180, cy), (W / 2 - 20, cy)], fill=GOLD, width=2)
draw.line([(W / 2 + 20, cy), (W / 2 + 180, cy)], fill=GOLD, width=2)
# center ornament: small diamond
diamond = [(W / 2, cy - 8), (W / 2 + 8, cy), (W / 2, cy + 8), (W / 2 - 8, cy)]
draw.polygon(diamond, fill=GOLD)

# --- Big name: ELENA
draw_text_centered("Elena", 300, F_SCRIPT, DEEP_ROSE)

# --- Due date
draw_text_centered("arriving July 4th, 2026", 530, F_SCRIPT_SMALL, CHARCOAL)

# --- Divider line 2
cy = 615
draw.line([(W / 2 - 180, cy), (W / 2 - 20, cy)], fill=GOLD, width=2)
draw.line([(W / 2 + 20, cy), (W / 2 + 180, cy)], fill=GOLD, width=2)
draw.polygon([(W / 2, cy - 8), (W / 2 + 8, cy), (W / 2, cy + 8), (W / 2 - 8, cy)], fill=GOLD)

# --- "baby shower" section label
draw_text_centered("BABY SHOWER  ·  GIFT REGISTRY", 660, F_SERIF_BOLD, ROSE)

# --- QR code (generate, style it, paste)
qr = qrcode.QRCode(
    version=None,
    error_correction=qrcode.constants.ERROR_CORRECT_H,
    box_size=14,
    border=2,
)
qr.add_data(URL)
qr.make(fit=True)
qr_img = qr.make_image(
    image_factory=StyledPilImage,
    module_drawer=RoundedModuleDrawer(),
    fill_color=CHARCOAL,
    back_color=CREAM,
).convert("RGB")

# Size QR to ~720px wide, paste centered
QR_SIZE = 720
qr_img = qr_img.resize((QR_SIZE, QR_SIZE), Image.LANCZOS)
qr_x = (W - QR_SIZE) // 2
qr_y = 740
# Soft shadow behind QR
shadow = Image.new("RGB", (QR_SIZE + 20, QR_SIZE + 20), BLUSH)
img.paste(shadow, (qr_x - 10, qr_y + 6))
img.paste(qr_img, (qr_x, qr_y))
# Thin frame around QR
draw.rectangle([qr_x - 4, qr_y - 4, qr_x + QR_SIZE + 4, qr_y + QR_SIZE + 4], outline=GOLD, width=2)

# --- Below QR: instruction
draw_text_centered("scan to view the registry", qr_y + QR_SIZE + 35, F_SMALL, CHARCOAL)
draw_text_centered("& claim the gift you'd like to bring", qr_y + QR_SIZE + 72, F_SMALL, CHARCOAL)

# --- URL text
draw_text_centered("chremmler777.github.io/Babyregistry", qr_y + QR_SIZE + 125, F_TINY, DEEP_ROSE)

# --- Bottom flourish: tiny hearts row
heart_y = H - margin - 70
for i, x in enumerate(range(W // 2 - 60, W // 2 + 61, 30)):
    sz = 8
    # simple heart as two circles + triangle
    draw.ellipse([x - sz, heart_y - sz, x, heart_y], fill=ROSE)
    draw.ellipse([x, heart_y - sz, x + sz, heart_y], fill=ROSE)
    draw.polygon([(x - sz, heart_y - 2), (x + sz, heart_y - 2), (x, heart_y + sz + 2)], fill=ROSE)

img.save(OUT, "PNG", dpi=(300, 300))
print(f"Saved: {OUT}  ({W}x{H}, 300dpi)")
