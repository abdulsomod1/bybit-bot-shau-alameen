# Generate 32 random bytes and convert to hex
$bytes = [byte[]]::new(32)
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$hex = [System.BitConverter]::ToString($bytes) -replace '-', ''
Write-Host $hex