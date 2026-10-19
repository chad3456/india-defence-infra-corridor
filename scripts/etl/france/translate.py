#!/usr/bin/env python3
"""
Machine translation of the France riots register into English.

    python3 scripts/etl/france/translate.py             # translate what is new
    python3 scripts/etl/france/translate.py --prefetch  # download every model first
    python3 scripts/etl/france/translate.py --fake      # plumbing check, no models

Runs after `npm run france:riots`, in CI only: the models come from
argos-net.com, which the editing sandbox cannot reach.

What it does. Every headline, video title, article title, quoted sentence and
picture caption in data/france-riots/register.json that is not in English gets
an `en` field holding a machine translation. The original is never changed or
removed; the page shows both and says the English is a machine's.

The engine is Argos Translate's open models (OpenNMT, trained on OPUS), run
offline with CTranslate2 and SentencePiece directly rather than through the
argostranslate package, which would pull in PyTorch for sentence splitting.
Nothing is sent to a translation service.

A translation is made once. Text already translated keeps its English; a
language whose model cannot be fetched or loaded is reported in the register's
`translation.failed` and its items stay untranslated rather than guessed.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import pathlib
import re
import shutil
import sys
import tempfile
import urllib.request
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[3]
REG = ROOT / "data" / "france-riots" / "register.json"
MODELS = pathlib.Path(os.environ.get("ARGOS_MODELS", ROOT / ".cache" / "argos"))
INDEX = "https://raw.githubusercontent.com/argosopentech/argospm-index/main/index.json"
ENGINE = "Argos Translate (open OpenNMT models, run offline with CTranslate2)"
# Enough for a first run over the whole register; later runs only see what is new.
MAX_NEW = int(os.environ.get("TRANSLATE_MAX", "4000"))
# The languages fetched ahead of time when the model cache is empty: those the job asks Google News in, and
# those GDELT most often returns for this story.
PREFETCH = ["fr", "de", "es", "it", "nl", "pt", "pl", "sv", "da", "nb", "fi", "sq"]
# GDELT names languages in English; Argos codes them ISO 639-1 ("nb" for Norwegian Bokmål).
GDELT = {"french": "fr", "english": "en", "german": "de", "spanish": "es", "italian": "it", "dutch": "nl", "portuguese": "pt",
         "polish": "pl", "swedish": "sv", "danish": "da", "norwegian": "nb", "finnish": "fi", "albanian": "sq", "romanian": "ro",
         "czech": "cs", "greek": "el", "turkish": "tr", "arabic": "ar", "russian": "ru", "ukrainian": "uk", "hungarian": "hu"}
FRENCH_WORDS = re.compile(r"\b(?:les|des|une|été|dans|avec|pour|qui|sont|ont|selon|lors|après|été|depuis|leurs?)\b", re.I)
QUOTES = str.maketrans({"’": "'", "‘": "'", "“": '"', "”": '"', "«": '"', "»": '"'})
SENTENCE = re.compile(r"(?<=[.!?…»”])\s+(?=[A-ZÀ-ÖØ-Þ«“\"])")


def log(*a: object) -> None:
    print(*a, flush=True)


def code_of(lang: str | None, text: str) -> str:
    """The item's language as an Argos code. Items stored before languages were recorded are guessed French or English."""
    if lang:
        lang = lang.strip().lower()
        if lang in GDELT:
            return GDELT[lang]
        if lang == "no":
            return "nb"
        if lang not in ("und", ""):
            return lang
    return "fr" if len(FRENCH_WORDS.findall(text)) >= 2 else "en"


def jobs(reg: dict):
    """Every (language, text, item) the page shows, most useful first: headlines, then quotes, then titles and captions."""
    for h in reg.get("headlines", []):
        yield code_of(h.get("lang"), h["title"]), h["title"], h
    for key in ("damage", "statements", "claims", "businesses"):
        for q in reg.get(key, []):
            yield code_of(q.get("lang"), q["quote"]), q["quote"], q
    for v in reg.get("videos", []):
        yield code_of(v.get("lang") or "en", v["title"]), v["title"], v
    for a in reg.get("articles", []):
        yield code_of(a.get("language"), a["title"]), a["title"], a
    for m in reg.get("media", []):
        yield code_of(m.get("lang"), m["title"]), m["title"], m


# ── Models ────────────────────────────────────────────────────────────────

_index: list | None = None


def index() -> list:
    global _index
    if _index is None:
        with urllib.request.urlopen(INDEX, timeout=60) as r:
            _index = json.load(r)
    return _index


def model_dir(lang: str) -> pathlib.Path | None:
    """The unpacked Argos package for lang→en, downloading it once. None if there is no such package."""
    home = MODELS / f"{lang}_en"
    if (home / "ok.json").exists():
        return home
    pkg = next((p for p in index() if p.get("from_code") == lang and p.get("to_code") == "en"), None)
    links = [l for l in (pkg or {}).get("links", []) if l.startswith("https://")]
    if not links:
        return None
    tmp = pathlib.Path(tempfile.mkdtemp(prefix=f"argos-{lang}-"))
    try:
        archive = tmp / "pkg.zip"
        log(f"  downloading {lang}→en model {pkg.get('package_version')} …")
        req = urllib.request.Request(links[0], headers={"user-agent": "bharat-tracker translate.py"})
        with urllib.request.urlopen(req, timeout=600) as r, open(archive, "wb") as f:
            shutil.copyfileobj(r, f)
        if home.exists():
            shutil.rmtree(home)
        home.mkdir(parents=True)
        with zipfile.ZipFile(archive) as z:
            # extractall refuses absolute paths and "..": the archive cannot write outside `home`.
            z.extractall(home)
        model = next((p.parent for p in home.rglob("model.bin")), None)
        sp = next(iter(home.rglob("sentencepiece.model")), None) or next((p for p in home.rglob("*.model") if "spm" in p.name or "sentencepiece" in p.name), None)
        if not model or not sp:
            files = sorted(str(p.relative_to(home)) for p in home.rglob("*") if p.is_file())[:40]
            shutil.rmtree(home, ignore_errors=True)
            raise RuntimeError(f"package has no model.bin or sentencepiece.model; it holds {files}")
        (home / "ok.json").write_text(json.dumps({"model": str(model.relative_to(home)), "sp": str(sp.relative_to(home)), "version": pkg.get("package_version")}))
        return home
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


