import { useState } from "react";
import { KeyRound, CheckCircle2 } from "lucide-react";

interface ChangePasswordModalProps {
  onChangeEffectue: () => void;
}

// Fenêtre bloquante affichée quand doitChangerMdp vaut vrai : aucune
// navigation possible tant que le mot de passe temporaire n'a pas été
// remplacé (plan §3.1).
export default function ChangePasswordModal({ onChangeEffectue }: ChangePasswordModalProps) {
  const [motDePasseActuel, setMotDePasseActuel] = useState("");
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur("");
    if (!motDePasseActuel || !nouveauMotDePasse || !confirmation) {
      setErreur("Tous les champs sont obligatoires.");
      return;
    }
    if (nouveauMotDePasse !== confirmation) {
      setErreur("La confirmation ne correspond pas au nouveau mot de passe.");
      return;
    }
    setEnCours(true);
    try {
      const res = await fetch("/api/auth/changer-mot-de-passe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motDePasseActuel, nouveauMotDePasse }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setErreur(payload.error || "Changement impossible. Réessayez.");
        return;
      }
      onChangeEffectue();
    } catch {
      setErreur("Serveur injoignable. Vérifiez le réseau interne.");
    } finally {
      setEnCours(false);
    }
  };

  const champClasse =
    "w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500";

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <form onSubmit={soumettre} className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-7 space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0">
            <KeyRound size={18} />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900">Choisissez votre mot de passe</h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Votre compte utilise un mot de passe temporaire. Vous devez en définir un personnel avant d'accéder à
              l'application.
            </p>
          </div>
        </div>

        {erreur && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl">
            {erreur}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Mot de passe actuel</label>
            <input
              type="password"
              required
              value={motDePasseActuel}
              onChange={(e) => setMotDePasseActuel(e.target.value)}
              autoComplete="current-password"
              className={champClasse}
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Nouveau mot de passe</label>
            <input
              type="password"
              required
              value={nouveauMotDePasse}
              onChange={(e) => setNouveauMotDePasse(e.target.value)}
              placeholder="12 caractères min., majuscule, minuscule et chiffre"
              autoComplete="new-password"
              minLength={12}
              className={champClasse}
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Confirmation</label>
            <input
              type="password"
              required
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              autoComplete="new-password"
              className={champClasse}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={enCours}
          className={`w-full py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition ${
            enCours
              ? "bg-slate-300 text-slate-500 cursor-not-allowed"
              : "bg-purple-600 text-white hover:bg-purple-700 cursor-pointer"
          }`}
        >
          <CheckCircle2 size={15} />
          <span>{enCours ? "Enregistrement..." : "Définir mon mot de passe"}</span>
        </button>
      </form>
    </div>
  );
}
