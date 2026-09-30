$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$codec = [Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg'
$options = [Drawing.Imaging.EncoderParameters]::new(1)
$options.Param[0] = [Drawing.Imaging.EncoderParameter]::new([Drawing.Imaging.Encoder]::Quality, [long]88)
$count = 0
foreach ($file in Get-ChildItem -LiteralPath $PSScriptRoot -Filter '*.png') {
  $destination = [IO.Path]::ChangeExtension($file.FullName, '.jpg')
  if ((Test-Path -LiteralPath $destination) -and (Get-Item -LiteralPath $destination).LastWriteTime -ge $file.LastWriteTime) { continue }
  $source = [Drawing.Image]::FromFile($file.FullName)
  try {
    $bitmap = [Drawing.Bitmap]::new(320, 320)
    try {
      $graphics = [Drawing.Graphics]::FromImage($bitmap)
      try {
        $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.Clear([Drawing.Color]::White)
        $graphics.DrawImage($source, 0, 0, 320, 320)
      } finally { $graphics.Dispose() }
      $bitmap.Save($destination, $codec, $options)
      $count++
    } finally { $bitmap.Dispose() }
  } finally { $source.Dispose() }
}
$options.Dispose()
Write-Output "Prepared $count unit thumbnails."
