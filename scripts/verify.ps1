# verify.ps1 — 文档仓 L1/L2 结构校验（幂等）
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$errors = @()

function Fail($msg) { $script:errors += $msg }

# required top-level
foreach ($p in @('AGENTS.md','PROGRESS.md','DECISIONS.md','QUALITY.md','docs/harness/INIT.md','docs/harness/VERIFY.md','docs/harness/feature-list.md','docs/schemas/feature.schema.json','docs/journey/user-journey.md','docs/contracts/p0-contracts.md','docs/tech-stack.md')) {
  if (-not (Test-Path $p)) { Fail "missing $p" }
}

# modules
$mods = Get-ChildItem -Directory modules -ErrorAction SilentlyContinue
if (-not $mods -or $mods.Count -lt 8) { Fail "expected >=8 modules" }
foreach ($m in $mods) {
  if (-not (Test-Path (Join-Path $m.FullName 'MODULE.md'))) { Fail "$($m.Name): missing MODULE.md" }
  if (-not (Test-Path (Join-Path $m.FullName 'ROUTING.md'))) { Fail "$($m.Name): missing ROUTING.md" }
}

# features
$ids = @()
$active = 0
$passing = 0
foreach ($f in Get-ChildItem -Directory features -ErrorAction SilentlyContinue) {
  $jsonPath = Join-Path $f.FullName 'feature.json'
  $scPath = Join-Path $f.FullName 'SCENARIO.md'
  if (-not (Test-Path $jsonPath)) { Fail "$($f.Name): missing feature.json"; continue }
  if (-not (Test-Path $scPath)) { Fail "$($f.Name): missing SCENARIO.md" }
  try { $data = Get-Content $jsonPath -Raw -Encoding UTF8 | ConvertFrom-Json } catch { Fail "$($f.Name): invalid JSON"; continue }
  foreach ($k in @('id','title','summary','status','domain','kind','priority','modules','depends_on','acceptance','docs')) {
    if (-not ($data.PSObject.Properties.Name -contains $k)) { Fail "$($f.Name): missing field $k" }
  }
  $ids += $data.id
  $hs = $null
  if ($data.PSObject.Properties.Name -contains 'harness' -and $data.harness) { $hs = $data.harness.status }
  if ($hs -eq 'active') { $active++ }
  if ($hs -eq 'passing') { $passing++ }
  # method refs soft-check: if methods listed, method file should exist when ref has module
  if ($data.methods) {
    foreach ($mref in $data.methods) {
      $ref = $mref.ref
      if ($ref -match '^([a-z]+)\.([a-z0-9_]+)$') {
        $mod = $Matches[1]; $meth = $Matches[2]
        $mp = "modules/$mod/methods/$meth.md"
        if (-not (Test-Path $mp) -and $mref.role -eq 'define') {
          Fail "$($f.Name): define method missing $mp"
        }
      }
    }
  }
}

if ($active -gt 1) { Fail "WIP violation: $active active features (max 1)" }

# feature-list index existence
$fl = 'docs/harness/feature-list.md'
if (Test-Path $fl) {
  $text = Get-Content $fl -Raw -Encoding UTF8
  foreach ($id in $ids) {
    if ($text -notmatch [regex]::Escape($id)) { Fail "feature-list.md missing $id" }
  }
}

if ($errors.Count -gt 0) {
  Write-Host "VERIFY FAIL ($($errors.Count))" -ForegroundColor Red
  $errors | ForEach-Object { Write-Host " - $_" }
  exit 1
}
Write-Host "VERIFY PASS  features=$($ids.Count) modules=$($mods.Count) active=$active passing=$passing"
exit 0
