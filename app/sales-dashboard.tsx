"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

const SHEET_ID = "1yuJxg2PFQgAiOjnnCZVutQm-4I1q376c8eXZOjWQLN8";
const PASSWORD_HASH =
  "7f469b0b89e7f7dfe41555e78f8ae3ba21144802765fc65af724d4467e648fd2";

type BrandKey = "SKT" | "G2G" | "TP";
type BrandMetric = {
  key: BrandKey;
  name: string;
  goal: number;
  sales: number;
  previousSales: number;
  actualGmv: number;
  adSpend: number;
  trend: number[];
};
type SkuMover = {
  brand: BrandKey;
  name: string;
  current: number;
  previous: number;
  delta: number;
  rate: number | null;
};

const BRAND_CONFIG: Array<{
  key: BrandKey;
  name: string;
  goal: number;
  shopSheet: string;
  shopDateCol: string;
  shopSalesCol: string;
  dmsSheet: string;
  dmsGmvCol: string;
  adsSheet: string;
  adsDateCol: string;
  adsSpendCol: string;
}> = [
  {
    key: "SKT",
    name: "SKINTIFIC",
    goal: 2_500_000,
    shopSheet: "SKT-店铺维度每日",
    shopDateCol: "B",
    shopSalesCol: "C",
    dmsSheet: "SKT-店鋪實收（DMS）",
    dmsGmvCol: "J",
    adsSheet: "SKT-站内广告每日",
    adsDateCol: "B",
    adsSpendCol: "AD",
  },
  {
    key: "G2G",
    name: "GLAD2GLOW",
    goal: 1_540_000,
    shopSheet: "G2G-店鋪維度每日",
    shopDateCol: "A",
    shopSalesCol: "B",
    dmsSheet: "G2G-店鋪實收（DMS）",
    dmsGmvCol: "I",
    adsSheet: "G2G-站内廣告每日",
    adsDateCol: "A",
    adsSpendCol: "AC",
  },
  {
    key: "TP",
    name: "TIME PHORIA",
    goal: 460_000,
    shopSheet: "TP-店鋪維度每日",
    shopDateCol: "A",
    shopSalesCol: "B",
    dmsSheet: "TP-店鋪實收（DMS）",
    dmsGmvCol: "E",
    adsSheet: "TP-站内廣告每日",
    adsDateCol: "B",
    adsSpendCol: "AD",
  },
];

