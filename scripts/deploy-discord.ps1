param(
  [string]$Commit = "HEAD",
  [string]$SshHost = "ryukomik@103.103.22.251",
  [string]$RemoteRoot = "/home/ryukomik/Anon-Chat-Game",
  [string]$KeyPath = "$env:USERPROFILE\.ssh\Ryukomikssh.pem"
)

$ErrorActionPreference = "Stop"

$commitSha = (git rev-parse --verify "$Commit^{commit}").Trim()
if ($LASTEXITCODE -ne 0 -or $commitSha -notmatch '^[0-9a-f]{40}$') {
  throw "Commit tidak valid: $Commit"
}

$deletedFiles = @(git diff-tree --no-commit-id --name-only --diff-filter=D -r $commitSha)
if ($deletedFiles.Count -gt 0) {
  throw "Deploy dibatalkan: commit menghapus file ($($deletedFiles -join ', ')). Tangani penghapusan secara manual."
}

$changedFiles = @(git diff-tree --no-commit-id --name-only --diff-filter=ACMRT -r $commitSha)
if ($changedFiles.Count -eq 0) {
  throw "Commit tidak memiliki file untuk dideploy."
}

$archiveName = "anon-chat-discord-$($commitSha.Substring(0, 12)).tar"
$archivePath = Join-Path ([System.IO.Path]::GetTempPath()) $archiveName
$remoteArchive = "/tmp/$archiveName"

try {
  & git archive --format=tar -o $archivePath $commitSha -- @changedFiles
  if ($LASTEXITCODE -ne 0) { throw "Gagal membuat arsip commit." }

  & scp -i $KeyPath $archivePath "${SshHost}:$remoteArchive"
  if ($LASTEXITCODE -ne 0) { throw "Gagal mengunggah arsip deploy." }

  $remoteCommand = "set -e; tar -xf '$remoteArchive' -C '$RemoteRoot'; cd '$RemoteRoot'; node --check discord-bot.js; node --check src/rpg/longDungeon.js; npm test; pm2 restart anon-chat-discord; pm2 describe anon-chat-discord | sed -n '1,24p'; rm -f '$remoteArchive'"
  & ssh -i $KeyPath $SshHost $remoteCommand
  if ($LASTEXITCODE -ne 0) { throw "Validasi atau restart VPS gagal." }
} finally {
  if (Test-Path -LiteralPath $archivePath) {
    Remove-Item -LiteralPath $archivePath -Force
  }
}
