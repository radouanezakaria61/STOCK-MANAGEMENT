/**
 * Point de passage unique des appels API du frontend.
 *
 * M1 (Phase 1) : toute requête MUTANTE porte l'en-tête anti-CSRF
 * « X-Requested-With: XMLHttpRequest » exigé par le backend. Un formulaire
 * HTML forgé sur un site tiers ne peut pas poser cet en-tête : la requête
 * est refusée serveur avant même d'atteindre la logique métier.
 *
 * À utiliser partout à la place de `fetch` nu pour /api/*.
 */
export async function apiFetch(chemin: string, init: RequestInit = {}): Promise<Response> {
  const entetes = new Headers(init.headers);
  const methode = (init.method ?? "GET").toUpperCase();
  if (methode !== "GET" && methode !== "HEAD" && methode !== "OPTIONS") {
    entetes.set("X-Requested-With", "XMLHttpRequest");
  }
  return fetch(chemin, { ...init, headers: entetes });
}
