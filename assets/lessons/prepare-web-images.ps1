$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$codec=[System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders()|Where-Object {$_.MimeType -eq 'image/jpeg'}
$parameters=New-Object System.Drawing.Imaging.EncoderParameters(1)
$parameters.Param[0]=New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality,[long]88)
$count=0
foreach($file in Get-ChildItem -LiteralPath $PSScriptRoot -Filter '*.png'){
  $destination=[System.IO.Path]::ChangeExtension($file.FullName,'.jpg')
  if((Test-Path -LiteralPath $destination) -and (Get-Item -LiteralPath $destination).LastWriteTime -ge $file.LastWriteTime){continue}
  $picture=[System.Drawing.Image]::FromFile($file.FullName)
  try{$picture.Save($destination,$codec,$parameters);$count++}finally{$picture.Dispose()}
}
$parameters.Dispose()
Write-Output ('Prepared '+$count+' web images.')
