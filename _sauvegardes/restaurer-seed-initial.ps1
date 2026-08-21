# Restaure la sauvegarde logique du jeu de démonstration (chantier 0).
# Usage : .\restaurer-seed-initial.ps1 -BaseCible stock_management
# Prérequis : le schéma existe déjà (npx prisma migrate deploy).
param(
    [Parameter(Mandatory = $true)]
    [string]$BaseCible
)

$psql = "C:\Program Files\PostgreSQL\16\bin\psql.exe"
if (-not $env:PGPASSWORD) { $env:PGPASSWORD = "postgres123" }

$dossier = $PSScriptRoot + "\seed-initial"
$ordre = @(
    "fournisseurs", "bons_commande", "lignes_commande", "budgets",
    "appels_offres", "offres", "utilisateurs", "articles_stock",
    "mouvements_stock", "affectations", "lignes_affectation", "retours_affectation"
)

Write-Output "Purge des tables (ordre inverse des FK)..."
$toutes = ($ordre -join ", ")
& $psql -U postgres -h localhost -d $BaseCible -v ON_ERROR_STOP=1 -c "TRUNCATE TABLE $toutes RESTART IDENTITY CASCADE;"
if ($LASTEXITCODE -ne 0) { Write-Error "Purge échouée."; exit 1 }

Write-Output "Import des CSV..."
foreach ($t in $ordre) {
    $f = ($dossier + "\" + $t + ".csv").Replace('\', '/')
    & $psql -U postgres -h localhost -d $BaseCible -v ON_ERROR_STOP=1 -c "\copy $t FROM '$f' WITH (FORMAT csv, HEADER true)"
    if ($LASTEXITCODE -ne 0) { Write-Error "Import échoué : $t"; exit 1 }
}

Write-Output "Réalignement des séquences..."
$paires = @(
    @{ t = "fournisseurs"; c = "seq" }, @{ t = "bons_commande"; c = "seq" },
    @{ t = "lignes_commande"; c = "id" }, @{ t = "budgets"; c = "seq" },
    @{ t = "appels_offres"; c = "seq" }, @{ t = "utilisateurs"; c = "seq" },
    @{ t = "articles_stock"; c = "seq" }, @{ t = "mouvements_stock"; c = "seq" },
    @{ t = "affectations"; c = "seq" }, @{ t = "lignes_affectation"; c = "id" }
)
foreach ($p in $paires) {
    & $psql -U postgres -h localhost -d $BaseCible -q -c "SELECT setval(pg_get_serial_sequence('$($p.t)','$($p.c)'), COALESCE((SELECT MAX($($p.c)) FROM $($p.t)), 1));"
    if ($LASTEXITCODE -ne 0) { Write-Error "Séquence échouée : $($p.t).$($p.c)"; exit 1 }
}

Write-Output "Restauration terminée dans « $BaseCible »."
