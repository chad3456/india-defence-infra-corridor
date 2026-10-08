"""
Internet speeds by country, from Ookla's open speed-test tiles.

    python scripts/etl/ookla_speeds.py        (runs in GitHub Actions)

Writes data/internet/speeds.json.

Ookla publishes, every quarter, the average download, upload and latency of
the speed tests run in each ~600 m map tile, with the number of tests behind
each average (CC BY-NC-SA 4.0). Ookla does not publish country figures in that
dataset, so this script makes them, and the page labels them as derived:

  * each tile is placed in a country by its centre point, using Natural
    Earth's 1:50m borders drawn from India's point of view (the borders the
    rest of this site uses);
  * a country's figure is the mean of its tiles' averages weighted by their
    test counts — the mean speed of the tests run there, not a median, and not
    Ookla's own Speedtest Global Index, which uses a different method and will
    differ;
  * a country with fewer than MIN_TESTS tests in the quarter is left out
    rather than given a number that a few hundred tests could swing.

Nothing is downloaded to disk twice and nothing is estimated: a country with
no tiles has no figure.
"""
import json
import os
import sys
import urllib.request
from datetime import datetime, timezone

import duckdb
import geopandas as gpd
import pandas as pd

ROOT = os.getcwd()
OUT = os.path.join(ROOT, "data", "internet", "speeds.json")
BORDERS = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries_ind.geojson"
BASE = "https://ookla-open-data.s3.amazonaws.com/parquet/performance/type={t}/year={y}/quarter={q}/{y}-{m:02d}-01_performance_{t}_tiles.parquet"
MIN_TESTS = {"fixed": 2000, "mobile": 1000}
CELL = 0.02


def exists(url: str) -> bool:
    try:
        with urllib.request.urlopen(urllib.request.Request(url, method="HEAD"), timeout=60) as r:
            return r.status == 200
    except Exception:
        return False


def latest_quarter() -> tuple[int, int]:
    """The most recent quarter for which both files exist."""
    now = datetime.now(timezone.utc)
    y, q = now.year, (now.month - 1) // 3 + 1
    for _ in range(8):
        m = (q - 1) * 3 + 1
        if exists(BASE.format(t="fixed", y=y, q=q, m=m)) and exists(BASE.format(t="mobile", y=y, q=q, m=m)):
            return y, q
        q -= 1
        if q == 0:
            y, q = y - 1, 4
    raise SystemExit("no Ookla quarter found in the last two years")


def borders() -> gpd.GeoDataFrame:
    gdf = gpd.read_file(BORDERS)
    keep = gdf[["ADM0_A3", "ISO_A3", "ISO_N3", "NAME", "geometry"]].copy()
    # Natural Earth marks a few ISO codes as -99; its own ADM0_A3 is always set.
    keep["iso3"] = keep.apply(lambda r: r["ISO_A3"] if r["ISO_A3"] not in ("-99", None) else r["ADM0_A3"], axis=1)
    keep["isoN"] = keep["ISO_N3"].astype(str).str.zfill(3)
    return keep.to_crs("EPSG:4326")


def country_means(kind: str, y: int, q: int, countries: gpd.GeoDataFrame) -> dict:
    url = BASE.format(t=kind, y=y, q=q, m=(q - 1) * 3 + 1)
    con = duckdb.connect()
    con.execute("INSTALL httpfs; LOAD httpfs;")
    # Test-weighted sums per 0.02° cell (~2 km): exact for every cell inside a
    # country, and six million points become a few hundred thousand to place.
    df = con.execute(f"""
        SELECT round(tile_x / {CELL}) * {CELL} AS x, round(tile_y / {CELL}) * {CELL} AS y,
               sum(avg_d_kbps * tests) AS wd, sum(avg_u_kbps * tests) AS wu, sum(avg_lat_ms * tests) AS wl,
               sum(tests) AS tests, count(*) AS tiles
        FROM read_parquet('{url}') WHERE tests > 0 GROUP BY 1, 2
    """).df()
    total_tiles = int(df["tiles"].sum())
    print(f"  {kind} {y} Q{q}: {total_tiles:,} tiles in {len(df):,} cells, {int(df['tests'].sum()):,} tests", flush=True)
    pts = gpd.GeoDataFrame(df, geometry=gpd.points_from_xy(df["x"], df["y"]), crs="EPSG:4326")
    joined = gpd.sjoin(pts, countries[["iso3", "isoN", "NAME", "geometry"]], how="inner", predicate="within")
    unplaced = total_tiles - int(joined["tiles"].sum())
    g = joined.groupby(["iso3", "isoN", "NAME"]).agg(tests=("tests", "sum"), tiles=("tiles", "sum"), wd=("wd", "sum"), wu=("wu", "sum"), wl=("wl", "sum")).reset_index()
    out = {}
    for r in g.itertuples():
        if r.tests < MIN_TESTS[kind]:
            continue
        out[r.iso3] = {
            "name": r.NAME,
            "isoN": r.isoN,
            "downMbps": round(r.wd / r.tests / 1000, 1),
            "upMbps": round(r.wu / r.tests / 1000, 1),
            "latencyMs": round(r.wl / r.tests, 1),
            "tests": int(r.tests),
            "tiles": int(r.tiles),
        }
    print(f"  {kind}: {len(out)} countries with ≥{MIN_TESTS[kind]} tests; {unplaced:,} tiles fell outside every border (sea, or a coastline at 1:50m)", flush=True)
    return {"countries": out, "tiles": total_tiles, "tests": int(df["tests"].sum()), "unplacedTiles": int(unplaced), "url": url}


def main() -> None:
    y, q = latest_quarter()
    countries = borders()
    data = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "year": y,
        "quarter": q,
        "source": "Ookla Open Data — Speedtest performance tiles (CC BY-NC-SA 4.0), https://github.com/teamookla/ookla-open-data",
        "method": "Tiles summed into 0.02-degree cells, each cell placed by its centre in Natural Earth 1:50m borders (India's point of view); test-weighted mean of tile averages; countries under the minimum test count omitted.",
        "minTests": MIN_TESTS,
        "fixed": country_means("fixed", y, q, countries),
        "mobile": country_means("mobile", y, q, countries),
    }
    if len(data["fixed"]["countries"]) < 50 or len(data["mobile"]["countries"]) < 50:
        sys.exit("fewer than 50 countries placed; keeping the previous file")
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=1, ensure_ascii=False)
        f.write("\n")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
