#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-id-g2g}"
DATASET="${DATASET:-tw}"
BQ_LOCATION="${BQ_LOCATION:-US}"

gcloud config set project "${PROJECT_ID}" >/dev/null
gcloud services enable bigquery.googleapis.com bigquerydatatransfer.googleapis.com >/dev/null

QUERY="$(cat <<SQL
CREATE OR REPLACE TABLE \`${PROJECT_ID}.${DATASET}.offsite_g2g_ads\` AS
SELECT * FROM \`${PROJECT_ID}.${DATASET}.raw_offsite_g2g_ads\`;

CREATE OR REPLACE TABLE \`${PROJECT_ID}.${DATASET}.offsite_skt_ads\` AS
SELECT * FROM \`${PROJECT_ID}.${DATASET}.raw_offsite_skt_ads\`;

CREATE OR REPLACE TABLE \`${PROJECT_ID}.${DATASET}.offsite_tp_ads\` AS
SELECT * FROM \`${PROJECT_ID}.${DATASET}.raw_offsite_tp_ads\`;

CREATE OR REPLACE TABLE \`${PROJECT_ID}.${DATASET}.product_map\` AS
SELECT * FROM \`${PROJECT_ID}.${DATASET}.raw_product_map\`;
SQL
)"

make_params() {
  QUERY_TEXT="${QUERY}" python3 - <<'PY'
import json
import os

print(json.dumps({"query": os.environ["QUERY_TEXT"]}, ensure_ascii=False))
PY
}

create_schedule() {
  local display_name="$1"
  local schedule="$2"
  local params
  params="$(make_params)"

  bq --project_id="${PROJECT_ID}" --location="${BQ_LOCATION}" mk \
    --transfer_config \
    --data_source=scheduled_query \
    --display_name="${display_name}" \
    --target_dataset="${DATASET}" \
    --schedule="${schedule}" \
    --params="${params}"
}

create_schedule "tw-offsite-refresh-1200-bjt" "every day 04:00"
create_schedule "tw-offsite-refresh-1800-bjt" "every day 10:00"

echo "Created BigQuery scheduled refreshes:"
echo "- tw-offsite-refresh-1200-bjt: Beijing/Taipei 12:00"
echo "- tw-offsite-refresh-1800-bjt: Beijing/Taipei 18:00"
