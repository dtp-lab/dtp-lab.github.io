"""Convert the legacy DTPLab Google Site export into local JSON and WebP assets.

Usage:
    python tools/migrate_google_sites.py <downloaded-html-dir> <site-dir>

The input directory must contain home.html, people.html, projects.html,
publications.html, seminars.html, and gallery.html.
"""

from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256
from io import BytesIO
import json
from pathlib import Path
import re
import sys
from typing import Any
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

from lxml import html
from PIL import Image, ImageOps


SOURCE_URL = "https://sites.google.com/view/dtnlab"
PAGE_NAMES = ("home", "people", "projects", "publications", "seminars", "gallery")


def clean(value: str) -> str:
    return " ".join(value.replace("\u200b", "").split())


@dataclass
class Event:
    kind: str
    text: str = ""
    url: str = ""
    nested: list[str] | None = None


def page_events(path: Path) -> list[Event]:
    document = html.parse(str(path))
    roots = document.xpath("//*[contains(concat(' ', normalize-space(@class), ' '), ' UtePc ')]")
    root = roots[0] if roots else document.getroot()
    events: list[Event] = []

    for element in root.iter():
        style = element.get("style") or ""
        for url in re.findall(r"url\(['\"]?([^)'\"]+)", style):
            if "sitesv-images" in url:
                events.append(Event("image", url=url))

        if element.tag == "img":
            url = element.get("src") or element.get("data-src")
            if url and "sitesv-images" in url:
                events.append(Event("image", url=url))
            continue

        if element.tag not in {"h1", "h2", "h3", "h4", "p", "li"}:
            continue
        if any(parent.tag in {"p", "li"} for parent in element.iterancestors() if parent is not root):
            continue
        value = clean(element.text_content())
        if not value:
            continue
        nested = [clean(item.text_content()) for item in element.xpath(".//li")]
        events.append(Event(element.tag, text=value, nested=nested or None))
    return events


class AssetStore:
    def __init__(self, site_dir: Path) -> None:
        self.site_dir = site_dir
        self.cache: dict[str, str] = {}
        self.failures: list[dict[str, str]] = []
        self.blocked_reason = ""

    def save(self, url: str, page: str) -> str:
        if url in self.cache:
            return self.cache[url]

        digest = sha256(url.encode("utf-8")).hexdigest()[:12]
        relative = Path("assets") / "legacy" / page / f"{digest}.webp"
        target = self.site_dir / relative
        target.parent.mkdir(parents=True, exist_ok=True)

        if self.blocked_reason:
            self.failures.append({"page": page, "url": url, "error": self.blocked_reason})
            self.cache[url] = url
            return url

        request = Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
                "Referer": f"{SOURCE_URL}/",
                "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
            },
        )
        try:
            with urlopen(request, timeout=45) as response:
                payload = response.read()

            with Image.open(BytesIO(payload)) as source:
                image = ImageOps.exif_transpose(source)
                if getattr(image, "is_animated", False):
                    image.seek(0)
                if image.mode not in {"RGB", "RGBA"}:
                    image = image.convert("RGBA" if "transparency" in image.info else "RGB")
                image.thumbnail((1800, 1800), Image.Resampling.LANCZOS)
                image.save(target, "WEBP", quality=84, method=6)
        except (HTTPError, URLError, OSError) as error:
            if isinstance(error, HTTPError) and error.code == 403:
                self.blocked_reason = "Google Sites image proxy returned HTTP 403 from this network"
            self.failures.append({"page": page, "url": url, "error": str(error)})
            self.cache[url] = url
            print(f"remote {page}: {error}")
            return url

        result = relative.as_posix()
        self.cache[url] = result
        print(f"asset {result}")
        return result


def parse_home(events: list[Event]) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    news: list[dict[str, str]] = []
    research: list[dict[str, str]] = []
    in_research = False
    in_news = False

    for event in events:
        if event.text == "핵심 연구주제":
            in_research = True
            continue
        if event.text == "News":
            in_research = False
            in_news = True
            continue
        if in_research and event.kind == "li" and ":" in event.text:
            title, description = event.text.split(":", 1)
            research.append({"title": title.strip(), "description": description.strip()})
        if in_news and event.kind == "li":
            match = re.match(r"^(\d{4}\.\d{2})\s*(.*)$", event.text)
            if not match:
                continue
            text = match.group(2).strip()
            category = "member"
            if "🚀" in text:
                category = "project"
            elif "🏅" in text:
                category = "award"
            elif "🎇" in text:
                category = "publication"
            text = text.replace("🚀", "").replace("🏅", "").replace("🎇", "").strip()
            news.append({"date": match.group(1), "category": category, "text": text})
    return news, research


def parse_people(events: list[Event], assets: AssetStore) -> dict[str, Any]:
    headings = {
        "Professor": "professor",
        "Ph.D. Students": "phd",
        "MS Students": "ms",
        "Undergraduate Students": "undergrad",
        "Alumni": "alumni",
    }
    groups: dict[str, list[dict[str, Any]]] = {value: [] for value in headings.values()}
    group = ""
    current: dict[str, Any] | None = None

    def finish() -> None:
        nonlocal current
        if not current:
            return
        lines = current.pop("lines")
        current["name"] = lines[0] if lines else ""
        fields: dict[str, str] = {}
        for line in lines[1:]:
            if ":" in line:
                key, value = line.split(":", 1)
                normalized_key = key.strip().lower().replace(" ", "_")
                if normalized_key != "interests":
                    fields[normalized_key] = value.strip()
        current["fields"] = fields
        current_group = current.pop("_group")
        groups[current_group].append(current)
        current = None

    for event in events:
        if event.kind == "p" and event.text in headings:
            finish()
            group = headings[event.text]
        elif event.kind == "image" and group:
            finish()
            current = {"_group": group, "image": assets.save(event.url, "people"), "lines": []}
        elif event.kind == "p" and current is not None:
            current["lines"].append(event.text)
    finish()
    return {"groups": groups}


