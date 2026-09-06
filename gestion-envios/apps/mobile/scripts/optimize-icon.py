from pathlib import Path

from PIL import Image


PROJECT = Path(__file__).resolve().parents[1]
SOURCE = Path("/home/ubuntu/webdev-static-assets/movii-icon.png")
DESTINATIONS = {
    "icon.png": 1024,
    "splash-icon.png": 512,
    "favicon.png": 256,
    "android-icon-foreground.png": 512,
}


def build_variant(name: str, side: int) -> None:
    with Image.open(SOURCE) as original:
        image = original.convert("RGBA")
        image.thumbnail((side, side), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        offset = ((side - image.width) // 2, (side - image.height) // 2)
        canvas.alpha_composite(image, offset)
        optimized = canvas.quantize(colors=128, method=Image.Quantize.FASTOCTREE)
        destination = PROJECT / "assets" / "images" / name
        optimized.save(destination, format="PNG", optimize=True)


for filename, dimension in DESTINATIONS.items():
    build_variant(filename, dimension)
