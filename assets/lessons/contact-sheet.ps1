param([int]$Offset=0,[int]$Count=12)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$manifest=Get-Content -Raw -Encoding UTF8 (Join-Path $PSScriptRoot 'manifest.json')|ConvertFrom-Json
$items=@($manifest.sections|Select-Object -Skip $Offset -First $Count)
$width=1200
$cellWidth=400
$cellHeight=300
$height=[int]([Math]::Ceiling($items.Count/3)*$cellHeight)
$canvas=New-Object System.Drawing.Bitmap($width,$height)
$graphics=[System.Drawing.Graphics]::FromImage($canvas)
$graphics.Clear([System.Drawing.Color]::White)
$graphics.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$font=New-Object System.Drawing.Font('Tahoma',12)
for($i=0;$i -lt $items.Count;$i++){
  $item=$items[$i]
  $path=Join-Path $PSScriptRoot ([System.IO.Path]::GetFileName($item.file))
  $x=($i%3)*$cellWidth
  $y=[Math]::Floor($i/3)*$cellHeight
  if(Test-Path -LiteralPath $path){
    $picture=[System.Drawing.Image]::FromFile($path)
    $graphics.DrawImage($picture,[int]$x,[int]$y,400,267)
    $picture.Dispose()
  }
  $graphics.DrawString(($item.code+' '+$item.title),$font,[System.Drawing.Brushes]::Black,[single]($x+5),[single]($y+270))
}
$qa=Join-Path $PSScriptRoot 'qa'
[System.IO.Directory]::CreateDirectory($qa)|Out-Null
$output=Join-Path $qa ('contact-'+$Offset+'.jpg')
$canvas.Save($output,[System.Drawing.Imaging.ImageFormat]::Jpeg)
$font.Dispose()
$graphics.Dispose()
$canvas.Dispose()
Write-Output $output
