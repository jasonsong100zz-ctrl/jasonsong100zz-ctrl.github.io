#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-id-g2g}"
DATASET="${DATASET:-tw}"
REGION="${REGION:-asia-east1}"
SERVICE="${SERVICE:-tw-offsite-api}"
OFFSITE_USD_TO_CNY="${OFFSITE_USD_TO_CNY:-7.2}"
REPO_URL="${REPO_URL:-https://github.com/jasonsong100zz-ctrl/jasonsong100zz-ctrl.github.io.git}"
WORKDIR="/tmp/tw-dashboard-api-deploy"

gcloud config set project "${PROJECT_ID}" >/dev/null
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com bigquery.googleapis.com >/dev/null

bq --project_id="${PROJECT_ID}" query --use_legacy_sql=false "
CREATE OR REPLACE TABLE \`${PROJECT_ID}.${DATASET}.offsite_g2g_ads\` AS
SELECT * FROM \`${PROJECT_ID}.${DATASET}.raw_offsite_g2g_ads\`;

CREATE OR REPLACE TABLE \`${PROJECT_ID}.${DATASET}.offsite_skt_ads\` AS
SELECT * FROM \`${PROJECT_ID}.${DATASET}.raw_offsite_skt_ads\`;

CREATE OR REPLACE TABLE \`${PROJECT_ID}.${DATASET}.offsite_tp_ads\` AS
SELECT * FROM \`${PROJECT_ID}.${DATASET}.raw_offsite_tp_ads\`;

CREATE OR REPLACE TABLE \`${PROJECT_ID}.${DATASET}.product_map\` AS
SELECT * FROM \`${PROJECT_ID}.${DATASET}.raw_product_map\`;
"

PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"
RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
gcloud projects add-iam-policy-binding "${PROJECT_ID}" --member="serviceAccount:${RUNTIME_SA}" --role="roles/bigquery.jobUser" --quiet >/dev/null
gcloud projects add-iam-policy-binding "${PROJECT_ID}" --member="serviceAccount:${RUNTIME_SA}" --role="roles/bigquery.dataViewer" --quiet >/dev/null

rm -rf "${WORKDIR}"
git clone --depth=1 "${REPO_URL}" "${WORKDIR}" >/dev/null

gcloud run deploy "${SERVICE}" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --source="${WORKDIR}/api/offsite" \
  --allow-unauthenticated \
  --set-env-vars="GCP_PROJECT=${PROJECT_ID},BQ_DATASET=${DATASET},OFFSITE_USD_TO_CNY=${OFFSITE_USD_TO_CNY},ALLOWED_ORIGIN=*" \
  --quiet

API_URL="$(gcloud run services describe "${SERVICE}" --project="${PROJECT_ID}" --region="${REGION}" --format='value(status.url)')"

echo ""
echo "API_URL=${API_URL}"
echo "HEALTH_CHECK=${API_URL}/health"
echo "DATA_CHECK=${API_URL}/offsite?start=2026-07-01&end=2026-07-30"
