export interface Societe {
  id: string;
  reference: string;
  nom: string;
  codeCourt: string;
  adresse?: string | null;
  ville?: string | null;
  telephone?: string | null;
  email?: string | null;
  identifiantLegal?: string | null; // ICE
  actif: boolean;
  notes?: string | null;
  createdAt: string;
}

// Notification interne (chantier 3) — servie par GET /api/notifications.
export interface NotificationInterne {
  id: string;
  type:
    | "STOCK_FAIBLE"
    | "MATERIEL_ENDOMMAGE"
    | "MAINTENANCE_DEMARREE"
    | "MAINTENANCE_TERMINEE"
    | "INCOHERENCE_DONNEES"
    | "INTERVENTION_ADMIN"
    | string;
  titre: string;
  message: string;
  statut: "OUVERTE" | "LUE" | "RESOLUE" | string;
  entite?: string | null;
  entiteId?: string | null;
  cibleOnglet?: string | null;
  creeLe: string;
  lueLe?: string | null;
  resolueLe?: string | null;
}

// Rôles RBAC (matrice §5.2) — codes enum anglais, libellés français via
// LIBELLES_ROLES dans App.tsx.
export type UserRole =
  | "SUPER_ADMIN"
  | "IT_MANAGER"
  | "IT_TECHNICIAN"
  | "STOCK_MANAGER"
  | "AUDITOR"
  | "EMPLOYEE";

export interface RoleRef {
  code: UserRole;
  nom: string;
}

export interface SocieteRef {
  id: string;
  reference: string;
  nom: string;
  codeCourt: string;
  actif: boolean;
}

export interface AppUser {
  id: string;
  reference?: string;
  username?: string;
  name: string;
  email: string;
  phone?: string;
  department: string;
  jobTitle: string;
  role: RoleRef;
  status: "Actif" | "Inactif" | "Suspendu";
  societeId?: string | null;
  societe?: SocieteRef | null;
  avatarUrl?: string;
  creeLe: string;
  derniereConnexion?: string;
}

// Profil renvoyé par /api/auth/me et /api/auth/login : le rôle est un objet
// {code, nom}, accompagné des permissions effectives du compte.
export interface ProfilUtilisateur {
  id: string;
  reference: string;
  username: string;
  name: string;
  email: string;
  avatarUrl: string;
  department: string;
  jobTitle: string;
  status: string;
  role: RoleRef;
  societe: { id: string; nom: string } | null;
  derniereConnexion: string | null;
  doitChangerMdp: boolean;
  permissions: string[];
}

export type StockCategory = 
  | "Laptops & Portables"
  | "Postes Fixes & Écrans"
  | "Serveurs & Stockage"
  | "Réseau & Sécurité"
  | "Périphériques & Accessoires"
  | "Consommables & Pièces"
  | "Licences & Logiciels";

export type StockStatus = 
  | "En Stock"
  | "Affecté"
  | "En Commande"
  | "En Maintenance"
  | "Rebut / Fin de vie";

export interface StockAssignment {
  userId?: string;
  userName: string;
  department: string;
  assignedDate: string;
}

export interface ITStockItem {
  id: string;
  assetTag: string;
  name: string;
  category: StockCategory;
  brand: string;
  model: string;
  serialNumber: string;
  specs?: {
    cpu?: string;
    ram?: string;
    storage?: string;
    os?: string;
  };
  quantity: number;
  availableQty: number;
  allocatedQty: number;
  minThreshold: number;
  unitPriceMAD: number;
  totalValueMAD: number;
  location: string;
  status: StockStatus;
  fournisseur?: string | null;
  purchaseDate?: string;
  assignedTo?: StockAssignment;
  warrantyExpiry?: string;
  notes?: string;
}

export interface StockMovement {
  id: string;
  reference?: string;
  stockItemId: string;
  itemName: string;
  type: "Entrée Achat" | "Sortie Affectation" | "Retour Stock" | "Ajustement Inventaire" | "Mise au Rebut";
  quantity: number;
  performedBy: string;
  recipient?: string;
  department?: string;
  date: string;
  notes?: string;
}

