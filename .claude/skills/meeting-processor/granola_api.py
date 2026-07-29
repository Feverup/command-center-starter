#!/usr/bin/env python3
"""Granola API helper for the meeting-processor, daily-briefing & task-management skills.

Granola replaces the old Google Drive "Routines" workflow: meetings are read from
Granola, classified by the Granola folder they're filed in, and digests/tasks are
written back into rolling Granola notes.

Auth: WorkOS access token from Granola's local
  ~/Library/Application Support/Granola/supabase.json   (no secrets are printed).
If expired, open the Granola app once to refresh it, then re-run.

Notes (rolling, one panel each, newest-on-top):
  bucket folders -> "📋 {Folder} — Meeting Summaries"  (filed into that folder)
  "active"       -> "✅ Active Tasks"
  "daily"        -> "🗓️ Daily Tasks Log"
The note registry persists in granola_state.json (key -> {doc_id, panel_id}).

Subcommands:
  fetch       --date YYYY-MM-DD          meetings of that day, grouped by folder bucket
  publish     --file payload.json        meeting-processor output (per-bucket summaries + active tasks)
  backfill    --file payload.json        one-time import of historical content into notes (no date header)
  prepend     --note KEY --file md [--header H] [--title T]   prepend markdown to a note (creates it)
  set-note    --note KEY --file md       REPLACE a note's whole content (read-modify-write; for task edits)
  read-note   --note KEY                 print a note's current content as markdown
  transcript  --doc ID                   raw transcript for a meeting
"""
import json, sys, os, gzip, uuid, argparse, datetime, urllib.request, urllib.error

GRANOLA_DIR = os.path.expanduser("~/Library/Application Support/Granola")
SUPABASE = os.path.join(GRANOLA_DIR, "supabase.json")
CACHE = os.path.join(GRANOLA_DIR, "cache-v6.json")
STATE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "granola_state.json")
API = "https://api.granola.ai/v1/"

# Buckets that mirror Granola folders (classification = folder membership).
# Configure your own folders — either set GRANOLA_FOLDERS="Folder A,Folder B"
# in the environment, or replace the default list below. Left empty, no folder
# lookup runs and every meeting for the day lands in "Uncategorized".
FOLDER_BUCKETS = [f.strip() for f in os.environ.get("GRANOLA_FOLDERS", "").split(",") if f.strip()]
# Non-folder notes.
SPECIAL_NOTES = {
    "active":  {"title": "✅ Active Tasks"},
    "daily":   {"title": "🗓️ Daily Tasks Log"},
    "journal": {"title": "🗓️ Task Journal"},
}


# ----------------------------------------------------------------------------- auth + transport
def _token():
    with open(SUPABASE) as f:
        d = json.load(f)
    t = d["workos_tokens"]
    t = json.loads(t) if isinstance(t, str) else t
    try:
        ob, exp = t.get("obtained_at"), t.get("expires_in")
        if ob and exp:
            ts = datetime.datetime.fromisoformat(ob.replace("Z", "+00:00"))
            if datetime.datetime.now(datetime.timezone.utc) > ts + datetime.timedelta(seconds=exp - 120):
                _die("Granola access token looks expired. Open the Granola app once to refresh it, then re-run.")
    except Exception:
        pass
    return t["access_token"]


def call(endpoint, body):
    req = urllib.request.Request(
        API + endpoint, data=json.dumps(body).encode(),
        headers={"Authorization": "Bearer " + _TOKEN, "Content-Type": "application/json",
                 "Accept-Encoding": "gzip", "User-Agent": "Granola/6.0.0"})
    try:
        r = urllib.request.urlopen(req, timeout=60)
        raw = r.read()
        if r.headers.get("Content-Encoding") == "gzip":
            raw = gzip.decompress(raw)
        txt = raw.decode("utf-8", "replace")
        return json.loads(txt) if txt.strip() else {}
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            if e.headers.get("Content-Encoding") == "gzip":
                raw = gzip.decompress(raw)
        except Exception:
            pass
        if e.code == 401:
            _die("Granola API 401 Unauthorized. Open the Granola app once to refresh the token, then re-run.")
        _die("Granola API %s -> HTTP %d: %s" % (endpoint, e.code, raw.decode("utf-8", "replace")))


def _die(msg):
    print(json.dumps({"error": msg}), file=sys.stderr)
    sys.exit(2)


