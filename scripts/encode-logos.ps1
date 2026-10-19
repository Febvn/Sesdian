$root = Split-Path $PSScriptRoot
$leftBytes = [IO.File]::ReadAllBytes("$root\Kemwnterian 1.jpg")
$rightBytes = [IO.File]::ReadAllBytes("$root\kementerian.jpg")
$leftB64 = [Convert]::ToBase64String($leftBytes)
$rightB64 = [Convert]::ToBase64String($rightBytes)

$js = @"
// Auto-generated logo data for QR print labels
var LOGO_LEFT = 'data:image/jpeg;base64,$leftB64';
var LOGO_RIGHT = 'data:image/jpeg;base64,$rightB64';
"@

$js | Out-File -Encoding utf8 "$root\public\assets\qr-logos.js"
Write-Host "Done. Left: $($leftB64.Length) chars, Right: $($rightB64.Length) chars"
