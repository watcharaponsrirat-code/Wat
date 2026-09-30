$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$manifest = Get-Content -Encoding UTF8 -LiteralPath (Join-Path $PSScriptRoot 'manifest.json') -Raw | ConvertFrom-Json
$missing = @()
$invalid = @()
$checked = 0
foreach ($section in $manifest.sections) {
  foreach ($extension in @('.png', '.jpg')) {
    $name = [IO.Path]::ChangeExtension([IO.Path]::GetFileName($section.file), $extension)
    $path = Join-Path $PSScriptRoot $name
    if (!(Test-Path -LiteralPath $path)) { $missing += $name; continue }
    try {
      $picture = [Drawing.Image]::FromFile($path)
      try {
        if ($picture.Width -ne 1536 -or $picture.Height -ne 1024) {
          $invalid += "$name : $($picture.Width)x$($picture.Height)"
        }
        $checked++
      } finally { $picture.Dispose() }
    } catch { $invalid += "$name : cannot decode" }
  }
}
$result = [ordered]@{
  sections = $manifest.sections.Count
  filesChecked = $checked
  missing = $missing
  invalid = $invalid
  checkedAt = (Get-Date).ToString('o')
}
$json = $result | ConvertTo-Json -Depth 4
[IO.File]::WriteAllText((Join-Path $PSScriptRoot 'validation.json'), $json, [Text.UTF8Encoding]::new($false))
Write-Output $json
if ($missing.Count -gt 0 -or $invalid.Count -gt 0) { exit 1 }