# ----------------------------------------------------------------------------- folders
def folder_ids():
    """{folder_title: list_id}. Live from the API (source of truth); falls back to
    the local cache if the API is unavailable. The cache can lag behind freshly
    created folders, so the API is preferred."""
    try:
        r = call("get-document-lists-metadata", {})
        # Response shape varies: a flat {id: meta}, or {"lists": {id: meta}} / {"lists": [meta]}.
        if isinstance(r, dict) and "lists" in r:
            r = r["lists"]
        items = r.values() if isinstance(r, dict) else r
        out = {}
        for m in items:
            if isinstance(m, dict) and m.get("title") and not m.get("deleted_at"):
                out[m["title"]] = m["id"]
        if out:
            return out
    except SystemExit:
        raise
    except Exception:
        pass
    with open(CACHE) as f:
        c = json.load(f)
    c = json.loads(c["cache"]) if isinstance(c["cache"], str) else c["cache"]
    md = c["state"]["documentListsMetadata"]
    return {m["title"]: lid for lid, m in md.items() if m.get("title") and not m.get("deleted_at")}


# ----------------------------------------------------------------------------- doc helpers
def doc_date(doc):
    ev = doc.get("google_calendar_event") or {}
    start = (ev.get("start") or {}).get("dateTime")
    raw = start or doc.get("created_at") or ""
    return raw[:10] if len(raw) >= 10 else ""


def attendees(doc):
    names, people = [], doc.get("people")
    seq = people.get("attendees", []) if isinstance(people, dict) else (people or [])
    for p in seq:
        if isinstance(p, dict):
            names.append(p.get("name") or p.get("email") or "")
        elif isinstance(p, str):
            names.append(p)
    for a in (doc.get("google_calendar_event") or {}).get("attendees", []) or []:
        nm = a.get("displayName") or a.get("email")
        if nm and nm not in names:
            names.append(nm)
    return [n for n in names if n]


# ----------------------------------------------------------------------------- fetch
def cmd_fetch(target_date):
    fids = folder_ids()
    seen, buckets = {}, {}

    def slim(doc):
        return {"id": doc.get("id"), "title": doc.get("title") or "(untitled)",
                "date": doc_date(doc),
                "time": ((doc.get("google_calendar_event") or {}).get("start") or {}).get("dateTime"),
                "attendees": attendees(doc), "summary": doc.get("summary"),
                "overview": doc.get("overview"), "notes_markdown": doc.get("notes_markdown"),
                "valid_meeting": doc.get("valid_meeting"),
                "has_transcript": doc.get("transcribe") is not False and doc.get("transcript_deleted_at") is None}

    for bucket in FOLDER_BUCKETS:
        buckets[bucket] = []
        lid = fids.get(bucket)
        if not lid:
            continue
        for doc in call("get-document-list", {"list_id": lid}).get("documents", []) or []:
            if not doc.get("deleted_at") and doc_date(doc) == target_date:
                buckets[bucket].append(slim(doc))
                seen[doc.get("id")] = bucket

    res = call("get-documents", {"limit": 200, "offset": 0})
    docs = res if isinstance(res, list) else (res.get("docs") or [])
    buckets["Uncategorized"] = [slim(d) for d in docs
                                if not d.get("deleted_at") and doc_date(d) == target_date and d.get("id") not in seen]

    print(json.dumps({"target_date": target_date, "folder_ids": fids, "buckets": buckets,
                      "total_meetings": sum(len(v) for v in buckets.values())}, indent=2, ensure_ascii=False))


# ----------------------------------------------------------------------------- markdown <-> ProseMirror
def _inline(text):
    nodes, i = [], 0
    while i < len(text):
        j = text.find("**", i)
        if j == -1:
            if text[i:]:
                nodes.append({"type": "text", "text": text[i:]})
            break
        if text[i:j]:
            nodes.append({"type": "text", "text": text[i:j]})
        k = text.find("**", j + 2)
        if k == -1:
            nodes.append({"type": "text", "text": text[j:]}); break
        if text[j + 2:k]:
            nodes.append({"type": "text", "text": text[j + 2:k], "marks": [{"type": "bold"}]})
        i = k + 2
    return nodes or [{"type": "text", "text": text}]


