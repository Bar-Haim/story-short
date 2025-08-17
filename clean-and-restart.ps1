Write-Host "Cleaning .next directory..." -ForegroundColor Yellow
if (Test-Path ".next") {
    Remove-Item -Recurse -Force ".next"
    Write-Host ".next directory removed" -ForegroundColor Green
} else {
    Write-Host ".next directory not found" -ForegroundColor Gray
}

Write-Host "Starting dev server..." -ForegroundColor Yellow
npm run dev 