class Translator:
    def __init__(self, lang: str):
        import ctranslate2
        import sentencepiece

        home = model_dir(lang)
        if home is None:
            raise RuntimeError(f"no Argos package for {lang}→en")
        meta = json.loads((home / "ok.json").read_text())
        self.version = meta.get("version")
        self.tr = ctranslate2.Translator(str(home / meta["model"]), device="cpu", intra_threads=max(1, os.cpu_count() or 1))
        self.sp = sentencepiece.SentencePieceProcessor(model_file=str(home / meta["sp"]))

    def __call__(self, texts: list[str]) -> list[str]:
        pieces: list[tuple[int, list[str]]] = []
        for i, t in enumerate(texts):
            # Curly quotes are straightened first: some models drop whatever follows one.
            plain = t.strip().translate(QUOTES)
            for s in SENTENCE.split(plain) or [plain]:
                if s.strip():
                    pieces.append((i, self.sp.encode(s.strip(), out_type=str)))
        out: list[list[str]] = [[] for _ in texts]
        for start in range(0, len(pieces), 32):
            chunk = pieces[start:start + 32]
            res = self.tr.translate_batch([p for _, p in chunk], beam_size=2, max_decoding_length=256)
            for (i, _), r in zip(chunk, res):
                # Joined as pieces, the way Argos does: decoding through the source model leaves
                # target-only pieces with their "▁" word marks showing.
                out[i].append("".join(r.hypotheses[0]).replace("▁", " ").strip())
        return [re.sub(r"\s+([,.;:!?])", r"\1", re.sub(r"\s+", " ", " ".join(x))).strip() for x in out]


class Fake:
    version = "fake"

    def __call__(self, texts: list[str]) -> list[str]:
        return [f"[en] {t}" for t in texts]


# ── Run ───────────────────────────────────────────────────────────────────

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--prefetch", action="store_true", help="download every model in PREFETCH, then stop")
    ap.add_argument("--fake", action="store_true", help="mark translations without a model, and write nothing")
    args = ap.parse_args()

    if args.prefetch:
        for lang in PREFETCH:
            try:
                log(f"{lang}: {'ready' if model_dir(lang) else 'no package'}")
            except Exception as e:  # a failed download is retried on the next run
                log(f"{lang}: FAILED {e}")
        return 0

    reg = json.loads(REG.read_text("utf-8"))
    # What is already known, by language and text: the same headline often reappears as an article title.
    known: dict[tuple[str, str], str] = {}
    for lang, text, item in jobs(reg):
        # A translation still carrying "▁" word marks was decoded wrongly and is made again.
        if lang != "en" and isinstance(item.get("en"), str) and item["en"].strip() and "▁" not in item["en"]:
            known[(lang, text)] = item["en"]

    pending: dict[str, list[str]] = {}
    for lang, text, item in jobs(reg):
        if lang == "en":
            item.pop("en", None)
            continue
        if (lang, text) in known:
            item["en"] = known[(lang, text)]
        else:
            item.pop("en", None)
        if (lang, text) not in known and text not in pending.setdefault(lang, []):
            pending[lang].append(text)

    budget, made, failed = MAX_NEW, 0, []
    for lang, texts in sorted(pending.items(), key=lambda kv: -len(kv[1])):
        texts = texts[:budget]
        if not texts:
            continue
        try:
            tr = Fake() if args.fake else Translator(lang)
        except Exception as e:
            log(f"  {lang}: cannot translate ({e}); {len(texts)} items left in the original")
            failed.append(lang)
            continue
        for start in range(0, len(texts), 64):
            batch = texts[start:start + 64]
            for t, en in zip(batch, tr(batch)):
                if en:
                    known[(lang, t)] = en
                    made += 1
        budget -= len(texts)
        log(f"  {lang}: {len(texts)} translated (model {tr.version})")

    by_lang: dict[str, int] = {}
    left = 0
    for lang, text, item in jobs(reg):
        if lang == "en":
            continue
        if (lang, text) in known:
            item["en"] = known[(lang, text)]
            by_lang[lang] = by_lang.get(lang, 0) + 1
        else:
            left += 1

    before = reg.get("translation") or {}
    meta = {"engine": ENGINE, "at": before.get("at"), "translated": sum(by_lang.values()), "pending": left, "byLang": dict(sorted(by_lang.items())), **({"failed": failed} if failed else {})}
    if made or not meta["at"]:
        meta["at"] = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    reg["translation"] = meta
    log(f"translated {made} new; {meta['translated']} items carry English, {left} still pending; by language {meta['byLang']}")
    if args.fake:
        log("--fake: nothing written")
        return 0
    REG.write_text(json.dumps(reg, ensure_ascii=False, separators=(",", ":")) + "\n", "utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