def md_to_pm(md):
    blocks, bullets = [], []

    def flush():
        nonlocal bullets
        if bullets:
            blocks.append({"type": "bulletList", "content": [
                {"type": "listItem", "content": [{"type": "paragraph", "content": b}]} for b in bullets]})
            bullets = []

    for raw in md.splitlines():
        line = raw.rstrip()
        if not line.strip():
            flush(); continue
        h = 0
        while h < len(line) and line[h] == "#":
            h += 1
        if 1 <= h <= 6 and h < len(line) and line[h] == " ":
            flush()
            blocks.append({"type": "heading", "attrs": {"level": min(h, 3)}, "content": _inline(line[h + 1:].strip())})
            continue
        s = line.lstrip()
        if s.startswith("- ") or s.startswith("* "):
            item, box = s[2:], ""
            if item[:4].lower() in ("[ ] ", "[x] "):
                box = "☑ " if item[1].lower() == "x" else "☐ "
                item = item[4:]
            bullets.append(([{"type": "text", "text": box}] if box else []) + _inline(item))
            continue
        flush()
        blocks.append({"type": "paragraph", "content": _inline(line)})
    flush()
    return blocks


def pm_to_md(nodes):
    out = []
    def text_of(n):
        return "".join(("**%s**" % c["text"]) if any(m.get("type") == "bold" for m in c.get("marks", []))
                       else c.get("text", "") for c in n.get("content", []) if c.get("type") == "text")
    for n in nodes:
        tp = n.get("type")
        if tp == "heading":
            out.append("#" * n.get("attrs", {}).get("level", 2) + " " + text_of(n))
        elif tp == "paragraph":
            out.append(text_of(n))
        elif tp == "bulletList":
            for li in n.get("content", []):
                for p in li.get("content", []):
                    out.append("- " + text_of(p))
        else:
            out.append(text_of(n))
    return "\n".join(out)


# ----------------------------------------------------------------------------- note registry
def _load_state():
    if os.path.exists(STATE):
        with open(STATE) as f:
            return json.load(f)
    return {"notes": {}}


def _save_state(st):
    with open(STATE, "w") as f:
        json.dump(st, f, indent=2, ensure_ascii=False)


def _note_meta(key, fids):
    """(title, list_id) for a note key. list_id None => unfiled."""
    if key in SPECIAL_NOTES:
        return SPECIAL_NOTES[key]["title"], None
    title = "\U0001F4CB %s — Meeting Summaries" % key
    return title, fids.get(key)  # Uncategorized / unknown -> None (unfiled)


def _doc_alive(doc_id):
    try:
        call("get-document-metadata", {"document_id": doc_id}); return True
    except SystemExit:
        return False


def _ensure_note(key, fids, st):
    entry = st["notes"].get(key)
    if entry and _doc_alive(entry["doc_id"]):
        return entry["doc_id"], entry["panel_id"]
    title, list_id = _note_meta(key, fids)
    doc_id, panel_id = str(uuid.uuid4()), str(uuid.uuid4())
    call("create-document", {"id": doc_id, "title": title})
    if list_id:
        call("add-document-to-list", {"document_id": doc_id, "document_list_id": list_id})
    call("create-document-panel", {"id": panel_id, "document_id": doc_id, "title": "Summary",
                                   "original_content": "<p></p>",
                                   "content": {"type": "doc", "content": [{"type": "paragraph"}]}})
    st["notes"][key] = {"doc_id": doc_id, "panel_id": panel_id, "title": title}
    return doc_id, panel_id


def _prepend(doc_id, panel_id, new_nodes):
    panels = call("get-document-panels", {"document_id": doc_id})
    panel = next((p for p in panels if p["id"] == panel_id), None)
    existing = (panel or {}).get("content", {}).get("content", []) if panel else []
    existing = [n for n in existing if not (n.get("type") == "paragraph" and not n.get("content"))]
    call("update-document-panel", {"id": panel_id, "document_id": doc_id,
                                   "content": {"type": "doc", "content": new_nodes + existing},
                                   "original_content": ""})


def _prepend_md(key, fids, st, md, header=None):
    doc_id, panel_id = _ensure_note(key, fids, st)
    nodes = md_to_pm(md)
    if header:
        nodes = [{"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": header}]}] + nodes
    _prepend(doc_id, panel_id, nodes)
    _save_state(st)
    return doc_id


