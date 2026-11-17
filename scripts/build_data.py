import json
import os
import re
import unicodedata
import openpyxl
import jaconv
from sudachipy import dictionary, tokenizer

FOLDER = r"G:\我的雲端硬碟\潛盾機相關"
KANJI_JSON = r"C:\Users\fobee\.gemini\antigravity\brain\8b5b666d-eda1-4e22-b679-87b7de8861ba\scratch\kanji.json"
OUT_JSON = r"G:\我的雲端硬碟\CF763 資料\shield-tunneling-academy\data\terms.json"

with open(KANJI_JSON, "r", encoding="utf-8") as f:
    KANJI_DB = json.load(f)

tok = dictionary.Dictionary().tokenizer()

# Engineering & civil-construction reading overrides (full term or token -> exact kana)
READING_OVERRIDES = {
    "余掘り": "よぼり",
    "鏡切り": "かがみぎり",
    "裏込め": "うらごめ",
    "裏込め注入": "うらごめちゅうにゅう",
    "切羽": "きりは",
    "立坑": "たてこう",
    "発進立坑": "はっしんたてこう",
    "到達立坑": "とうたつたてこう",
    "換気立坑": "かんきたてこう",
    "地山": "じやま",
    "千鳥組": "ちどりぐみ",
    "千鳥組み": "ちどりぐみ",
    "目地": "めじ",
    "継手": "つぎて",
    "中折れ": "なかおれ",
    "中折れ装置": "なかおれそうち",
    "割付": "わりつけ",
    "段取替": "だんどりがえ",
    "段取り替え": "だんどりがえ",
    "取り合い": "とりあい",
    "取合": "とりあい",
    "上盤": "うわばん",
    "下盤": "したばん",
    "天端": "てんば",
    "根入れ": "ねいれ",
    "土被り": "どかぶり",
    "土圧": "どあつ",
    "水土圧": "すいどあつ",
    "間隙水圧": "かんげきすいあつ",
    "泥水式": "でいすいしき",
    "泥土圧": "でいどあつ",
    "送泥": "そうでい",
    "排泥": "はいでい",
    "作泥": "さくでい",
    "逸泥": "いつでい",
    "鋼殻": "こうかく",
    "全断面": "ぜんだんめん",
    "一軸圧縮強さ": "いちじくあっしゅくつよさ",
    "砂礫": "されき",
    "頁岩": "けつがん",
    "互層": "ごそう",
    "仮設": "かせつ",
    "覆工": "ふっこう",
    "支保": "しほ",
    "薬液注入": "やくえきちゅうにゅう",
    "現場": "げんば",
    "揚重": "ようじゅう",
    "門型クレーン": "もんがたくれーん",
    "残土": "ざんど",
    "湧水": "ゆうすい",
    "止水": "しすい",
    "止水シール": "しすいしーる",
    "止水壁": "しすいへき",
    "羽根": "はね",
    "攪拌": "かくはん",
    "撹拌": "かくはん",
    "沈下": "ちんか",
    "隆起": "りゅうき",
    "坑口": "こうぐち",
    "坑内": "こうない",
    "坑外": "こうがい",
    "手元": "てもと",
    "玉掛け": "たまかけ",
    "合図": "あいず",
    "掘進": "くっしん",
    "掘削": "くっさく",
    "穿孔": "せんこう",
    "締固め": "しめかため",
    "養生": "ようじょう",
    "離隔": "りかく",
    "胸壁": "きょうへき",
    "打設": "だせつ",
    "鉄筋": "てっきん",
    "型枠": "かたわく",
    "足場": "あしば",
    "朝顔": "あさがお",
    "仮囲い": "かりがこい",
    "覆工板": "ふっこうばん",
    "地中連続壁": "ちちゅうれんぞくへき",
    "場所打ち杭": "ばしょうちぐい",
    "山留め": "やまどめ",
    "腹起し": "はらおこし",
    "切梁": "きりばり",
    "火打ち": "ひうち",
    "釜場": "かまば",
    "水替": "みずかえ",
    "水替え": "みずかえ",
    "送泥管": "そうでいかん",
    "排泥管": "はいでいかん",
    "反力": "はんりょく",
    "反力受け": "はんりょくうけ",
    "人車": "じんしゃ",
    "噴湧": "ふんゆう",
    "仮壁": "かりかべ",
    "受台": "うけだい",
}