def parse_projects(events: list[Event], assets: AssetStore) -> dict[str, Any]:
    collections: dict[str, list[dict[str, Any]]] = {"current": [], "completed": []}
    section = ""
    current: dict[str, Any] | None = None

    def finish() -> None:
        nonlocal current
        if current and current.get("title"):
            collections[current["status"]].append(current)
        current = None

    for event in events:
        if event.kind == "p" and event.text == "Current Research Projects":
            finish()
            section = "current"
            continue
        if event.kind == "p" and event.text == "Completed Research Projects":
            finish()
            section = "completed"
            continue
        if not section or event.kind == "h1":
            continue
        if event.kind == "p":
            finish()
            current = {"status": section, "title": event.text, "meta": "", "description": "", "details": [], "images": []}
        elif event.kind == "li" and current is not None:
            if not current["meta"]:
                current["meta"] = event.text
            elif event.text.startswith("상세 연구내용"):
                current["details"] = event.nested or [event.text.removeprefix("상세 연구내용").strip()]
            elif not current["description"]:
                current["description"] = event.text
            else:
                current["details"].append(event.text)
        elif event.kind == "image" and current is not None:
            image = assets.save(event.url, "projects")
            if image not in current["images"]:
                current["images"].append(image)
    finish()
    return collections


def parse_publications(events: list[Event]) -> dict[str, Any]:
    result: dict[str, list[dict[str, str]]] = {"articles": [], "conferences": [], "patents": []}
    section = ""
    year = ""
    for event in events:
        if event.kind == "p" and event.text == "Peer-Reviewed Articles":
            section = "articles"
        elif event.kind == "p" and event.text == "Conference Papers (International/Domestic)":
            section = "conferences"
        elif event.kind == "p" and event.text == "Patents":
            section = "patents"
            year = ""
        elif event.kind == "p" and re.fullmatch(r"~?\d{4}", event.text):
            year = event.text.replace("~", "≤")
        elif event.kind == "li" and section and not event.text.startswith("Notation"):
            item = {"year": year, "citation": event.text}
            result[section].append(item)
    return result


def parse_seminars(events: list[Event]) -> dict[str, Any]:
    seminars: list[dict[str, str]] = []
    current: dict[str, str] | None = None
    pattern = re.compile(r'^\[(\d{4}\.\d{2}\.\d{2})\]\s+"(.*)"\s+by\s+(.+)$')
    for event in events:
        if event.kind == "p":
            match = pattern.match(event.text)
            if match:
                current = {
                    "date": match.group(1),
                    "title": match.group(2).strip(),
                    "speaker": match.group(3).strip(),
                    "summary": "",
                }
                seminars.append(current)
        elif event.kind == "li" and current is not None:
            current["summary"] = event.text.removeprefix("요약:").strip()
    return {"seminars": seminars}


def parse_gallery(events: list[Event], assets: AssetStore) -> dict[str, Any]:
    gallery: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    for event in events:
        if event.kind == "h1":
            if event.text.casefold() == "gallery":
                continue
            current = {"title": event.text, "description": "", "images": []}
            gallery.append(current)
        elif event.kind == "p" and current is not None:
            current["description"] = event.text
        elif event.kind == "image" and current is not None:
            image = assets.save(event.url, "gallery")
            if image not in current["images"]:
                current["images"].append(image)
    return {"events": gallery}


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"data  {path}")


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: migrate_google_sites.py <html-dir> <site-dir>")
    html_dir = Path(sys.argv[1]).resolve()
    site_dir = Path(sys.argv[2]).resolve()
    for name in PAGE_NAMES:
        if not (html_dir / f"{name}.html").is_file():
            raise SystemExit(f"missing input: {name}.html")

    events = {name: page_events(html_dir / f"{name}.html") for name in PAGE_NAMES}
    assets = AssetStore(site_dir)
    news, research = parse_home(events["home"])
    research_images = []
    for event in events["home"]:
        if event.kind == "image":
            image = assets.save(event.url, "research")
            if image not in research_images:
                research_images.append(image)

    data_dir = site_dir / "data"
    write_json(data_dir / "news.json", {"news": news})
    write_json(data_dir / "research.json", {"research": research, "images": research_images})
    write_json(data_dir / "people.json", parse_people(events["people"], assets))
    write_json(data_dir / "projects.json", parse_projects(events["projects"], assets))
    write_json(data_dir / "publications.json", parse_publications(events["publications"]))
    write_json(data_dir / "seminars.json", parse_seminars(events["seminars"]))
    write_json(data_dir / "gallery.json", parse_gallery(events["gallery"], assets))
    if assets.failures:
        print(f"warning: {len(assets.failures)} asset downloads failed")


if __name__ == "__main__":
    main()
