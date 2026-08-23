import { apiFetch } from "../api";
import { useState } from "react";
import { LogIn, ShieldCheck } from "lucide-react";
import { ProfilUtilisateur } from "../types";

interface LoginPageProps {
  onConnexion: (profil: ProfilUtilisateur) => void;
}

export default function LoginPage({ onConnexion }: LoginPageProps) {
  const [identifiant, setIdentifiant] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifiant.trim() || !motDePasse) {
      setErreur("Veuillez saisir votre identifiant et votre mot de passe.");
      return;
    }
    setEnCours(true);
    setErreur("");
    try {
      const res = await apiFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifiant: identifiant.trim(), motDePasse }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setErreur(payload.error || "Connexion impossible. Réessayez.");
        return;
      }
      onConnexion(payload.data as ProfilUtilisateur);
    } catch {
      setErreur("Serveur injoignable. Vérifiez le réseau interne.");
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md">
        {/* Marque */}
        <div className="flex items-center gap-3 justify-center mb-8">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center font-black text-white text-lg">
            A
          </div>
          <div>
            <h1 className="text-sm font-black uppercase tracking-wider text-slate-100 leading-none">
              Parc Informatique
            </h1>
            <p className="text-[11px] text-slate-400 mt-1">Plateforme de Gestion — Distra</p>
          </div>
        </div>

        <form
          onSubmit={soumettre}
          className="bg-white rounded-2xl shadow-2xl p-7 space-y-5"
          autoComplete="on"
        >
          <div>
            <h2 className="text-base font-black text-slate-900">Connexion</h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Accès réservé au personnel autorisé, depuis le réseau interne de l'entreprise.
            </p>
          </div>

          {erreur && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl">
              {erreur}
            </div>
          )}

          <div>
            <label htmlFor="identifiant" className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
              Identifiant ou email professionnel
            </label>
            <input
              id="identifiant"
              name="username"
              type="text"
              required
              autoFocus
              value={identifiant}
              onChange={(e) => setIdentifiant(e.target.value)}
              placeholder="prenom.nom"
              autoComplete="username"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="motDePasse" className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
              Mot de passe
            </label>
            <input
              id="motDePasse"
              name="password"
              type="password"
              required
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              placeholder="••••••••••••"
              autoComplete="current-password"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={enCours}
            className={`w-full py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition ${
              enCours
                ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                : "bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer"
            }`}
          >
            <LogIn size={15} />
            <span>{enCours ? "Connexion en cours..." : "Se connecter"}</span>
          </button>

          <div className="flex items-start gap-2 pt-2 border-t border-slate-100 text-[10px] text-slate-400 leading-relaxed">
            <ShieldCheck size={14} className="text-emerald-500 shrink-0 mt-0.5" />
            <p>
              Après 5 tentatives infructueuses, l'accès est temporairement suspendu.
              En cas d'oubli, contactez le service informatique.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