CATEGORIES = [
    ("01 潛盾機構造與設備", ["機體", "構造", "刀盤", "切削", "機械諸元", "螺旋", "千斤頂", "驅動", "後配套", "設備", "外殼", "鋼殻", "カッタ", "ジャッキ", "スクリュ", "シールド機", "中折"]),
    ("02 泥水處理與輸送", ["泥水", "作泥", "送排泥", "送泥", "排泥", "一次處理", "二次處理", "凝集", "脫水", "濾", "槽", "タンク", "ポンプ", "スラリー", "作泥", "比重", "粘度", "逸泥", "分級", "除砂"]),
    ("03 掘進管理與姿態控制", ["掘進", "姿態", "測量", "導向", "控制", "管理", "推進", "偏心", "陀螺", "線型", "曲線", "加泥", "土壓", "水壓", "切羽", "計測", "監測", "計器", "中央制御", "自動化"]),
    ("04 環片組裝與背填灌漿", ["環片", "セグメント", "背填", "裏込", "灌漿", "注入", "止水", "シール", "螺栓", "ボルト", "錯縫", "千鳥", "割付", "組裝", "エレクタ", "覆工", "目地", "継手", "充填"]),
    ("05 發進到達與立坑工程", ["發進", "到達", "立坑", "工作井", "破鏡", "鏡切", "門型", "クレーン", "吊", "揚重", "基地", "初期掘進", "段取替", "假設", "仮設", "山留", "支撐", "連續壁", "開口", "坑口"]),
    ("06 地盤工學與地質條件", ["地質", "地盤", "岩", "砂", "礫", "粘土", "沖積", "斷層", "地下水", "透水", "間隙", "液化", "沉下", "沈下", "隆起", "改良", "薬液", "凍結", "地山", "土被り", "土質"]),
    ("07 施工計畫與契約管理", ["計畫", "計画", "契約", "仕様", "規格", "工法", "設計", "工期", "品質", "驗收", "検査", "工程", "責任", "界面", "協議", "交通", "管線", "埋設物", "電力", "受變電", "受変電", "通信"]),
    ("08 安全衛生與口譯實務", ["安全", "安衛", "職安", "保護", "防災", "換氣", "換気", "防災", "救難", "通訳", "口譯", "地雷", "差異", "注意", "警報", "緊急", "玉掛", "點檢", "点検"]),
]


def is_kanji(ch):
    code = ord(ch)
    return (0x4E00 <= code <= 0x9FFF) or (0x3400 <= code <= 0x4DBF) or ch == "々"


def is_kana(ch):
    code = ord(ch)
    return (0x3040 <= code <= 0x309F) or (0x30A0 <= code <= 0x30FF) or ch == "ー"


def classify_category(raw_cat, jp, zh, note):
    text = f"{raw_cat} {jp} {zh} {note}"
    for cat_name, kws in CATEGORIES:
        for kw in kws:
            if kw in text:
                return cat_name
    return "07 施工計畫與契約管理"


def clean_jp_term(raw_jp, raw_kana=""):
    if not raw_jp:
        return "", ""
    s = str(raw_jp).strip()
    s = re.sub(r"[\r\n]+", " ", s)
    # Extract embedded kana in parentheses if present e.g. 頁岩（けつがん）
    embedded_kana = ""
    m = re.search(r"[（(]([ぁ-んァ-ンー・／/\s]+)[）)]", s)
    if m and not raw_kana:
        embedded_kana = m.group(1).strip()
    # Remove parenthetical notes/readings for clean display term
    s_clean = re.sub(r"[（(][^）)]*[）)]", "", s).strip()
    # Take primary variant before / or ／
    primary = re.split(r"\s*[/／]\s*", s_clean)[0].strip()
    # Remove leading 【...】 tags
    primary = re.sub(r"^【[^】]+】\s*", "", primary).strip()
    # Ignore pure non-Japanese or overly long sentences
    if len(primary) > 28 or len(primary) == 0:
        return "", ""
    if not any(is_kanji(c) or is_kana(c) for c in primary):
        return "", ""
    kana = str(raw_kana or embedded_kana or "").strip()
    kana = re.split(r"\s*[/／]\s*", kana)[0].strip()
    kana = re.sub(r"[（(][^）)]*[）)]", "", kana).strip()
    if kana in ("—", "-", "－", "N/A", ""):
        kana = ""
    return primary, kana