function isoDate(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function periodFor(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const monthIndex = monthNumber - 1;
  const today = new Date();
  const isCurrent =
    today.getFullYear() === year && today.getMonth() === monthIndex;
  const endDay = isCurrent
    ? today.getDate()
    : new Date(year, monthIndex + 1, 0).getDate();
  const previousMonthDate = new Date(year, monthIndex - 1, 1);
  const previousEndDay = Math.min(
    endDay,
    new Date(
      previousMonthDate.getFullYear(),
      previousMonthDate.getMonth() + 1,
      0,
    ).getDate(),
  );
  return {
    start: isoDate(year, monthIndex, 1),
    end: isoDate(year, monthIndex, endDay),
    previousStart: isoDate(
      previousMonthDate.getFullYear(),
      previousMonthDate.getMonth(),
      1,
    ),
    previousEnd: isoDate(
      previousMonthDate.getFullYear(),
      previousMonthDate.getMonth(),
      previousEndDay,
    ),
    cutoffDay: endDay,
  };
}

async function fetchGviz(sheet: string, query: string) {
  const params = new URLSearchParams({
    tqx: "out:json",
    sheet,
    tq: query,
  });
  const response = await fetch(
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?${params}`,
    { cache: "no-store" },
  );
  if (!response.ok) throw new Error(`Google Sheets ${response.status}`);
  const text = await response.text();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("无法解析 Google Sheets 数据");
  const payload = JSON.parse(text.slice(start, end + 1));
  if (payload.status !== "ok") {
    throw new Error(payload.errors?.[0]?.detailed_message || "数据查询失败");
  }
  return payload.table.rows as Array<{ c: Array<{ v?: unknown } | null> }>;
}

function valueAt(
  row: { c: Array<{ v?: unknown } | null> } | undefined,
  index: number,
) {
  const value = row?.c?.[index]?.v;
  return typeof value === "number" ? value : Number(value || 0);
}

function formatTwd(value: number, compact = false) {
  if (compact && Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }
  if (compact && Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toFixed(0)}K`;
  }
  return new Intl.NumberFormat("zh-TW", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}

function formatRoi(value: number) {
  return Number.isFinite(value) && value > 0 ? `${value.toFixed(2)}x` : "—";
}

async function digest(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function LoadingState() {
  return (
    <div className="loading-state" role="status">
      <span className="loading-mark" />
      <div>
        <strong>正在同步今日数据</strong>
        <p>连接三个品牌的销售、实收、广告与 SKU 明细</p>
      </div>
    </div>
  );
}

export function SalesDashboard() {
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [month, setMonth] = useState("2026-07");
  const [activeBrand, setActiveBrand] = useState<"ALL" | BrandKey>("ALL");
  const [brands, setBrands] = useState<BrandMetric[]>([]);
  const [movers, setMovers] = useState<SkuMover[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setUnlocked(sessionStorage.getItem("tw-sp-dashboard") === "unlocked");
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    let cancelled = false;
    const period = periodFor(month);

    async function loadData() {
      setLoading(true);
      setError("");
      try {
        const brandResults = await Promise.all(
          BRAND_CONFIG.map(async (brand) => {
            const salesQuery = `select ${brand.shopDateCol},sum(${brand.shopSalesCol}) where ${brand.shopDateCol} >= date '${period.start}' and ${brand.shopDateCol} <= date '${period.end}' group by ${brand.shopDateCol} order by ${brand.shopDateCol} label sum(${brand.shopSalesCol}) ''`;
            const previousQuery = `select sum(${brand.shopSalesCol}) where ${brand.shopDateCol} >= date '${period.previousStart}' and ${brand.shopDateCol} <= date '${period.previousEnd}' label sum(${brand.shopSalesCol}) ''`;
            const actualQuery = `select sum(${brand.dmsGmvCol}) where A >= date '${period.start}' and A <= date '${period.end}' label sum(${brand.dmsGmvCol}) ''`;
            const adsQuery = `select sum(${brand.adsSpendCol}) where ${brand.adsDateCol} >= date '${period.start}' and ${brand.adsDateCol} <= date '${period.end}' label sum(${brand.adsSpendCol}) ''`;
            const [dailyRows, previousRows, actualRows, adsRows] =
              await Promise.all([
                fetchGviz(brand.shopSheet, salesQuery),
                fetchGviz(brand.shopSheet, previousQuery),
                fetchGviz(brand.dmsSheet, actualQuery),
                fetchGviz(brand.adsSheet, adsQuery),
              ]);
            return {
              key: brand.key,
              name: brand.name,
              goal: month === "2026-07" ? brand.goal : 0,
              sales: dailyRows.reduce((sum, row) => sum + valueAt(row, 1), 0),
              previousSales: valueAt(previousRows[0], 0),
              actualGmv: valueAt(actualRows[0], 0),
              adSpend: valueAt(adsRows[0], 0),
              trend: dailyRows.map((row) => valueAt(row, 1)),
            } satisfies BrandMetric;
          }),
        );

        const skuQuery = `select E,F,sum(C) where A >= date '${period.start}' and A <= date '${period.end}' group by E,F label sum(C) ''`;
        const previousSkuQuery = `select E,F,sum(C) where A >= date '${period.previousStart}' and A <= date '${period.previousEnd}' group by E,F label sum(C) ''`;
        const [currentSkuRows, previousSkuRows] = await Promise.all([
          fetchGviz("三品牌SKU銷量", skuQuery),
          fetchGviz("三品牌SKU銷量", previousSkuQuery),
        ]);
        const previousMap = new Map<string, number>();
        previousSkuRows.forEach((row) => {
          const brand = String(row.c?.[0]?.v || "") as BrandKey;
          const name = String(row.c?.[1]?.v || "未命名商品");
          previousMap.set(`${brand}::${name}`, valueAt(row, 2));
        });
        const skuMovers = currentSkuRows
          .map((row) => {
            const brand = String(row.c?.[0]?.v || "") as BrandKey;
            const name = String(row.c?.[1]?.v || "未命名商品");
            const current = valueAt(row, 2);
            const previous = previousMap.get(`${brand}::${name}`) || 0;
            return {
              brand,
              name,
              current,
              previous,
              delta: current - previous,
              rate: previous > 0 ? (current - previous) / previous : null,
            } satisfies SkuMover;
          })
          .filter((item) => ["SKT", "G2G", "TP"].includes(item.brand));

        if (!cancelled) {
          setBrands(brandResults);
          setMovers(skuMovers);
          setUpdatedAt(new Date());
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "数据同步失败，请稍后重试",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadData();
    return () => {
      cancelled = true;
    };
  }, [month, refreshKey, unlocked]);

  const visibleBrands = useMemo(
    () =>
      activeBrand === "ALL"
        ? brands
        : brands.filter((brand) => brand.key === activeBrand),
    [activeBrand, brands],
  );
  const visibleMovers = useMemo(
    () =>
      activeBrand === "ALL"
        ? movers
        : movers.filter((item) => item.brand === activeBrand),
    [activeBrand, movers],
  );
  const totals = useMemo(() => {
    const sales = visibleBrands.reduce((sum, brand) => sum + brand.sales, 0);
    const goal = visibleBrands.reduce((sum, brand) => sum + brand.goal, 0);
    const previous = visibleBrands.reduce(
      (sum, brand) => sum + brand.previousSales,
      0,
    );
    const actual = visibleBrands.reduce(
      (sum, brand) => sum + brand.actualGmv,
      0,
    );
    const spend = visibleBrands.reduce((sum, brand) => sum + brand.adSpend, 0);
    return {
      sales,
      goal,
      previous,
      achievement: goal > 0 ? sales / goal : 0,
      change: previous > 0 ? (sales - previous) / previous : 0,
      roi: spend > 0 ? actual / spend : 0,
      spend,
    };
  }, [visibleBrands]);

  const gainers = [...visibleMovers]
    .filter((item) => item.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 6);
  const decliners = [...visibleMovers]
    .filter((item) => item.delta < 0)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 6);
  const selectedPeriod = periodFor(month);

  async function unlock(event: FormEvent) {
    event.preventDefault();
    if ((await digest(password)) === PASSWORD_HASH) {
      sessionStorage.setItem("tw-sp-dashboard", "unlocked");
      setPasswordError("");
      setUnlocked(true);
    } else {
      setPasswordError("密码不正确，请重新输入");
    }
  }

  if (!unlocked) {
    return (
      <main className="gate">
        <section className="gate-card">
          <div className="gate-signal">
            <span />
            <span />
            <span />
          </div>
          <p className="eyebrow">TAIWAN · SALES CONTROL</p>
          <h1>三品牌销售<br />作战室</h1>
          <p className="gate-copy">
            每日追踪 SKINTIFIC、GLAD2GLOW 与 TIME PHORIA 的销售目标、ROI
            和商品动向。
          </p>
          <form onSubmit={unlock}>
            <label htmlFor="dashboard-password">访问密码</label>
            <div className="password-row">
              <input
                id="dashboard-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="输入团队密码"
                aria-describedby={passwordError ? "password-error" : undefined}
              />
              <button type="submit">进入看板</button>
            </div>
            {passwordError && (
              <p className="form-error" id="password-error">
                {passwordError}
              </p>
            )}
          </form>
          <p className="gate-note">轻量访问保护 · 数据来自每日更新的 Google Sheet</p>
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard">
      <header className="topbar">
        <div>
          <p className="eyebrow">TAIWAN · THREE-BRAND SALES</p>
          <h1>销售作战室</h1>
        </div>
        <div className="topbar-controls">
          <label className="month-control">
            <span>统计月份</span>
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            />
          </label>
          <button
            className="refresh-button"
            onClick={() => setRefreshKey((key) => key + 1)}
            disabled={loading}
          >
            {loading ? "同步中" : "刷新数据"}
          </button>
        </div>
      </header>

      <nav className="brand-tabs" aria-label="品牌筛选">
        {(["ALL", "SKT", "G2G", "TP"] as const).map((brand) => (
          <button
            key={brand}
            className={activeBrand === brand ? "active" : ""}
            onClick={() => setActiveBrand(brand)}
          >
            {brand === "ALL" ? "三品牌总览" : brand}
          </button>
        ))}
        <span className="sync-state">
          <i className={error ? "error-dot" : ""} />
          {updatedAt
            ? `更新于 ${updatedAt.toLocaleTimeString("zh-TW", {
                hour: "2-digit",
                minute: "2-digit",
              })}`
            : "等待首次同步"}
        </span>
      </nav>

      {loading && brands.length === 0 ? (
        <LoadingState />
      ) : (
        <>
          {error && (
            <div className="data-alert" role="alert">
              <strong>数据暂时未能同步</strong>
              <span>{error}</span>
              <button onClick={() => setRefreshKey((key) => key + 1)}>
                再试一次
              </button>
            </div>
          )}

          <section className="hero-grid">
            <article className="hero-score">
              <div className="hero-label">
                <span>{month.replace("-", "年")}月 MTD</span>
                <small>截至 {selectedPeriod.cutoffDay} 日</small>
              </div>
              <div className="hero-number">
                <span>NT$</span>
                {formatTwd(totals.sales, true)}
              </div>
              <p>
                {totals.goal > 0
                  ? `距离目标还差 NT$ ${formatTwd(Math.max(0, totals.goal - totals.sales), true)}`
                  : "该月份尚未配置销售目标"}
              </p>
            </article>

            <div className="summary-strip">
              <div>
                <span>目标达成</span>
                <strong>{totals.goal > 0 ? `${(totals.achievement * 100).toFixed(1)}%` : "—"}</strong>
                <em className={totals.achievement >= 1 ? "positive" : "watch"}>
                  {totals.achievement >= 1 ? "已越线" : "追踪中"}
                </em>
              </div>
              <div>
                <span>站内综合 ROI</span>
                <strong>{formatRoi(totals.roi)}</strong>
                <em>实收 GMV / 广告花费</em>
              </div>
              <div>
                <span>较上月同期</span>
                <strong className={totals.change >= 0 ? "positive" : "negative"}>
                  {formatPercent(totals.change)}
                </strong>
                <em>同日进度比较</em>
              </div>
              <div>
                <span>站内广告花费</span>
                <strong>NT$ {formatTwd(totals.spend, true)}</strong>
                <em>站外花费待接入</em>
              </div>
            </div>
          </section>

          <section className="runway-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">BRAND TARGET RUNWAYS</p>
                <h2>三品牌目标赛程</h2>
              </div>
              <p>进度以 7 月目标 GMV 为终点线</p>
            </div>
            <div className="runways">
              {visibleBrands.map((brand) => {
                const achievement =
                  brand.goal > 0 ? brand.sales / brand.goal : 0;
                const change =
                  brand.previousSales > 0
                    ? (brand.sales - brand.previousSales) / brand.previousSales
                    : 0;
                const roi =
                  brand.adSpend > 0 ? brand.actualGmv / brand.adSpend : 0;
                const maxTrend = Math.max(...brand.trend, 1);
                return (
                  <article className={`runway ${brand.key.toLowerCase()}`} key={brand.key}>
                    <div className="brand-lockup">
                      <span className="brand-code">{brand.key}</span>
                      <div>
                        <strong>{brand.name}</strong>
                        <small>目标 NT$ {formatTwd(brand.goal, true)}</small>
                      </div>
                    </div>
                    <div className="track-block">
                      <div className="track-meta">
                        <strong>NT$ {formatTwd(brand.sales, true)}</strong>
                        <span>{brand.goal > 0 ? `${(achievement * 100).toFixed(1)}%` : "未设目标"}</span>
                      </div>
                      <div className="track" aria-label={`${brand.key} 目标达成`}>
                        <span style={{ width: `${Math.min(achievement * 100, 100)}%` }} />
                        <i />
                      </div>
                      <div className="micro-trend" aria-hidden="true">
                        {brand.trend.slice(-24).map((value, index) => (
                          <span
                            key={`${brand.key}-${index}`}
                            style={{ height: `${Math.max(5, (value / maxTrend) * 100)}%` }}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="runway-stat">
                      <span>ROI</span>
                      <strong>{formatRoi(roi)}</strong>
                    </div>
                    <div className="runway-stat">
                      <span>环比</span>
                      <strong className={change >= 0 ? "positive" : "negative"}>
                        {formatPercent(change)}
                      </strong>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="movers-grid">
            <article className="mover-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">SKU MOMENTUM</p>
                  <h2>增长最快</h2>
                </div>
                <span className="gain-chip">较上月同期</span>
              </div>
              <div className="mover-list">
                {gainers.length ? (
                  gainers.map((item, index) => (
                    <div className="mover-row" key={`${item.brand}-${item.name}`}>
                      <span className="rank">{String(index + 1).padStart(2, "0")}</span>
                      <div className="mover-name">
                        <strong>{item.name}</strong>
                        <small>{item.brand} · 本期 {formatTwd(item.current)} 件</small>
                      </div>
                      <div className="mover-value positive">
                        <strong>+{formatTwd(item.delta)}</strong>
                        <small>{item.rate === null ? "新品" : formatPercent(item.rate)}</small>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="empty-copy">当前筛选下暂无增长 SKU</p>
                )}
              </div>
            </article>

            <article className="mover-panel danger-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">SKU RISK RADAR</p>
                  <h2>下跌最明显</h2>
                </div>
                <span className="risk-chip">优先复盘</span>
              </div>
              <div className="mover-list">
                {decliners.length ? (
                  decliners.map((item, index) => (
                    <div className="mover-row" key={`${item.brand}-${item.name}`}>
                      <span className="rank">{String(index + 1).padStart(2, "0")}</span>
                      <div className="mover-name">
                        <strong>{item.name}</strong>
                        <small>{item.brand} · 本期 {formatTwd(item.current)} 件</small>
                      </div>
                      <div className="mover-value negative">
                        <strong>{formatTwd(item.delta)}</strong>
                        <small>{item.rate === null ? "—" : formatPercent(item.rate)}</small>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="empty-copy">当前筛选下暂无下跌 SKU</p>
                )}
              </div>
            </article>
          </section>

          <footer>
            <span>数据源：台湾 SP 三品牌数据表</span>
            <span>ROI 暂含站内广告花费 · 站外投放接入后将自动扩展</span>
          </footer>
        </>
      )}
    </main>
  );
}
