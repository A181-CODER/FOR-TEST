from html.parser import HTMLParser
from pathlib import Path


class HTMLCheck(HTMLParser):
    def __init__(self):
        super().__init__()
        self.errors = []

    def error(self, message):
        self.errors.append(message)


for filename in ("index.html", "admin.html", "monitor.html"):
    parser = HTMLCheck()
    parser.feed(Path(filename).read_text(encoding="utf-8"))
    parser.close()
    if parser.errors:
        raise SystemExit(f"{filename}: {parser.errors}")
    print(f"{filename}: HTML parse OK")