def get_sudachi_tokens(term):
    if term in READING_OVERRIDES:
        return [(term, READING_OVERRIDES[term])]
    ms = tok.tokenize(term, tokenizer.Tokenizer.SplitMode.C)
    res = []
    for m in ms:
        surf = m.surface()
        if surf in READING_OVERRIDES:
            rd = READING_OVERRIDES[surf]
        elif not any(is_kanji(c) or is_kana(c) or c.isalnum() for c in surf):
            rd = surf
        else:
            rd = jaconv.kata2hira(m.reading_form())
            if not rd or rd == "*" or rd == "きごう" or any(is_kanji(c) for c in rd):
                # Fallback to SplitMode.A if C failed to read a compound kanji
                sub_ms = tok.tokenize(surf, tokenizer.Tokenizer.SplitMode.A)
                sub_rd = []
                for sm in sub_ms:
                    ss = sm.surface()
                    if ss in READING_OVERRIDES:
                        sub_rd.append(READING_OVERRIDES[ss])
                    else:
                        sr = jaconv.kata2hira(sm.reading_form())
                        sub_rd.append(sr if (sr and sr != "*" and sr != "きごう") else jaconv.kata2hira(ss))
                rd = "".join(sub_rd)
        res.append((surf, rd))
    return res


def expand_rendaku_variants(r):
    """Generate possible rendaku / sokuonbin forms of a base reading."""
    variants = {r}
    rendaku_map = {
        "か": "が", "き": "ぎ", "く": "ぐ", "け": "げ", "こ": "ご",
        "さ": "ざ", "し": "じ", "す": "ず", "せ": "ぜ", "そ": "ぞ",
        "た": "だ", "ち": "ぢ", "つ": "づ", "て": "で", "と": "ど",
        "は": "ば", "ひ": "び", "ふ": "ぶ", "へ": "べ", "ほ": "ぼ",
    }
    handaku_map = {"は": "ぱ", "ひ": "ぴ", "ふ": "ぷ", "へ": "ぺ", "ほ": "ぽ"}
    if r:
        first = r[0]
        if first in rendaku_map:
            variants.add(rendaku_map[first] + r[1:])
        if first in handaku_map:
            variants.add(handaku_map[first] + r[1:])
        if len(r) >= 2 and r[-1] in ("つ", "く", "き", "ち"):
            variants.add(r[:-1] + "っ")
            if first in rendaku_map:
                variants.add(rendaku_map[first] + r[1:-1] + "っ")
            if first in handaku_map:
                variants.add(handaku_map[first] + r[1:-1] + "っ")
    return variants


def classify_kanji_reading(kanji_char, reading_hira):
    """Return 'on', 'kun', or 'special' for a single kanji and its reading."""
    info = KANJI_DB.get(kanji_char)
    if not info:
        return "on"
    ons = [jaconv.kata2hira(x.replace("-", "").replace(".", "")) for x in info.get("readings_on", [])]
    kuns = [jaconv.kata2hira(x.split(".")[0].replace("-", "")) for x in info.get("readings_kun", [])]

    on_vars = set()
    for o in ons:
        on_vars |= expand_rendaku_variants(o)
    kun_vars = set()
    for k in kuns:
        kun_vars |= expand_rendaku_variants(k)

    r = jaconv.kata2hira(reading_hira)
    in_on = r in on_vars
    in_kun = r in kun_vars
    if in_on and not in_kun:
        return "on"
    if in_kun and not in_on:
        return "kun"
    if in_on and in_kun:
        return "on"
    # Fallback heuristic: check prefix match with kun stem or on
    for k in kuns:
        if k and r.startswith(k):
            return "kun"
    for o in ons:
        if o and r.startswith(o[:1]) and len(r) <= 3:
            return "on"
    return "special"


