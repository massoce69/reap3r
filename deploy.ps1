# Script de déploiement automatique depuis Windows
param(
    [string]$VpsIp = "72.62.181.194",
    [string]$User = "root"
)

Write-Host "🚀 Déploiement MASSVISION Reap3r vers $VpsIp..." -ForegroundColor Cyan
Write-Host ""

# Définir les commandes à exécuter sur le VPS
$commands = @"
cd /opt/massvision-reap3r && \
git pull && \
docker compose -f docker-compose.prod.yml down 2>/dev/null || true && \
docker compose -f docker-compose.simple.yml down 2>/dev/null || true && \
docker compose -f docker-compose.simple.yml up -d --build && \
echo '' && \
echo '✅ Déploiement terminé!' && \
echo '' && \
echo '📊 État des services:' && \
docker compose -f docker-compose.simple.yml ps && \
echo '' && \
echo '🌐 URLs:' && \
echo '  Frontend: http://$VpsIp:3000' && \
echo '  Backend:  http://$VpsIp:4000' && \
echo '  Grafana:  http://$VpsIp:3001'
"@

Write-Host "📡 Connexion au VPS..." -ForegroundColor Yellow
ssh $User@$VpsIp $commands

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Déploiement réussi!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🌐 Accès:" -ForegroundColor Cyan
    Write-Host "  Frontend: http://${VpsIp}:3000" -ForegroundColor White
    Write-Host "  Backend:  http://${VpsIp}:4000" -ForegroundColor White
    Write-Host "  Grafana:  http://${VpsIp}:3001" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ Erreur lors du déploiement" -ForegroundColor Red
    Write-Host "   Vérifiez les logs avec:" -ForegroundColor Yellow
    Write-Host "   ssh $User@$VpsIp 'cd /opt/massvision-reap3r && docker compose -f docker-compose.simple.yml logs'" -ForegroundColor Gray
}
