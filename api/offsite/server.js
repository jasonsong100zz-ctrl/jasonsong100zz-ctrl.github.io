import express from "express";
import cors from "cors";
import { BigQuery } from "@google-cloud/bigquery";

const PROJECT_ID = process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "id-g2g";
const DATASET = process.env.BQ_DATASET || "tw";
const TWD_TO_CNY = Number(process.env.TWD_TO_CNY || "0.21");
const PORT = Number(process.env.PORT || "8080");
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

const TABLES = {
  g2g: `\`${PROJECT_ID}.${DATASET}.offsite_g2g_ads\``,
  skt: `\`${PROJECT_ID}.${DATASET}.offsite_skt_ads\``,
  tp: `\`${PROJECT_ID}.${DATASET}.offsite_tp_ads\``,
  map: `\`${PROJECT_ID}.${DATASET}.product_map\``,
};

const app = express();
const bigquery = new BigQuery({ projectId: PROJECT_ID });

app.use(cors({ origin: ALLOWED_ORIGIN === "*" ? true : ALLOWED_ORIGIN }));

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function sql() {
  return `
CREATE TEMP FUNCTION norm_text(value STRING) AS (
  LOWER(REGEXP_REPLACE(
    TRANSLATE(COALESCE(value, ''), '氣墊體華復護膚潔顏兩組噴霧潤妝膠銀質煙醫麗亞鎖鍊鏈', '气垫体华复护肤洁颜两组喷雾润妆胶银质烟医丽亚锁链链'),
    r'[^[:alnum:]\p{Han}]+',
    ''
  ))
);

WITH product_map_unified AS (
  SELECT
    'G2G' AS brand,
    TRIM(g2g_id) AS link_id,
    TRIM(g2g_link_name) AS link_name,
    TRIM(g2g_category) AS category,
    TRIM(g2g_link_name) AS fb_product
  FROM ${TABLES.map}
  WHERE NULLIF(TRIM(g2g_id), '') IS NOT NULL OR NULLIF(TRIM(g2g_link_name), '') IS NOT NULL
  UNION ALL
  SELECT
    'SKT' AS brand,
    TRIM(skt_id) AS link_id,
    TRIM(skt_link_name) AS link_name,
    TRIM(skt_category) AS category,
    TRIM(skt_fb_product) AS fb_product
  FROM ${TABLES.map}
  WHERE NULLIF(TRIM(skt_id), '') IS NOT NULL OR NULLIF(TRIM(skt_fb_product), '') IS NOT NULL
  UNION ALL
  SELECT
    'SKT' AS brand,
    TRIM(skt_id) AS link_id,
    TRIM(skt_link_name) AS link_name,
    TRIM(skt_category) AS category,
    TRIM(skt_link_name) AS fb_product
  FROM ${TABLES.map}
  WHERE NULLIF(TRIM(skt_id), '') IS NOT NULL OR NULLIF(TRIM(skt_link_name), '') IS NOT NULL
  UNION ALL
  SELECT
    'TP' AS brand,
    TRIM(tp_id) AS link_id,
    TRIM(tp_link_name) AS link_name,
    TRIM(tp_category) AS category,
    TRIM(tp_link_name) AS fb_product
  FROM ${TABLES.map}
  WHERE NULLIF(TRIM(tp_id), '') IS NOT NULL OR NULLIF(TRIM(tp_link_name), '') IS NOT NULL
),
map_dedup AS (
  SELECT * EXCEPT(row_number)
  FROM (
    SELECT
      brand,
      link_id,
      link_name,
      category,
      fb_product,
      norm_text(COALESCE(NULLIF(fb_product, ''), link_name)) AS map_key,
      ROW_NUMBER() OVER (
        PARTITION BY brand, norm_text(COALESCE(NULLIF(fb_product, ''), link_name))
        ORDER BY IF(NULLIF(link_id, '') IS NULL, 1, 0), link_name
      ) AS row_number
    FROM product_map_unified
    WHERE NULLIF(TRIM(COALESCE(fb_product, link_name)), '') IS NOT NULL
  )
  WHERE row_number = 1
),
ads AS (
  SELECT
    'G2G' AS brand,
    COALESCE(SAFE.PARSE_DATE('%Y-%m-%d', TRIM(single_day)), SAFE.PARSE_DATE('%Y/%m/%d', TRIM(single_day)), SAFE.PARSE_DATE('%d/%m/%Y', TRIM(single_day))) AS date,
    TRIM(ecommerce_product_name) AS source_link_name,
    TRIM(ecommerce_category) AS source_category,
    SAFE_CAST(REGEXP_REPLACE(spend, r'[^0-9.-]', '') AS FLOAT64) * @rate AS offsite_spend,
    SAFE_CAST(REGEXP_REPLACE(impressions, r'[^0-9.-]', '') AS FLOAT64) AS impressions,
    SAFE_CAST(REGEXP_REPLACE(clicks, r'[^0-9.-]', '') AS FLOAT64) AS clicks,
    SAFE_CAST(REGEXP_REPLACE(purchase_value, r'[^0-9.-]', '') AS FLOAT64) * @rate AS purchase_value,
    CASE
      WHEN REGEXP_CONTAINS(CONCAT(IFNULL(ad_goal, ''), ' ', IFNULL(ad_type, ''), ' ', IFNULL(campaign_name, ''), ' ', IFNULL(ad_name, ''), ' ', IFNULL(ecommerce_product_name, ''), ' ', IFNULL(ecommerce_category, ''), ' ', IFNULL(material_type, ''), ' ', IFNULL(is_brand_budget, '')), r'品牌') THEN '品牌广告'
      WHEN REGEXP_CONTAINS(CONCAT(IFNULL(ad_goal, ''), ' ', IFNULL(ad_type, ''), ' ', IFNULL(campaign_name, ''), ' ', IFNULL(ad_name, ''), ' ', IFNULL(ecommerce_product_name, ''), ' ', IFNULL(ecommerce_category, ''), ' ', IFNULL(material_type, ''), ' ', IFNULL(is_brand_budget, '')), r'合创|合創|KOL|kol') THEN '合创'
      ELSE '图文'
    END AS spend_type
  FROM ${TABLES.g2g}
  UNION ALL
  SELECT
    'SKT' AS brand,
    COALESCE(SAFE.PARSE_DATE('%Y-%m-%d', TRIM(date_start)), SAFE.PARSE_DATE('%Y/%m/%d', TRIM(date_start)), SAFE.PARSE_DATE('%d/%m/%Y', TRIM(date_start))) AS date,
    TRIM(ecommerce_product_name) AS source_link_name,
    TRIM(category) AS source_category,
    SAFE_CAST(REGEXP_REPLACE(spend, r'[^0-9.-]', '') AS FLOAT64) * @rate AS offsite_spend,
    SAFE_CAST(REGEXP_REPLACE(impressions, r'[^0-9.-]', '') AS FLOAT64) AS impressions,
    SAFE_CAST(REGEXP_REPLACE(clicks, r'[^0-9.-]', '') AS FLOAT64) AS clicks,
    SAFE_CAST(REGEXP_REPLACE(purchase_value, r'[^0-9.-]', '') AS FLOAT64) * @rate AS purchase_value,
    CASE
      WHEN REGEXP_CONTAINS(CONCAT(IFNULL(ad_goal, ''), ' ', IFNULL(ad_type, ''), ' ', IFNULL(campaign_name, ''), ' ', IFNULL(adset_name, ''), ' ', IFNULL(ad_name, ''), ' ', IFNULL(category, ''), ' ', IFNULL(ecommerce_product_name, ''), ' ', IFNULL(ad_format_2, '')), r'品牌') THEN '品牌广告'
      WHEN REGEXP_CONTAINS(CONCAT(IFNULL(ad_goal, ''), ' ', IFNULL(ad_type, ''), ' ', IFNULL(campaign_name, ''), ' ', IFNULL(adset_name, ''), ' ', IFNULL(ad_name, ''), ' ', IFNULL(category, ''), ' ', IFNULL(ecommerce_product_name, ''), ' ', IFNULL(ad_format_2, '')), r'合创|合創|KOL|kol') THEN '合创'
      ELSE '图文'
    END AS spend_type
  FROM ${TABLES.skt}
  UNION ALL
  SELECT
    'TP' AS brand,
    COALESCE(SAFE.PARSE_DATE('%Y-%m-%d', TRIM(day)), SAFE.PARSE_DATE('%Y/%m/%d', TRIM(day)), SAFE.PARSE_DATE('%d/%m/%Y', TRIM(day))) AS date,
    TRIM(ecommerce_product_name) AS source_link_name,
    TRIM(category) AS source_category,
    SAFE_CAST(REGEXP_REPLACE(spend, r'[^0-9.-]', '') AS FLOAT64) * @rate AS offsite_spend,
    SAFE_CAST(REGEXP_REPLACE(impressions, r'[^0-9.-]', '') AS FLOAT64) AS impressions,
    SAFE_CAST(REGEXP_REPLACE(link_clicks, r'[^0-9.-]', '') AS FLOAT64) AS clicks,
    SAFE_CAST(REGEXP_REPLACE(purchase_value, r'[^0-9.-]', '') AS FLOAT64) * @rate AS purchase_value,
    CASE
      WHEN REGEXP_CONTAINS(CONCAT(IFNULL(report_ad_goal, ''), ' ', IFNULL(actual_ad_goal, ''), ' ', IFNULL(kol_type, ''), ' ', IFNULL(material_type, ''), ' ', IFNULL(material_source, ''), ' ', IFNULL(ad_mix, ''), ' ', IFNULL(campaign_name, ''), ' ', IFNULL(adset_name, ''), ' ', IFNULL(category, ''), ' ', IFNULL(ecommerce_product_name, '')), r'品牌') THEN '品牌广告'
      WHEN REGEXP_CONTAINS(CONCAT(IFNULL(report_ad_goal, ''), ' ', IFNULL(actual_ad_goal, ''), ' ', IFNULL(kol_type, ''), ' ', IFNULL(material_type, ''), ' ', IFNULL(material_source, ''), ' ', IFNULL(ad_mix, ''), ' ', IFNULL(campaign_name, ''), ' ', IFNULL(adset_name, ''), ' ', IFNULL(category, ''), ' ', IFNULL(ecommerce_product_name, '')), r'合创|合創|KOL|kol') THEN '合创'
      ELSE '图文'
    END AS spend_type
  FROM ${TABLES.tp}
),
ads_normalized AS (
  SELECT
    *,
    GENERATE_UUID() AS ad_row_id,
    norm_text(source_link_name) AS join_key
  FROM ads
  WHERE date BETWEEN DATE(@start) AND DATE(@end)
    AND (@brand = '' OR brand = @brand)
),
match_candidates AS (
  SELECT
    ads.*,
    map.link_id,
    map.link_name AS mapped_link_name,
    map.category AS mapped_category,
    CASE
      WHEN ads.join_key = map.map_key THEN 0
      WHEN STRPOS(map.map_key, ads.join_key) > 0 THEN 1
      WHEN STRPOS(ads.join_key, map.map_key) > 0 THEN 2
      ELSE 9
    END AS match_rank,
    COUNTIF(ads.join_key = map.map_key) OVER (PARTITION BY ads.ad_row_id) AS exact_match_count,
    COUNTIF(ads.join_key != map.map_key AND (STRPOS(map.map_key, ads.join_key) > 0 OR STRPOS(ads.join_key, map.map_key) > 0)) OVER (PARTITION BY ads.ad_row_id) AS fuzzy_match_count,
    ROW_NUMBER() OVER (
      PARTITION BY ads.ad_row_id
      ORDER BY
        CASE
          WHEN ads.join_key = map.map_key THEN 0
          WHEN STRPOS(map.map_key, ads.join_key) > 0 THEN 1
          WHEN STRPOS(ads.join_key, map.map_key) > 0 THEN 2
          ELSE 9
        END,
        LENGTH(map.map_key)
    ) AS candidate_rank
  FROM ads_normalized ads
  LEFT JOIN map_dedup map
    ON ads.brand = map.brand
   AND ads.join_key != ''
   AND (
     ads.join_key = map.map_key
     OR STRPOS(map.map_key, ads.join_key) > 0
     OR STRPOS(ads.join_key, map.map_key) > 0
   )
),
joined AS (
  SELECT
    brand,
    IF(REGEXP_CONTAINS(source_link_name, r'混合目录|混合目錄'), '', IF(match_rank = 0 OR (match_rank IN (1, 2) AND exact_match_count = 0 AND fuzzy_match_count = 1), COALESCE(link_id, ''), '')) AS link_id,
    IF(REGEXP_CONTAINS(source_link_name, r'混合目录|混合目錄'), '混合目录', COALESCE(NULLIF(source_link_name, ''), mapped_link_name, '未填写')) AS link_name,
    IF(REGEXP_CONTAINS(source_link_name, r'混合目录|混合目錄'), '', COALESCE(NULLIF(source_category, ''), mapped_category, '其他/赠品')) AS category,
    ads.spend_type,
    ads.offsite_spend,
    ads.impressions,
    ads.clicks,
    ads.purchase_value
  FROM match_candidates ads
  WHERE candidate_rank = 1
)
SELECT
  brand,
  link_id,
  link_name,
  category,
  SUM(COALESCE(offsite_spend, 0)) AS spend,
  SUM(COALESCE(impressions, 0)) AS impressions,
  SUM(COALESCE(clicks, 0)) AS clicks,
  SUM(COALESCE(purchase_value, 0)) AS purchase_value,
  SUM(IF(spend_type = '合创', COALESCE(offsite_spend, 0), 0)) AS co_create_spend,
  SUM(IF(spend_type = '图文', COALESCE(offsite_spend, 0), 0)) AS graphic_spend,
  SUM(IF(spend_type = '品牌广告', COALESCE(offsite_spend, 0), 0)) AS brand_ad_spend
FROM joined
GROUP BY brand, link_id, link_name, category
ORDER BY brand, spend DESC
`;
}