def split_kanji_compound_readings(kanji_seq, reading_hira):
    """Best-effort split of a multi-kanji sequence reading into per-kanji (char, reading, type)."""
    n = len(kanji_seq)
    if n == 1:
        ch = kanji_seq[0]
        return [(ch, reading_hira, classify_kanji_reading(ch, reading_hira))]

    # Try backtracking match using KANJI_DB
    def solve(idx, pos):
        if idx == n:
            return [] if pos == len(reading_hira) else None
        ch = kanji_seq[idx]
        if ch == "々" and idx > 0:
            # Iteration mark repeats previous kanji
            prev_ch = kanji_seq[idx - 1]
            info = KANJI_DB.get(prev_ch, {})
        else:
            info = KANJI_DB.get(ch, {})
        candidates = []
        for tag, rlist in [("on", info.get("readings_on", [])), ("kun", info.get("readings_kun", []))]:
            for raw_r in rlist:
                base = jaconv.kata2hira(raw_r.split(".")[0].replace("-", ""))
                for v in expand_rendaku_variants(base):
                    if v and reading_hira.startswith(v, pos):
                        candidates.append((len(v), v, tag))
        # Prefer longer matches, and prefer 'on' for 2+ kanji compounds when tied
        candidates.sort(key=lambda x: (-x[0], 0 if x[2] == "on" else 1))
        seen = set()
        for length, v, tag in candidates:
            if (v, tag) in seen:
                continue
            seen.add((v, tag))
            rest = solve(idx + 1, pos + length)
            if rest is not None:
                return [(ch, v, tag)] + rest
        return None

    matched = solve(0, 0)
    if matched:
        return matched
    # Fallback: return whole compound as one block
    return [(kanji_seq, reading_hira, "special")]


def build_ruby_and_breakdown(term):
    tokens = get_sudachi_tokens(term)
    ruby_parts = []
    full_kana_parts = []
    breakdown = []

    for surf, rd in tokens:
        full_kana_parts.append(rd)
        has_kanji = any(is_kanji(c) for c in surf)
        if not has_kanji:
            ruby_parts.append(surf)
            continue

        # Strip matching leading/trailing kana (okurigana)
        prefix = ""
        suffix = ""
        s_rem = surf
        r_rem = rd

        while s_rem and r_rem and not is_kanji(s_rem[0]):
            c_hira = jaconv.kata2hira(s_rem[0])
            if r_rem.startswith(c_hira):
                prefix += s_rem[0]
                s_rem = s_rem[1:]
                r_rem = r_rem[len(c_hira):]
            else:
                break

        while s_rem and r_rem and not is_kanji(s_rem[-1]):
            c_hira = jaconv.kata2hira(s_rem[-1])
            if r_rem.endswith(c_hira):
                suffix = s_rem[-1] + suffix
                s_rem = s_rem[:-1]
                r_rem = r_rem[:-len(c_hira)]
            else:
                break

        if s_rem and all(is_kanji(c) for c in s_rem) and r_rem:
            # Split per-kanji for super crisp ruby & breakdown
            per_k = split_kanji_compound_readings(s_rem, r_rem)
            if len(per_k) == len(s_rem):
                k_html = "".join(f"<ruby>{k}<rt>{kr}</rt></ruby>" for k, kr, _ in per_k)
                for k, kr, ktype in per_k:
                    breakdown.append({"kanji": k, "reading": kr, "type": ktype})
            else:
                k_html = f"<ruby>{s_rem}<rt>{r_rem}</rt></ruby>"
                breakdown.append({"kanji": s_rem, "reading": r_rem, "type": "special"})
            ruby_parts.append(f"{prefix}{k_html}{suffix}")
        else:
            ruby_parts.append(f"<ruby>{surf}<rt>{rd}</rt></ruby>")
            breakdown.append({"kanji": surf, "reading": rd, "type": "special"})

    # Determine overall reading pattern for kanji terms
    types = [b["type"] for b in breakdown]
    if not types:
        pattern = "kana"
    elif all(t == "on" for t in types):
        pattern = "音讀"
    elif all(t == "kun" for t in types):
        pattern = "訓讀"
    elif "on" in types and "kun" in types:
        if types[0] == "on" and types[-1] == "kun":
            pattern = "重箱讀（音+訓）"
        elif types[0] == "kun" and types[-1] == "on":
            pattern = "湯桶讀（訓+音）"
        else:
            pattern = "音訓混讀"
    else:
        pattern = "特殊/熟字訓"

    return "".join(ruby_parts), "".join(full_kana_parts), breakdown, pattern