# ----------------------------------------------------------------------------- publish (meeting-processor)
def cmd_publish(payload_file):
    payload = json.load(open(payload_file))
    target, fids, st, results = payload["target_date"], folder_ids(), _load_state(), []
    for entry in payload.get("summaries", []):
        md = (entry.get("markdown") or "").strip()
        if md:
            doc_id = _prepend_md(entry["bucket"], fids, st, md, header=target)
            results.append({"bucket": entry["bucket"], "doc_id": doc_id})
    at = (payload.get("active_tasks_markdown") or "").strip()
    if at:
        doc_id = _prepend_md("active", fids, st, at, header="%s — From meetings" % target)
        results.append({"bucket": "Active Tasks", "doc_id": doc_id})
    print(json.dumps({"published": results}, indent=2, ensure_ascii=False))


# ----------------------------------------------------------------------------- backfill (one-time history import)
def cmd_backfill(payload_file):
    """payload: {"items":[{"key":"<bucket>","markdown":"..."}, {"key":"active","markdown":"..."}]}
    Imports historical content as the BASE of each note (no date header). Skips a key
    already present in state (so re-running won't duplicate)."""
    payload = json.load(open(payload_file))
    fids, st, results = folder_ids(), _load_state(), []
    for item in payload.get("items", []):
        key, md = item["key"], (item.get("markdown") or "").strip()
        if not md:
            continue
        if key in st["notes"]:
            results.append({"key": key, "skipped": "already in state"}); continue
        doc_id = _prepend_md(key, fids, st, md, header=None)
        results.append({"key": key, "doc_id": doc_id})
    print(json.dumps({"backfilled": results}, indent=2, ensure_ascii=False))


# ----------------------------------------------------------------------------- generic prepend / read (morning-briefing)
def cmd_prepend(note, md_file, header, title):
    fids, st = folder_ids(), _load_state()
    if title and note in SPECIAL_NOTES:
        SPECIAL_NOTES[note]["title"] = title
    md = open(md_file).read().strip()
    doc_id = _prepend_md(note, fids, st, md, header=header)
    print(json.dumps({"note": note, "doc_id": doc_id}, ensure_ascii=False))


def _replace(doc_id, panel_id, new_nodes):
    if not new_nodes:
        new_nodes = [{"type": "paragraph"}]
    call("update-document-panel", {"id": panel_id, "document_id": doc_id,
                                   "content": {"type": "doc", "content": new_nodes},
                                   "original_content": ""})


def cmd_set_note(note, md_file):
    """REPLACE a note's entire content with new markdown. Pair with read-note for
    read-modify-write edits (complete/edit/reorder tasks in '✅ Active Tasks')."""
    fids, st = folder_ids(), _load_state()
    doc_id, panel_id = _ensure_note(note, fids, st)
    md = open(md_file).read()
    _replace(doc_id, panel_id, md_to_pm(md))
    _save_state(st)
    print(json.dumps({"note": note, "doc_id": doc_id, "action": "set"}, ensure_ascii=False))


def cmd_read_note(note):
    st = _load_state()
    entry = st["notes"].get(note)
    if not entry:
        print(""); return
    panels = call("get-document-panels", {"document_id": entry["doc_id"]})
    panel = next((p for p in panels if p["id"] == entry["panel_id"]), None)
    nodes = (panel or {}).get("content", {}).get("content", []) if panel else []
    print(pm_to_md(nodes))


# ----------------------------------------------------------------------------- main
def main():
    global _TOKEN
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("fetch").add_argument("--date", required=True)
    sub.add_parser("publish").add_argument("--file", required=True)
    sub.add_parser("backfill").add_argument("--file", required=True)
    pp = sub.add_parser("prepend")
    pp.add_argument("--note", required=True); pp.add_argument("--file", required=True)
    pp.add_argument("--header", default=None); pp.add_argument("--title", default=None)
    sn = sub.add_parser("set-note")
    sn.add_argument("--note", required=True); sn.add_argument("--file", required=True)
    sub.add_parser("read-note").add_argument("--note", required=True)
    sub.add_parser("transcript").add_argument("--doc", required=True)
    args = ap.parse_args()

    _TOKEN = _token()
    if args.cmd == "fetch":
        cmd_fetch(args.date)
    elif args.cmd == "publish":
        cmd_publish(args.file)
    elif args.cmd == "backfill":
        cmd_backfill(args.file)
    elif args.cmd == "prepend":
        cmd_prepend(args.note, args.file, args.header, args.title)
    elif args.cmd == "set-note":
        cmd_set_note(args.note, args.file)
    elif args.cmd == "read-note":
        cmd_read_note(args.note)
    elif args.cmd == "transcript":
        print(json.dumps(call("get-document-transcript", {"document_id": args.doc}), ensure_ascii=False))


if __name__ == "__main__":
    main()
