# Déploiement en production — HTTPS, reverse proxy et variables d'environnement

Ce document couvre le durcissement réseau de l'application (chantier **M4**,
Phase 1) : TLS, reverse proxy, adresses d'écoute et variables d'environnement.
Il complète `backend/.env.example` qui reste la référence des variables.

## 1. Architecture cible

```
Navigateurs (LAN) ──HTTPS──▶ Reverse proxy (nginx/Caddy/IIS)
                                │  termine le TLS
                                │  transmet X-Forwarded-For / X-Forwarded-Proto
                                ▼
                       Backend Express (HOST=127.0.0.1:3001)
                                │ sert aussi le SPA buildé (frontend/dist)
                                ▼
                       PostgreSQL 16
```

Le backend sert le SPA en production (`NODE_ENV=production`, dossier
`frontend/dist`). Un seul point d'entrée HTTP(S), donc une seule origine :
la CSP (`connect-src 'self'`) fonctionne sans ajustement.

## 2. Reverse proxy — exemple nginx

```nginx
server {
    listen 443 ssl http2;
    server_name parc.exemple.ma;

    # Certificats émis par votre autorité interne ou Let's Encrypt
    ssl_certificate     /etc/ssl/parc/fullchain.pem;
    ssl_certificate_key /etc/ssl/parc/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;

    # Sécurité minimale côté proxy (le backend ajoute déjà CSP/HSTS/etc.)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location / {
        proxy_pass         http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 75s;
    }
}

# Redirection explicite de tout accès HTTP direct
server {
    listen 80;
    server_name parc.exemple.ma;
    return 301 https://$host$request_uri;
}
```

## 3. Configuration backend derrière le proxy

Dans `backend/.env` :

```ini
NODE_ENV=production
PORT=3001
HOST=127.0.0.1            # écoute locale uniquement : seul nginx parle au backend
TRUST_PROXY=1             # UN saut de proxy de confiance devant nous
ORIGINES_AUTORISEES=https://parc.exemple.ma
PURGE_INTERVALLE_MINUTES=360
CLE_CHIFFREMENT=<32 octets base64>
ADMIN_INITIAL_PASSWORD=<mot de passe initial du super administrateur>
```

Points importants :

- **`TRUST_PROXY`** accepte la grammaire Express : nombre de sauts (`1`),
  mots-clés (`loopback`, `linklocal`, `uniquelocal`), adresse IP, CIDR
  (`10.0.0.0/8`) ou combinaisons séparées par des virgules. Une valeur
  invalide fait **échouer le démarrage** (fail fast) plutôt que d'être ignorée.
  Sans reverse proxy, laissez vide : les en-têtes `X-Forwarded-*` ne sont pas
  crus (un client LAN ne peut pas usurper son adresse).
- **`HOST=127.0.0.1`** derrière un proxy local empêche tout contournement du
  TLS en parlant directement au backend sur le LAN.
- En production **sans** proxy, le serveur affiche un avertissement explicite
  au démarrage : c'est un mode supporté (LAN chiffré/VPN) mais l'exploitant
  doit l'avoir choisi sciemment.

## 4. Checklist de mise en production

- [ ] `npm run build` exécuté (backend compilé + SPA dans `frontend/dist`)
- [ ] Migration appliquée : `npx prisma migrate deploy`
- [ ] `CLE_CHIFFREMENT` définie (32 octets base64) — sinon refus de démarrer
- [ ] `ADMIN_INITIAL_PASSWORD` définie (≥12 caractères), seed démo désactivé
- [ ] `MOT_DE_PASSE_DEMO` ABSENT de l'environnement de production
- [ ] `NODE_ENV=production`, `HOST`, `TRUST_PROXY`, `ORIGINES_AUTORISEES` cohérents avec la topologie
- [ ] TLS actif sur le proxy, HTTP redirigé vers HTTPS, TLS 1.2 minimum
- [ ] Sauvegardes PostgreSQL planifiées et testées (restauration essayée)
- [ ] Démarrage supervisé (service systemd/NSSM), logs persistés

## 5. Intégrations non navigateur (scripts, monitoring)

Toute requête **mutante** (POST/PUT/PATCH/DELETE) doit porter l'en-tête

```
X-Requested-With: XMLHttpRequest
```

sinon elle reçoit **403** (anti-CSRF M1). Les requêtes GET n'en ont pas
besoin. Les clients légitimes derrière le proxy restent soumis aux limiteurs
de connexion (C2 : 5 échecs / 15 min par couple IP+identifiant ; M2 :
30 échecs / 1 h par adresse IP, blocage 15 min).

## 6. Notes CSP

La CSP est servie par le backend (`default-src 'self'`, `script-src 'self'`,
`style-src 'self' 'unsafe-inline'`, `img-src 'self' data:`). Aucun domaine
externe n'est à autoriser ; si un jour un CDN devient nécessaire, il devra
être ajouté explicitement dans `app.ts` après revue sécurité. La directive
`upgrade-insecure-requests` est volontairement absente pour que l'accès
HTTP simple reste possible sur un LAN sans TLS — le chiffrement se pilote
au niveau du reverse proxy.
