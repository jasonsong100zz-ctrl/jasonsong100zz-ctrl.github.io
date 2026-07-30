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
WITH product_map_unified AS (
  SELECT
    UPPER(TRIM(g2g_brand)) AS brand,
    TRIM(g2g_id) AS link_id,
    TRIM(g2g_link_name) AS link_name,
    TRIM(g2g_category) AS category,
    TRIM(g2g_link_name) AS fb_product
  FROM ${TABLES.map}
  WHERE NULLIF(TRIM(g2g_id), '') IS NOT NULL OR NULLIF(TRIM(g2g_link_name), '') IS NOT NULL
  UNION ALL
  SELECT
    UPPER(TRIM(skt_brand)) AS brand,
    TRIM(skt_id) AS link_id,
    TRIM(skt_link_name) AS link_name,
    TRIM(skt_category) AS category,
    TRIM(skt_link_name) AS fb_product
  FROM ${TABLES.map}
  WHERE NULLIF(TRIM(skt_id), '') IS NOT NULL OR NULLIF(TRIM(skt_link_name), '') IS NOT NULL
  UNION ALL
  SELECT
    UPPER(TRIM(tp_brand)) AS brand,
    TRIM(tp_id) AS link_id,
    TRIM(tp_link_name) AS link_name,
    TRIM(tp_category) AS category,
    TRIM(tp_fb_product) AS fb_product
  FROM ${TABLES.map}
  WHERE NULLIF(TRIM(tp_id), '') IS NOT NULL OR NULLIF(TRIM(tp_link_name), '') IS NOT NULL OR NULLIF(TRIM(tp_fb_product), '') IS NOT NULL
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
      ROW_NUMBER() OVER (
        PARTITION BY brand, LOWER(REGEXP_REPLACE(COALESCE(NULLIF(fb_product, ''), link_name), r'[^[:alnum:]\p{Han}]+', ''))
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
    SAFE.PARSE_DATE('%Y-%m-%d', single_day) AS date,
    TRIM(ecommerce_product_name) AS source_link_name,
    TRIM(category) AS source_category,
    SAFE_CAST(REGEXP_REPLACE(spend, r'[^0-9.-]', '') AS FLOAT64) * @rate AS offsite_spend,
    SAFE_CAST(REGEXP_REPLACE(impressions, r'[^0-9.-]', '') AS FLOAT64) AS impressions,
    SAFE_CAST(REGEXP_REPLACE(clicks, r'[^0-9.-]', '') AS FLOAT64) AS clicks,
    SAFE_CAST(REGEXP_REPLACE(purchase_value, r'[^0-9.-]', '') AS FLOAT64) * @rate AS purchase_value,
    CASE
      WHEN REGEXP_CONTAINS(CONCAT(IFNULL(objective, ''), ' ', IFNULL(level, ''), ' ', IFNULL(attribution_setting, ''), ' ', IFNULL(outcome, ''), ' ', IFNULL(campaign_name, ''), ' ', IFNULL(ad_name, ''), ' ', IFNULL(ecommerce_product_name, ''), ' ', IFNULL(category, ''), ' ', IFNULL(cost_type, '')), r'品牌') THEN '品牌广告'
      WHEN REGEXP_CONTAINS(CONCAT(IFNULL(objective, ''), ' ', IFNULL(level, ''), ' ', IFNULL(attribution_setting, ''), ' ', IFNULL(outcome, ''), ' ', IFNULL(campaign_name, ''), ' ', IFNULL(ad_name, ''), ' ', IFNULL(ecommerce_product_name, ''), ' ', IFNULL(category, ''), ' ', IFNULL(cost_type, '')), r'合创|合創|KOL|kol') THEN '合创'
      ELSE '图文'
    END AS spend_type
  FROM ${TABLES.g2g}
  UNION ALL
  SELECT
    'SKT' AS brand,
    SAFE.PARSE_DATE('%Y-%m-%d', single_day) AS date,
    TRIM(ecommerce_product_name) AS source_link_name,
    TRIM(category) AS source_category,
    SAFE_CAST(REGEXP_REPLACE(spend, r'[^0-9.-]', '') AS FLOAT64) * @rate AS offsite_spend,
    SAFE_CAST(REGEXP_REPLACE(impressions, r'[^0-9.-]', '') AS FLOAT64) AS impressions,
    SAFE_CAST(REGEXP_REPLACE(clicks, r'[^0-9.-]', '') AS FLOAT64) AS clicks,
    SAFE_CAST(REGEXP_REPLACE(purchase_value, r'[^0-9.-]', '') AS FLOAT64) * @rate AS purchase_value,
    CASE
      WHEN REGEXP_CONTAINS(CONCAT(IFNULL(objective, ''), ' ', IFNULL(campaign_name, ''), ' ', IFNULL(adset_name, ''), ' ', IFNULL(ad_name, ''), ' ', IFNULL(category, ''), ' ', IFNULL(ecommerce_product_name, '')), r'品牌') THEN '品牌广告'
      WHEN REGEXP_CONTAINS(CONCAT(IFNULL(objective, ''), ' ', IFNULL(campaign_name, ''), ' ', IFNULL(adset_name, ''), ' ', IFNULL(ad_name, ''), ' ', IFNULL(category, ''), ' ', IFNULL(ecommerce_product_name, '')), r'合创|合創|KOL|kol') THEN '合创'
      ELSE '图文'
    END AS spend_type
  FROM ${TABLES.skt}
  UNION ALL
  SELECT
    'TP' AS brand,
    SAFE.PARSE_DATE('%Y-%m-%d', single_day) AS date,
    TRIM(ecommerce_product_name) AS source_link_name,
    TRIM(category) AS source_category,
    SAFE_CAST(REGEXP_REPLACE(spend, r'[^0-9.-]', '') AS FLOAT64) * @rate AS offsite_spend,
    SAFE_CAST(REGEXP_REPLACE(impressions, r'[^0-9.-]', '') AS FLOAT64) AS impressions,
    SAFE_CAST(REGEXP_REPLACE(clicks, r'[^0-9.-]', '') AS FLOAT64) AS clicks,
    SAFE_CAST(REGEXP_REPLACE(purchase_value, r'[^0-9.-]', '') AS FLOAT64) * @rate AS purchase_value,
    CASE
      WHEN REGEXP_CONTAINS(CONCAT(IFNULL(objective, ''), ' ', IFNULL(campaign_name, ''), ' ', IFNULL(adset_name, ''), ' ', IFNULL(category, ''), ' ', IFNULL(ecommerce_product_name, '')), r'品牌') THEN '品牌广告'
      WHEN REGEXP_CONTAINS(CONCAT(IFNULL(objective, ''), ' ', IFNULL(campaign_name, ''), ' ', IFNULL(adset_name, ''), ' ', IFNULL(category, ''), ' ', IFNULL(ecommerce_product_name, '')), r'合创|合創|KOL|kol') THEN '合创'
      ELSE '图文'
    END AS spend_type
  FROM ${TABLES.tp}
),
ads_normalized AS (
  SELECT
    *,
    LOWER(REGEXP_REPLACE(source_link_name, r'[^[:alnum:]\p{Han}]+', '')) AS join_key
  FROM ads
  WHERE date BETWEEN DATE(@start) AND DATE(@end)
    AND (@brand = '' OR brand = @brand)
),
joined AS (
  SELECT
    ads.brand,
    IF(REGEXP_CONTAINS(ads.source_link_name, r'混合目录|混合目錄'), '', COALESCE(map.link_id, '')) AS link_id,
    IF(REGEXP_CONTAINS(ads.source_link_name, r'混合目录|混合目錄'), '混合目录', COALESCE(map.link_name, ads.source_link_name, '未填写')) AS link_name,
    IF(REGEXP_CONTAINS(ads.source_link_name, r'混合目录|混合目錄'), '', COALESCE(map.category, ads.source_category, '其他/赠品')) AS category,
    ads.spend_type,
    ads.offsite_spend,
    ads.impressions,
    ads.clicks,
    ads.purchase_value
  FROM ads_normalized ads
  LEFT JOIN map_dedup map
    ON ads.brand = map.brand
   AND ads.join_key = LOWER(REGEXP_REPLACE(COALESCE(NULLIF(map.fb_product, ''), map.link_name), r'[^[:alnum:]\p{Han}]+', ''))
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
