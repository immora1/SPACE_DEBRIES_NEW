"""
Space-Track LEO/MEO/GEO 在轨卫星数据一次性爬取脚本
运行：python fetch_satellites.py
输出：satellites.json 和 satellites.csv
依赖：pip install requests
"""

import requests
import json
import csv
import sys
from datetime import datetime

sys.stdout.reconfigure(encoding='utf-8')

# ── 账号配置 ─────────────────────────────────────────────────────────────────
USERNAME = "2276368782@qq.com"
PASSWORD = "5671883Noautumn"

# ── 输出文件 ─────────────────────────────────────────────────────────────────
JSON_OUTPUT = "satellites.json"
CSV_OUTPUT  = "satellites.csv"

# ── Space-Track API ───────────────────────────────────────────────────────────
BASE_URL  = "https://www.space-track.org"
LOGIN_URL = f"{BASE_URL}/ajaxauth/login"
# 拉取所有在轨有效载荷（不限高度，后续在本地按高度筛选出 LEO/MEO/GEO）
QUERY_URL = (
    f"{BASE_URL}/basicspacedata/query/class/satcat"
    "/CURRENT/Y/OBJECT_TYPE/PAYLOAD"
    "/FORMAT/JSON/orderby/LAUNCH%20desc/limit/5000"
)

# 需要保存的字段
KEEP_FIELDS = [
    "OBJECT_NAME",
    "NORAD_CAT_ID",
    "COUNTRY",
    "LAUNCH",
    "LAUNCH_YEAR",
    "SITE",
    "PERIOD",
    "INCLINATION",
    "APOGEE",
    "PERIGEE",
    "RCS_SIZE",
    "OBJECT_ID",
    "ORBIT_TYPE",   # 脚本自动填入
]

# ── 轨道分类 ──────────────────────────────────────────────────────────────────
# 返回 "LEO" / "MEO" / "GEO" / None（不在这三个轨道则丢弃）
def classify_orbit(apogee_km):
    if apogee_km is None:
        return None
    a = float(apogee_km)
    if a < 2000:
        return "LEO"           # 低地球轨道 < 2000 km
    elif a < 35586:
        return "MEO"           # 中地球轨道 2000–35586 km
    elif a <= 35986:
        return "GEO"           # 地球静止轨道 35786 ± 200 km
    else:
        return None            # HEO / 超同步 → 丢弃


def main():
    session = requests.Session()

    # ── 1. 登录 ──────────────────────────────────────────────────────────────
    print("正在登录 Space-Track...")
    login_resp = session.post(
        LOGIN_URL,
        data={"identity": USERNAME, "password": PASSWORD},
        timeout=30,
    )
    if login_resp.status_code != 200:
        print(f"登录失败，HTTP {login_resp.status_code}")
        sys.exit(1)

    body = login_resp.text
    if "Failed" in body or "Invalid" in body or "error" in body.lower():
        print(f"登录失败，返回内容：{body[:200]}")
        sys.exit(1)

    print("登录成功 ✓")

    # ── 2. 查询卫星数据 ───────────────────────────────────────────────────────
    print("正在拉取在轨卫星列表（可能需要 10–20 秒）...")
    data_resp = session.get(QUERY_URL, timeout=120)

    if data_resp.status_code != 200:
        print(f"查询失败，HTTP {data_resp.status_code}")
        print(data_resp.text[:300])
        sys.exit(1)

    try:
        raw = data_resp.json()
    except Exception:
        print("返回内容不是 JSON：")
        print(data_resp.text[:300])
        sys.exit(1)

    if not isinstance(raw, list) or len(raw) == 0:
        print(f"返回数据为空或格式异常：{str(raw)[:200]}")
        sys.exit(1)

    print(f"原始记录 {len(raw)} 条，开始筛选 LEO/MEO/GEO...")

    # ── 3. 过滤字段 + 轨道筛选 ───────────────────────────────────────────────
    sats = []
    counts = {"LEO": 0, "MEO": 0, "GEO": 0}
    skipped = 0

    for s in raw:
        sat = {k: s.get(k) for k in KEEP_FIELDS if k != "ORBIT_TYPE"}

        # 数值字段转 float
        for num_field in ("APOGEE", "PERIGEE", "INCLINATION", "PERIOD", "NORAD_CAT_ID", "LAUNCH_YEAR"):
            if sat.get(num_field) is not None:
                try:
                    sat[num_field] = float(sat[num_field])
                except (ValueError, TypeError):
                    pass

        orbit_type = classify_orbit(sat.get("APOGEE"))
        if orbit_type is None:
            skipped += 1
            continue   # HEO 及其他，跳过

        sat["ORBIT_TYPE"] = orbit_type
        counts[orbit_type] += 1
        sats.append(sat)

    print(f"筛选后保留 {len(sats)} 条（丢弃非 LEO/MEO/GEO 共 {skipped} 条）")

    # ── 4. 保存 JSON ─────────────────────────────────────────────────────────
    meta = {
        "fetched_at": datetime.utcnow().isoformat() + "Z",
        "total": len(sats),
        "by_orbit": counts,
        "source": "space-track.org",
        "satellites": sats,
    }
    with open(JSON_OUTPUT, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    print(f"已保存 JSON → {JSON_OUTPUT}")

    # ── 5. 保存 CSV ──────────────────────────────────────────────────────────
    with open(CSV_OUTPUT, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=KEEP_FIELDS)
        writer.writeheader()
        writer.writerows(sats)
    print(f"已保存 CSV  → {CSV_OUTPUT}")

    # ── 6. 统计与预览 ────────────────────────────────────────────────────────
    print("\n── 轨道分布 ──")
    desc = {"LEO": "LEO（< 2000 km）    ", "MEO": "MEO（2000–35586 km）", "GEO": "GEO（≈ 35786 km）   "}
    for orbit, cnt in counts.items():
        print(f"  {desc[orbit]}  {cnt:>5} 颗")

    for orbit in ("LEO", "MEO", "GEO"):
        subset = [s for s in sats if s["ORBIT_TYPE"] == orbit][:3]
        if not subset:
            continue
        print(f"\n── {orbit} 前 {len(subset)} 条预览 ──")
        for s in subset:
            print(f"  {s['OBJECT_NAME']:<28} | {s['COUNTRY']:<5} | "
                  f"APOGEE {s['APOGEE']} km | 发射 {s['LAUNCH']}")

    print(f"\n完成。共 {len(sats)} 颗 LEO/MEO/GEO 在轨卫星。")


if __name__ == "__main__":
    main()
