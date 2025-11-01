# Release Script for Question Analyzer
# This script handles git operations for creating a release

# Set UTF-8 encoding
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$env:LC_ALL = "C.UTF-8"

Write-Host "=== Question Analyzer Release Script ===" -ForegroundColor Cyan
Write-Host ""

# Get current directory
$projectDir = Get-Location
Write-Host "Working directory: $projectDir" -ForegroundColor Yellow
Write-Host ""

# Check git status
Write-Host "Checking git status..." -ForegroundColor Green
git status
Write-Host ""

# Add all changes
Write-Host "Adding all changes..." -ForegroundColor Green
git add .
Write-Host ""

# Show what will be committed
Write-Host "Files to be committed:" -ForegroundColor Green
git status --short
Write-Host ""

# Commit changes
$commitMessage = "release: v0.5 - Add Supabase configuration docs and improve error handling"
Write-Host "Committing changes with message: $commitMessage" -ForegroundColor Green
git commit -m $commitMessage
Write-Host ""

# Create tag
$tagName = "v0.5"
$tagMessage = "Release v0.5

Features:
- AI-powered question analysis with Gemini Nano
- Misconception bank with smart deduplication
- Support for 13 AP subjects
- Optional Supabase cloud sync
- LaTeX rendering support

Changes in this release:
- Added Supabase configuration documentation
- Created supabase-config.example.js template
- Improved error handling for missing Supabase config
- Extension can now run in local-only mode without Supabase
- Updated README with configuration instructions
"

Write-Host "Creating tag: $tagName" -ForegroundColor Green
git tag -a $tagName -m $tagMessage
Write-Host ""

# Show tags
Write-Host "Current tags:" -ForegroundColor Green
git tag
Write-Host ""

# Push to remote
Write-Host "Pushing commits to remote..." -ForegroundColor Green
git push origin main
Write-Host ""

Write-Host "Pushing tags to remote..." -ForegroundColor Green
git push origin --tags
Write-Host ""

Write-Host "=== Release Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Go to GitHub repository" -ForegroundColor White
Write-Host "2. Navigate to Releases > Draft a new release" -ForegroundColor White
Write-Host "3. Select tag: $tagName" -ForegroundColor White
Write-Host "4. Add release notes and upload dist/ folder as assets" -ForegroundColor White
Write-Host "5. Publish the release" -ForegroundColor White
Write-Host ""

