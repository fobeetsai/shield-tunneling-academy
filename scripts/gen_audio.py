import asyncio
import json
import os
import time
import edge_tts

TERMS_JSON = r"G:\我的雲端硬碟\CF763 資料\shield-tunneling-academy\data\terms.json"
AUDIO_DIR = r"G:\我的雲端硬碟\CF763 資料\shield-tunneling-academy\audio"
VOICE = "ja-JP-NanamiNeural"


async def gen_one(sem, item, stats):
    out_path = os.path.join(AUDIO_DIR, f"{item['id']}.mp3")
    if os.path.exists(out_path) and os.path.getsize(out_path) > 500:
        stats["skip"] += 1
        return
    text = item["jp"]
    async with sem:
        for attempt in range(3):
            try:
                comm = edge_tts.Communicate(text, VOICE)
                await comm.save(out_path)
                stats["ok"] += 1
                return
            except Exception as e:
                if attempt == 2:
                    stats["err"] += 1
                    print(f"ERR {item['id']} ({text}): {e}")
                else:
                    await asyncio.sleep(0.5 * (attempt + 1))


async def main():
    with open(TERMS_JSON, "r", encoding="utf-8") as f:
        items = json.load(f)
    os.makedirs(AUDIO_DIR, exist_ok=True)
    sem = asyncio.Semaphore(20)
    stats = {"ok": 0, "skip": 0, "err": 0}
    t0 = time.time()
    tasks = [gen_one(sem, item, stats) for item in items]
    await asyncio.gather(*tasks)
    print(f"Finished in {time.time() - t0:.1f}s -> ok={stats['ok']}, skip={stats['skip']}, err={stats['err']}")


if __name__ == "__main__":
    asyncio.run(main())
