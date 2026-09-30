$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$encoding = [Text.UTF8Encoding]::new($false)
$manifestPath = Join-Path $PSScriptRoot 'manifest.json'
$manifest = [IO.File]::ReadAllText($manifestPath) | ConvertFrom-Json
$records = Get-Content -Encoding UTF8 -LiteralPath (Join-Path $PSScriptRoot 'generation-refinements.jsonl') | ForEach-Object { $_ | ConvertFrom-Json }
$selected = @{}
foreach ($record in $records) {
  if (Test-Path -LiteralPath (Join-Path $root $record.file)) { $selected[$record.id] = $record }
}
$galleryPath = Join-Path $PSScriptRoot 'gallery.html'
$gallery = [IO.File]::ReadAllText($galleryPath)
foreach ($section in $manifest.sections) {
  $key = $section.id + '-' + ($section.index + 1).ToString('00')
  if (!$selected.ContainsKey($key)) { continue }
  $record = $selected[$key]
  $section.file = $record.file
  $section.prompt = $record.prompt
  $gallery = $gallery.Replace('"' + $key + '.png"', '"' + $key + '-v2.png"').Replace('"' + $key + '.jpg"', '"' + $key + '-v2.jpg"')
}
[IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 6), $encoding)
[IO.File]::WriteAllText($galleryPath, $gallery, $encoding)
$pagePath = Join-Path $root 'index.html'
$page = [IO.File]::ReadAllText($pagePath)
$keys = @($selected.Keys | Sort-Object)
$declaration = 'const REFINED_LESSON_IMAGES=new Set(' + (ConvertTo-Json -InputObject $keys -Compress) + ');'
if ($page.Contains('const REFINED_LESSON_IMAGES=')) {
  $page = [regex]::Replace($page, 'const REFINED_LESSON_IMAGES=new Set\(\[.*?\]\);', $declaration)
} else {
  $page = $page.Replace('function infographic(sec,id){', $declaration + "`n" + 'function infographic(sec,id){')
  $old = "const src='assets/lessons/'+id+'-'+String(index+1).padStart(2,'0')+'.png';"
  $new = "const key=id+'-'+String(index+1).padStart(2,'0');const src='assets/lessons/'+key+(REFINED_LESSON_IMAGES.has(key)?'-v2':'')+'.png';"
  if (!$page.Contains($old)) { throw 'Image path code not found; no page changes written.' }
  $page = $page.Replace($old, $new)
}
[IO.File]::WriteAllText($pagePath, $page, $encoding)
Write-Output ('Selected ' + $keys.Count + ' refined images.')
