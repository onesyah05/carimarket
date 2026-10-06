$ErrorActionPreference = 'Continue'
$keyPath = "$env:USERPROFILE\.ssh\carimarket_deploy_ed25519"
$cmd = 'ls -la /usr/bin/npm* 2>/dev/null; ls /usr/lib/node_modules 2>/dev/null; echo "=== COREPACK ==="; which corepack; echo "=== NPM IN NODE ==="; node -e "console.log(process.execPath)"; ls /usr/share/nodejs 2>/dev/null | head'
$out = ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile="$env:USERPROFILE\.ssh\known_hosts" -o ConnectTimeout=25 -o PasswordAuthentication=no -i $keyPath -p 26022 infor112026@149.28.154.230 $cmd 2>&1
$out