export interface AssignedItemDetail {
  stockItemId: string;
  assetTag: string;
  name: string;
  brand: string;
  model: string;
  serialNumber: string;
  category: StockCategory;
  specs?: {
    cpu?: string;
    ram?: string;
    storage?: string;
    os?: string;
  };
  condition: "Neuf / Excellent état" | "Très bon état" | "Bon état";
  accessories: string[];
}

export type ReturnCause =
  | "Départ collaborateur (Fin de contrat / Démission)"
  | "Renouvellement matériel / Upgrade"
  | "Matériel défectueux / En panne"
  | "Changement de poste / Mutation interne"
  | "Fin de mission / Projet temporaire"
  | "Autre motif";

// Chantier 3.5 : liste fermée alignée sur ETATS_MATERIEL_CONSTATES (backend,
// lib/machine-etats.ts). La décision maintenance/rebut se base sur cette
// valeur structurée, plus sur du texte libre.
export type EquipmentReturnCondition =
  | "Bon état"
  | "Endommagé"
  | "Maintenance requise"
  | "Hors service";

export interface MaterialReturnRecord {
  id: string;
  assignmentId: string;
  returnDate: string;
  cause: ReturnCause;
  customCause?: string;
  equipmentCondition: EquipmentReturnCondition;
  accessoriesReturned: string[];
  missingAccessories: string[];
  dataWiped: boolean;
  bitlockerUnlocked: boolean;
  technicalDiagnosis?: string;
  actionTaken: "Remise en stock disponible" | "Envoi en maintenance / SAV" | "Mise au rebut";
  inspectedBy: string;
  notes?: string;
}

export type TelecomOperator = "IAM" | "INWI" | "ORANGE" | "AUTRE";
export type AssignedResourceType = "Carte SIM" | "SmartPhone" | "PC / Laptop" | "Autre matériel IT" | "Carte SIM + SmartPhone" | "Matériel Informatique IT";
export type AssignmentOperationType = "AFFECTATION" | "RÉAFFECTATION";
export type OperationType = AssignmentOperationType;
export type RestitutedDeviceCondition = "Endommagé" | "Cassé mais opérationnel" | "Bon état" | "Non applicable";

export interface MaterialAssignment {
  id: string;
  reference: string;
  templateType?: "DISTRA_IT_EQUIPMENT" | "DISTRA_SIM_SMARTPHONE" | "STANDARD_DSI_EQUIPMENT";
  formCode?: string; // e.g. "IT-01", "IT-02"
  beneficiaryName: string;
  beneficiaryEmail: string;
  beneficiaryPhone: string;
  beneficiaryCin: string;
  beneficiaryJobTitle: string;
  beneficiaryDepartment: string;
  beneficiarySite?: string; // e.g. "Berrechid", "Casablanca Siège", etc.
  assignedDate: string;
  status: "Active" | "Restitué" | "Restitution Partielle";
  authorizedBy: string;
  dsiTitle: string;
  
  // Specific Distra PC / IT Equipment Form fields (Matching image.png)
  equipmentType?: string; // e.g. "Ordinateur / PC"
  equipmentCpu?: string; // e.g. "Intel i7"
  equipmentRam?: string; // e.g. "8" (GB)
  equipmentStorage?: string; // e.g. "256" (GB SSD)
  equipmentAcquisitionDate?: string; // e.g. "06/12/2021"
  hasKeyboard?: boolean; // Clavier
  hasMouse?: boolean; // Souris
  hasUsbAdapter?: boolean; // Adaptateur USB/RJ45

  // Specific Distra SIM & Smartphone Form fields
  resourceType?: AssignedResourceType;
  hasSimCard?: boolean;
  simOperator?: TelecomOperator;
  simPhoneNumber?: string;
  simPuk?: string;
  simPin?: string;
  
  hasSmartphone?: boolean;
  deviceBrand?: string;
  deviceImei?: string;
  deviceModel?: string;
  deviceConfiguration?: string;
  
  operationType?: AssignmentOperationType;
  restitutionPreviousDevice?: "OUI" | "NON";
  restitutedDeviceCondition?: RestitutedDeviceCondition;
  incidentRemarks?: string;

  items: AssignedItemDetail[];
  termsAccepted: boolean;
  notes?: string;
  returnRecord?: MaterialReturnRecord;
}
