"""Package a static site. No Python or computation server is needed at runtime."""
from pathlib import Path
import shutil
import json
import zipfile

root = Path(__file__).resolve().parents[1]
out = root / "dist"
if out.exists():
    shutil.rmtree(out)
shutil.copytree(root / "web", out)
with zipfile.ZipFile(out / "source.zip", "w", zipfile.ZIP_DEFLATED) as archive:
    for folder in ["vendor", "native", "scripts", "web", "tests", ".github"]:
        for file in (root / folder).rglob("*"):
            if file.is_file() and "wasm" not in file.parts and "__pycache__" not in file.parts and not (folder == "web" and "data" in file.relative_to(root / "web").parts):
                archive.write(file, "Knotscape/" + str(file.relative_to(root)))
    for name in ["README.md", "LICENSE", "THIRD_PARTY.md", "package.json", "package-lock.json"]:
        if (root / name).exists():
            archive.write(root / name, "Knotscape/" + name)
for folder in [root / "web", out]:
    files = ["./", "./index.html"] + ["./"+str(p.relative_to(folder)) for p in folder.rglob("*") if p.is_file() and p.name not in ["offline-files.json", "index.html"]]
    (folder / "offline-files.json").write_text(json.dumps(files))
print(f"Static app ready: {out}")