app.get("/health", (_request, response) => {
  response.json({ ok: true, projectId: PROJECT_ID, dataset: DATASET });
});

app.get("/schema", async (_request, response) => {
  try {
    const [rows] = await bigquery.query({
      query: `
SELECT table_name, column_name, ordinal_position
FROM \`${PROJECT_ID}.${DATASET}.INFORMATION_SCHEMA.COLUMNS\`
WHERE table_name IN ('offsite_g2g_ads', 'offsite_skt_ads', 'offsite_tp_ads', 'product_map')
ORDER BY table_name, ordinal_position
`,
      location: "US",
    });
    response.json({ rows });
  } catch (error) {
    console.error(error);
    response.status(500).json({
      error: "BigQuery schema query failed",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
});

function debugSql() {
  return `
CREATE TEMP FUNCTION norm_text(value STRING) AS (
  LOWER(REGEXP_REPLACE(
    TRANSLATE(COALESCE(value, ''), '氣墊體華復護膚潔顏兩組噴霧潤妝膠銀質煙醫麗亞鎖鍊鏈', '气垫体华复护肤洁颜两组喷雾润妆胶银质烟医丽亚锁链链'),
    r'[^[:alnum:]\p{Han}]+',
    ''
  ))
);

WITH product_map_unified AS (
  SELECT 'G2G' AS brand, TRIM(g2g_id) AS link_id, TRIM(g2g_link_name) AS link_name, TRIM(g2g_category) AS category, TRIM(g2g_link_name) AS alias FROM ${TABLES.map}
  UNION ALL SELECT 'SKT', TRIM(skt_id), TRIM(skt_link_name), TRIM(skt_category), TRIM(skt_link_name) FROM ${TABLES.map}
  UNION ALL SELECT 'SKT', TRIM(skt_id), TRIM(skt_link_name), TRIM(skt_category), TRIM(skt_fb_product) FROM ${TABLES.map}
  UNION ALL SELECT 'TP', TRIM(tp_id), TRIM(tp_link_name), TRIM(tp_category), TRIM(tp_link_name) FROM ${TABLES.map}
),
ads AS (
  SELECT 'G2G' AS brand, TRIM(ecommerce_product_name) AS source_name, TRIM(ecommerce_category) AS source_category FROM ${TABLES.g2g}
  UNION ALL SELECT 'SKT', TRIM(ecommerce_product_name), TRIM(category) FROM ${TABLES.skt}
  UNION ALL SELECT 'TP', TRIM(ecommerce_product_name), TRIM(category) FROM ${TABLES.tp}
)
SELECT 'map' AS source, brand, link_id, link_name, category, alias AS name, norm_text(alias) AS norm
FROM product_map_unified
WHERE (@brand = '' OR brand = @brand) AND norm_text(alias) LIKE CONCAT('%', norm_text(@q), '%')
UNION ALL
SELECT 'ads' AS source, brand, '' AS link_id, '' AS link_name, source_category AS category, source_name AS name, norm_text(source_name) AS norm
FROM ads
WHERE (@brand = '' OR brand = @brand) AND norm_text(source_name) LIKE CONCAT('%', norm_text(@q), '%')
ORDER BY source, brand, name
LIMIT 80
`;
}

app.get("/debug-match", async (request, response) => {
  const q = String(request.query.q || "");
  const brand = String(request.query.brand || "").toUpperCase();
  if (!q.trim()) {
    response.status(400).json({ error: "q is required" });
    return;
  }
  if (brand && !["SKT", "G2G", "TP"].includes(brand)) {
    response.status(400).json({ error: "brand must be SKT, G2G, TP or empty" });
    return;
  }
  try {
    const [rows] = await bigquery.query({
      query: debugSql(),
      location: "US",
      params: { q, brand },
    });
    response.json({ rows });
  } catch (error) {
    console.error(error);
    response.status(500).json({
      error: "BigQuery debug query failed",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
});

app.get("/offsite", async (request, response) => {
  const start = String(request.query.start || "");
  const end = String(request.query.end || "");
  const brand = String(request.query.brand || "").toUpperCase();

  if (!isIsoDate(start) || !isIsoDate(end)) {
    response.status(400).json({ error: "start/end must be YYYY-MM-DD" });
    return;
  }
  if (brand && !["SKT", "G2G", "TP"].includes(brand)) {
    response.status(400).json({ error: "brand must be SKT, G2G, TP or empty" });
    return;
  }

  try {
    const [rows] = await bigquery.query({
      query: sql(),
      location: "US",
      params: {
        start,
        end,
        brand,
        rate: TWD_TO_CNY,
      },
    });
    response.json({
      updatedAt: new Date().toISOString(),
      currency: "CNY",
      rows,
    });
  } catch (error) {
    console.error(error);
    response.status(500).json({
      error: "BigQuery query failed",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
});

app.listen(PORT, () => {
  console.log(`tw-offsite-api listening on ${PORT}`);
});
