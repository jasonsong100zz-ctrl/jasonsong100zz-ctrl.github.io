$ErrorActionPreference = "Stop"
$outputPath = if ($env:OFFLINE_SKU_OUTPUT) { $env:OFFLINE_SKU_OUTPUT } else { Join-Path $env:TEMP "offline_sku_sales.csv" }
$rawSuffix = "%E5%8E%9F%E5%A7%8B%E8%B3%87%E6%96%99%E8%A1%A8"
$sources = @(
  @{ Brand = "SKT"; SpreadsheetId = "1xEBYyD6q0rv2NNv2Ws7vJ5fKg4ZLbk6RCEoHeUsEqFE"; Sheets = @(@{ Encoded = "%E5%B1%88%E8%87%A3%E6%B0%8F-$rawSuffix"; Channel = "Watsons" }, @{ Encoded = "%E5%AF%B6%E9%9B%85-$rawSuffix"; Channel = "POYA" }, @{ Encoded = "%E5%BA%B7%E6%98%AF%E7%BE%8E-$rawSuffix"; Channel = "Cosmed" }, @{ Encoded = "%E6%97%A5%E8%97%A5-$rawSuffix"; Channel = "Nihon" }, @{ Encoded = "711-$rawSuffix"; Channel = "711" }, @{ Encoded = "momo-$rawSuffix"; Channel = "momo" }, @{ Encoded = "%E6%9D%BE%E6%9C%AC%E6%B8%85-$rawSuffix"; Channel = "Matsumoto" }) }
  @{ Brand = "G2G"; SpreadsheetId = "1d9tjvyVicHVN5Eb1CdLBOIV-V3O8YzWK7s5YUB33CLU"; Sheets = @(@{ Encoded = "%E5%B1%88%E8%87%A3%E6%B0%8F-$rawSuffix"; Channel = "Watsons" }, @{ Encoded = "%E5%AF%B6%E9%9B%85-$rawSuffix"; Channel = "POYA" }, @{ Encoded = "%E5%BA%B7%E6%98%AF%E7%BE%8E-$rawSuffix"; Channel = "Cosmed" }, @{ Encoded = "%E6%97%A5%E8%97%A5-$rawSuffix"; Channel = "Nihon" }, @{ Encoded = "MOMO-$rawSuffix"; Channel = "MOMO" }, @{ Encoded = "%E6%9D%BE%E6%9C%AC%E6%B8%85-$rawSuffix"; Channel = "Matsumoto" }) }
  @{ Brand = "TP"; SpreadsheetId = "16BHn3Lm1wP7ueh89Xb2Z6x4xYOFMX5p34wHZyz8xgdk"; Sheets = @(@{ Encoded = "%E5%B1%88%E8%87%A3%E6%B0%8F-$rawSuffix"; Channel = "Watsons" }) }
)

function Get-Cell($row, $index) { if ($null -eq $row.c[$index]) { return $null }; return $row.c[$index] }
function Get-Display($row, $index) { $cell = Get-Cell $row $index; if ($null -eq $cell) { return "" }; if ($cell.f) { return [string]$cell.f }; return [string]$cell.v }
function Get-DateText($row) {
  $cell = Get-Cell $row 0; if ($null -eq $cell) { return "" }; $raw = [string]$cell.v
  $match = [regex]::Match($raw, 'Date\((\d+),(\d+),(\d+)')
  if ($match.Success) { return "{0}-{1:D2}-{2:D2}" -f $match.Groups[1].Value, ([int]$match.Groups[2].Value + 1), [int]$match.Groups[3].Value }
  $parsed = [datetime]::Parse(($raw -replace '/', '-')); return $parsed.ToString('yyyy-MM-dd')
}

$groups = @{}
foreach ($source in $sources) {
  foreach ($sheet in $source.Sheets) {
    $columnMap = @{
      Watsons = @{ Date = "A"; Sku = "D"; Quantity = "F" }
      POYA = @{ Date = "A"; Sku = "B"; Quantity = "E" }
      Cosmed = @{ Date = "A"; Sku = "C"; Quantity = "F" }
      Nihon = @{ Date = "A"; Sku = "B"; Quantity = "E" }
      "711" = @{ Date = "A"; Sku = "B"; Quantity = "E" }
      momo = @{ Date = "A"; Sku = "D"; Quantity = "F" }
      Matsumoto = @{ Date = "A"; Sku = "B"; Quantity = "E" }
    }
    $columns = $columnMap[$sheet.Channel]
    if (!$columns) { throw "SKU column mapping not found: $($source.Brand) / $($sheet.Channel)" }
    $dateColumn = $columns.Date
    $skuColumn = $columns.Sku
    $quantityColumn = $columns.Quantity
    $query = [uri]::EscapeDataString("select $dateColumn,$skuColumn,$quantityColumn where $skuColumn is not null")
    $url = "https://docs.google.com/spreadsheets/d/$($source.SpreadsheetId)/gviz/tq?tqx=out:json&sheet=$($sheet.Encoded)&tq=$query"
    $raw = (Invoke-WebRequest -UseBasicParsing -TimeoutSec 60 $url).Content
    $payload = $raw.Substring($raw.IndexOf('{'), $raw.LastIndexOf('}') - $raw.IndexOf('{') + 1) | ConvertFrom-Json
    if ($payload.status -ne "ok") { throw "query failed: $($sheet.Channel)" }
    foreach ($row in $payload.table.rows) {
      $date = Get-DateText $row
      $id = (Get-Display $row 1).Trim()
      $quantityCell = Get-Cell $row 2
      $quantity = if ($null -eq $quantityCell) { 0 } else { [double]$quantityCell.v }
      if (!$date -or !$id -or !$quantityCell) { continue }
      $key = "$($source.Brand)|$($date.Substring(0,7))|$id|$($sheet.Channel)"
      if (!$groups.ContainsKey($key)) { $groups[$key] = [ordered]@{ brand = $source.Brand; month = $date.Substring(0,7); sku = $id; quantity = 0; channel = $sheet.Channel } }
      $groups[$key].quantity += $quantity
    }
  }
}

$rows = $groups.Values | ForEach-Object { [pscustomobject]@{ brand = $_.brand; month = $_.month; sku = $_.sku; quantity = [math]::Round([double]$_.quantity, 2); channel = $_.channel } } | Sort-Object brand, month, sku, channel
$rows | Export-Csv -Path $outputPath -NoTypeInformation -Encoding utf8
Write-Output (ConvertTo-Json @{ outputPath = $outputPath; rows = @($rows).Count; brands = @($rows.brand | Select-Object -Unique) })
