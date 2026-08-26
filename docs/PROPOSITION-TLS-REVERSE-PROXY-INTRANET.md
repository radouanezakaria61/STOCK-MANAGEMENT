# Proposition TLS / Reverse Proxy — Production Interne & VPN (2026-08)

> **Statut : PROPOSITION — aucun déploiement effectué** (conformément au périmètre
> de l'audit final). Le code applicatif supporte déjà ce schéma ; la mise en œuvre
> est une opération d'infrastructure à valider par l'exploitant.

## 1. Architecture cible

```
Poste client (LAN / VPN)
        │  HTTPS :443 (TLS terminé ici)
        ▼
Reverse proxy (Nginx ou Caddy) sur le serveur applicatif
        │                        │
        │ /            (statiques du build SPA dist/)
        │ /api         → http://127.0.0.1:3001   (backend Express)
        ▼
Backend lié à 127.0.0.1 uniquement (jamais 0.0.0.0 derrière un proxy)
PostgreSQL : localhost uniquement (déjà le cas)
```

Principes :
- **Le TLS est terminé par le proxy** ; le trafic proxy ↔ backend reste local
  (loopback), donc non exposé.
- Backend et PostgreSQL ne doivent plus être joignables que depuis le serveur :
  lancer le backend avec `HOST=127.0.0.1` (supporté nativement, cf. `src/server.ts` M4).
- Aucun port applicatif autre que 443 ouvert côté LAN/VPN.

## 2. Configuration applicative requise (déjà supportée)

| Variable | Valeur production | Rôle |
|---|---|---|
| `NODE_ENV` | `production` | Active les cookies `Secure` (session refusée hors HTTPS) |
| `HOST` | `127.0.0.1` | Le backend n'écoute plus que localement |
| `TRUST_PROXY` | `loopback` (proxy même machine) ou nb de sauts | Le limiteur anti-bruteforce voit la vraie IP client via `X-Forwarded-For` |
| `ORIGINES_AUTORISEES` | `https://<nom-app>.<domaine-local>` | Protection mutation : toute requête mutante avec autre `Origin` est rejetée 403 (comportement vérifié en audit) |
| `DATABASE_URL`, secrets Argon2/chiffrement… | via environnement systemd, jamais dans les fichiers versionnés | Secrets maîtrisés (audit §secrets : conforme) |

Note vérifiée pendant l'audit : sans `TRUST_PROXY` en `NODE_ENV=production`,
`src/server.ts` affiche un avertissement explicite au démarrage (M4).

## 3. Exemple Caddy (recommandé : certificats automatisés)

```caddy
app.intranet.exemple.local {
    tls internal                      # CA Caddy locale ; remplacer par ADCS si disponible
    encode zstd gzip

    handle /api/* {
        reverse_proxy 127.0.0.1:3001
    }

    handle {
        root * /opt/gestion-stock/frontend/dist
        try_files {path} /index.html  # SPA : fallback index
        file_server
    }

    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options    nosniff
        X-Frame-Options           DENY
        Referrer-Policy           strict-origin-when-cross-origin
        -Server
    }
}
```

## 4. Exemple Nginx équivalent

```nginx
server {
    listen 443 ssl;
    server_name app.intranet.exemple.local;

    ssl_certificate     /etc/ssl/local/app.crt;   # certificat ADCS interne
    ssl_certificate_key /etc/ssl/local/app.key;
    ssl_protocols       TLSv1.2 TLSv1.3;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;

    location /api/ {
        proxy_pass         http://127.0.0.1:3001;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        client_max_body_size 10m;
    }

    root /opt/gestion-stock/frontend/dist;
    location / { try_files $uri /index.html; }
}
```

## 5. Certificat

1. **ADCS (Active Directory Certificate Services)** — recommandé si un domaine
   Windows existe : certificat émis pour `app.intranet.exemple.local`, racine
   entreprise déjà distribuée par GPO aux postes ⇒ aucune alerte navigateur.
2. À défaut, Caddy `tls internal` (CA locale générée, à distribuer aux postes).
3. Let's Encrypt DNS-01 possible seulement si un domaine public est pilotable ;
   non requis pour un déploiement VPN.

## 6. Checklist de mise en production (à exécuter le moment venu)

1. Build frontend (`npm run build`) copié vers le répertoire servi statique.
2. Services Windows/systemd : backend lancé avec les variables du §2
   (`NODE_ENV=production`, `HOST=127.0.0.1`, `TRUST_PROXY`, `ORIGINES_AUTORISEES`).
3. Proxy installé, certificat émis, ports LAN limités à 443.
4. Tests de recette post-déploiement :
   - `GET https://…/api/health` → `{"status":"ok", …}` sans secret ;
   - connexion depuis un poste VPN : cookie de session présent avec attributs
     `HttpOnly ; SameSite=Lax ; Path=/api ; Secure` ;
   - tentative avec mauvais mot de passe ×5 → 429 (limiteur opérationnel,
     vérifié en audit sur HTTP, inchangé derrière proxy grâce à `TRUST_PROXY`) ;
   - export PDF d'une fiche d'affectation depuis le navigateur.
5. Sauvegardes : planifier le `pg_dump` validé en audit (cf. rapport §Backup)
   via tâche planifiée quotidienne + rétention 30 jours + test de restauration mensuel.

## 7. Points d'attention relevés pendant l'audit

- **Filtrage web d'entreprise** (type FortiGate/FortiClient observé sur le poste
  de recette) peut intercepter les URLs locales dans les navigateurs équipés
  d'extensions d'entreprise : **l'URL de l'application doit être ajoutée à la
  whitelist du filtrage**, sinon les utilisateurs verront une page « catégorie
  non classée » au lieu de l'application.
- Ne pas exposer l'application sur Internet : ce schéma cible explicitement
  **interne/VPN** (périmètre du verdict).
