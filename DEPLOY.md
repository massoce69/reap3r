# Commandes de déploiement VPS

## Se connecter au VPS :
```bash
ssh root@72.62.181.194
```

## Une fois connecté, exécuter :

```bash
# 1. Aller dans le dossier du projet
cd /opt/massvision-reap3r

# 2. Récupérer les derniers changements
git pull

# 3. Arrêter les anciens conteneurs
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.simple.yml down

# 4. Lancer les nouveaux services
docker compose -f docker-compose.simple.yml up -d --build

# 5. Vérifier l'état
docker compose -f docker-compose.simple.yml ps

# 6. Voir les logs si besoin
docker compose -f docker-compose.simple.yml logs -f frontend
# ou
docker compose -f docker-compose.simple.yml logs -f backend
```

## URLs d'accès :
- Frontend : http://72.62.181.194:3000
- Backend API : http://72.62.181.194:4000
- Grafana : http://72.62.181.194:3001

## Résolution des problèmes :

### Si le frontend ne démarre pas, vérifier les logs :
```bash
docker compose -f docker-compose.simple.yml logs frontend
```

### Si le backend ne démarre pas :
```bash
docker compose -f docker-compose.simple.yml logs backend
```

### Redémarrer un service spécifique :
```bash
docker compose -f docker-compose.simple.yml restart frontend
```

### Arrêter tout :
```bash
docker compose -f docker-compose.simple.yml down
```

### Nettoyer et recommencer :
```bash
docker compose -f docker-compose.simple.yml down -v
docker compose -f docker-compose.simple.yml up -d --build
```