def add_term(store, jp_raw, kana_raw, zh_tw, zh_cn="", en="", note="", cat_raw="", source="", priority=1):
    jp, sheet_kana = clean_jp_term(jp_raw, kana_raw)
    if not jp:
        return
    zh_tw = str(zh_tw or "").strip()
    if not zh_tw or zh_tw in ("—", "-", "None"):
        return
    zh_cn = str(zh_cn or "").strip()
    if zh_cn in ("—", "-", "None"):
        zh_cn = ""
    en = str(en or "").strip()
    if en in ("—", "-", "None"):
        en = ""
    note = str(note or "").strip()
    if note in ("—", "-", "None"):
        note = ""

    cat = classify_category(cat_raw, jp, zh_tw, note)
    if jp in store:
        item = store[jp]
        if len(zh_tw) > 0 and zh_tw not in item["zh_tw"]:
            if len(item["zh_tw"]) < 30:
                pass  # keep concise primary
        if not item["zh_cn"] and zh_cn:
            item["zh_cn"] = zh_cn
        if not item["en"] and en:
            item["en"] = en
        if len(note) > len(item["note"]):
            item["note"] = note
        if priority > item["priority"]:
            item["priority"] = priority
        if source and source not in item["sources"]:
            item["sources"].append(source)
        return

    ruby_html, kana_auto, breakdown, pattern = build_ruby_and_breakdown(jp)
    store[jp] = {
        "jp": jp,
        "kana": kana_auto,
        "sheet_kana": sheet_kana,
        "ruby": ruby_html,
        "breakdown": breakdown,
        "pattern": pattern,
        "zh_tw": zh_tw,
        "zh_cn": zh_cn,
        "en": en,
        "note": note,
        "category": cat,
        "priority": priority,
        "sources": [source] if source else [],
    }


def load_all():
    store = {}

    # 1. 潛盾與地下工程中日對譯高頻詞彙表.xlsx (priority 3 - core high freq)
    wb = openpyxl.load_workbook(os.path.join(FOLDER, "潛盾與地下工程中日對譯高頻詞彙表.xlsx"), read_only=True, data_only=True)
    ws = wb["01_全領域高頻詞彙總表"]
    for i, r in enumerate(ws.iter_rows(values_only=True)):
        if i < 4 or not r or len(r) < 6:
            continue
        add_term(store, r[3], r[4], r[5], "", "", f"{r[6] or ''} {r[8] or ''}".strip(), f"{r[1] or ''} {r[2] or ''}", "高頻詞彙表", priority=3)
    wb.close()

    # 2. 潛盾施工設備術語對照_台中日.xlsx (priority 3)
    wb = openpyxl.load_workbook(os.path.join(FOLDER, "潛盾施工設備術語對照_台中日.xlsx"), read_only=True, data_only=True)
    for s in wb.sheetnames:
        if s.startswith("00") or s.startswith("09") or s == "工作表1":
            continue
        ws = wb[s]
        for i, r in enumerate(ws.iter_rows(values_only=True)):
            if i == 0 or not r or len(r) < 3:
                continue
            add_term(store, r[0], r[1], r[2], r[3] if len(r) > 3 else "", r[4] if len(r) > 4 else "",
                     f"{r[5] or ''} {r[6] or ''}".strip(), s, "設備術語台中日", priority=3)
    wb.close()

    # 3. 泥水式シールド_地上設備_初期掘進_専門用語集.xlsx (priority 3)
    wb = openpyxl.load_workbook(os.path.join(FOLDER, "泥水式シールド_地上設備_初期掘進_専門用語集.xlsx"), read_only=True, data_only=True)
    ws = wb["01_全用語一覧(マスター)"]
    for i, r in enumerate(ws.iter_rows(values_only=True)):
        if i < 4 or not r or len(r) < 6:
            continue
        add_term(store, r[4], r[5], r[3], "", "", r[7] if len(r) > 7 else "", f"{r[1] or ''} {r[2] or ''}", "泥水地上設備", priority=3)
    wb.close()

    # 4. CF763潛盾機詳細設計計畫書_中日台三方口譯詞彙總表.xlsx (priority 3)
    wb = openpyxl.load_workbook(os.path.join(FOLDER, "CF763潛盾機詳細設計計畫書_中日台三方口譯詞彙總表.xlsx"), read_only=True, data_only=True)
    ws = wb["1_全冊三方詞彙總表"]
    for i, r in enumerate(ws.iter_rows(values_only=True)):
        if i == 0 or not r or len(r) < 8:
            continue
        tag = f"[{r[3]}] " if r[3] and str(r[3]) != "一般" else ""
        note = f"{tag}{r[9] or ''}".strip()
        add_term(store, r[7], "", r[5], r[4], "", note, r[1] or "", "CF763三方總表", priority=3)
    wb.close()

    # 5. 土木工事関係単語表(已自動修復).xlsx - 黃框 (priority 3)
    wb = openpyxl.load_workbook(os.path.join(FOLDER, "土木工事関係単語表(已自動修復).xlsx"), read_only=True, data_only=True)
    if "黃色框單字 (2)" in wb.sheetnames:
        ws = wb["黃色框單字 (2)"]
        for i, r in enumerate(ws.iter_rows(values_only=True)):
            if i == 0 or not r or len(r) < 5:
                continue
            add_term(store, r[2], r[3], r[4], r[5] if len(r) > 5 else "", r[6] if len(r) > 6 else "",
                     r[7] if len(r) > 7 else "", r[1] or "", "黃框重點單字", priority=3)
    wb.close()

    # 6. 泥水式潛盾_諸元施工掘進計畫_中日術語500語.xlsx (priority 2)
    wb = openpyxl.load_workbook(os.path.join(FOLDER, "泥水式潛盾_諸元施工掘進計畫_中日術語500語.xlsx"), read_only=True, data_only=True)
    ws = wb["01_術語總表"]
    for i, r in enumerate(ws.iter_rows(values_only=True)):
        if i < 4 or not r or len(r) < 6:
            continue
        note = f"{r[6] or ''} {r[7] or ''}".strip() if len(r) > 7 else (r[6] or "")
        add_term(store, r[4], r[5], r[3], "", "", note, f"{r[1] or ''} {r[2] or ''}", "泥水500語", priority=2)
    wb.close()

    # 7. 潛盾隧道工程術語對照表(千問版).xlsx (priority 2 for 高頻/黃框, 1 for rest)
    wb = openpyxl.load_workbook(os.path.join(FOLDER, "潛盾隧道工程術語對照表(千問版).xlsx"), read_only=True, data_only=True)
    for sname, prio in [("高頻速查", 3), ("黃框單字", 3), ("術語總表", 1)]:
        if sname not in wb.sheetnames:
            continue
        ws = wb[sname]
        for i, r in enumerate(ws.iter_rows(values_only=True)):
            if i == 0 or not r or len(r) < 5:
                continue
            add_term(store, r[3], r[4], r[1], r[2], r[5] if len(r) > 5 else "",
                     r[6] if len(r) > 6 else "", r[0] or "", "千問版總表", priority=prio)
    wb.close()

    # Assign stable IDs & sort by category, priority desc, jp
    items = sorted(store.values(), key=lambda x: (x["category"], -x["priority"], x["jp"]))
    for idx, item in enumerate(items, 1):
        item["id"] = f"t{idx:04d}"

    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)

    print(f"Total unique curated terms: {len(items)}")
    from collections import Counter
    print("By category:", dict(Counter(x["category"] for x in items)))
    print("By pattern:", dict(Counter(x["pattern"] for x in items)))
    print("Sample 5:")
    for x in items[:5]:
        print(" ", x["id"], x["jp"], "|", x["kana"], "|", x["pattern"], "|", x["ruby"], "|", x["zh_tw"])


if __name__ == "__main__":
    load_all()
