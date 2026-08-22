/**
 * Seed — données de démonstration parc IT.
 *
 * Identifiants : PK = UUID générés ; `reference` porte l'identifiant métier
 * lisible (v-1, usr-1, STK-001…). Les clés étrangères sont résolues via une
 * map référence → uuid.
 *
 * Ordre d'insertion inversé : `creeLe` étant horodaté à l'insertion (compteur
 * partagé croissant) et les lectures triant par creeLe décroissant, insérer
 * en ordre inverse reproduit la sémantique « unshift » de l'ancien état
 * en mémoire.
 */
import "dotenv/config";
import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Horloge déterministe : chaque create reçoit un instant distinct,
// un jour après l'autre à partir du 1er janvier 2026.
let compteurHorloge = 0;
function horodatage(): Date {
  return new Date(Date.UTC(2026, 0, 1 + compteurHorloge++, 12, 0, 0));
}
function dateSeule(s: string): Date {
  return new Date(`${s}T12:00:00Z`);
}

async function main() {
  // Nettoyage (ordre respectant les clés étrangères)
  await prisma.retourAffectation.deleteMany();
  await prisma.ligneAffectation.deleteMany();
  await prisma.affectation.deleteMany();
  await prisma.mouvementStock.deleteMany();
  await prisma.articleStock.deleteMany();
  await prisma.utilisateur.deleteMany();
  await prisma.fournisseur.deleteMany();

  const idArticle = new Map<string, string>();

  // ── Fournisseurs (insertion inversée : v-5 d'abord → affiché en dernier) ──
  const fournisseurs = [
    {
      reference: "v-5",
      name: "Summit Transport & Logistique",
      contact: "Mehdi Alami",
      email: "operations@summitlog.ma",
      category: "Transport & Logistique",
      qualityScore: 71,
      onTimeDelivery: 74,
      riskLevel: "High",
      status: "On Probation"
    },
    {
      reference: "v-4",
      name: "Vertex Conseil & Solutions",
      contact: "Kenza Mansouri",
      email: "contrats@vertexconseil.ma",
      category: "Services & Conseil",
      qualityScore: 82,
      onTimeDelivery: 85,
      riskLevel: "Medium",
      status: "Approved"
    },
    {
      reference: "v-3",
      name: "Vanguard Cybersécurité Maroc",
      contact: "Driss Tazi",
      email: "projets@vanguardcyber.ma",
      category: "Cybersécurité & Réseaux",
      qualityScore: 98,
      onTimeDelivery: 99,
      riskLevel: "Low",
      status: "Preferred"
    },
    {
      reference: "v-2",
      name: "BlueSky Fournitures & Bureau",
      contact: "Youssef El Amrani",
      email: "commandes@bluesky.ma",
      category: "Fournitures de Bureau",
      qualityScore: 88,
      onTimeDelivery: 91,
      riskLevel: "Low",
      status: "Approved"
    },
    {
      reference: "v-1",
      name: "Apex Tech & Logistique Maroc",
      contact: "Sarah Benali",
      email: "contact@apextech.ma",
      category: "Équipements Informatiques",
      qualityScore: 94,
      onTimeDelivery: 96,
      riskLevel: "Low",
      status: "Preferred"
    }
  ];
  for (const f of fournisseurs) {
    await prisma.fournisseur.create({
      data: { ...f, id: randomUUID(), creeLe: horodatage() }
    });
  }

  // ── Utilisateurs (insertion inversée : usr-5 → usr-1) ────────────────
  const utilisateurs = [
    {
      reference: "usr-5",
      name: "Mehdi Alami",
      email: "mehdi.alami@entreprise.ma",
      phone: "+212 6 65 67 89 01",
      department: "Chaîne Logistique & Approvisionnements",
      jobTitle: "Responsable Approvisionnements & Flotte",
      role: "BUYER",
      status: "Inactif",
      spendingLimitMAD: 30000,
      permissions: {
        canCreatePO: true,
        canApprovePO: false,
        canManageVendors: false,
        canEvaluateBids: false,
        canGenerateContracts: false,
        canManageUsers: false,
        canViewBudgets: true
      },
      avatarUrl: "",
      derniereConnexion: new Date("2026-07-25T14:20:00Z")
    },
    {
      reference: "usr-4",
      name: "Sarah Benali",
      email: "sarah.benali@entreprise.ma",
      phone: "+212 6 64 56 78 90",
      department: "Direction Générale & Finance",
      jobTitle: "Contrôleur Financier & Auditeur Interne",
      role: "AUDITOR",
      status: "Actif",
      spendingLimitMAD: 0,
      permissions: {
        canCreatePO: false,
        canApprovePO: false,
        canManageVendors: false,
        canEvaluateBids: false,
        canGenerateContracts: false,
        canManageUsers: false,
        canViewBudgets: true
      },
      avatarUrl: "",
      derniereConnexion: new Date("2026-08-18T09:05:00Z")
    },
    {
      reference: "usr-3",
      name: "Karim Berrada",
      email: "karim.berrada@entreprise.ma",
      phone: "+212 6 63 45 67 89",
      department: "Ventes & Marketing",
      jobTitle: "Acheteur Senior & Commercial",
      role: "BUYER",
      status: "Actif",
      spendingLimitMAD: 50000,
      permissions: {
        canCreatePO: true,
        canApprovePO: false,
        canManageVendors: false,
        canEvaluateBids: true,
        canGenerateContracts: false,
        canManageUsers: false,
        canViewBudgets: true
      },
      avatarUrl: "",
      derniereConnexion: new Date("2026-08-17T16:30:00Z")
    },
    {
      reference: "usr-2",
      name: "Maya Lin",
      email: "maya.lin@entreprise.ma",
      phone: "+212 6 62 34 56 78",
      department: "Ressources Humaines & Moyens Généraux",
      jobTitle: "Directrice des Achats & Moyens Généraux",
      role: "PROCUREMENT_MANAGER",
      status: "Actif",
      spendingLimitMAD: 300000,
      permissions: {
        canCreatePO: true,
        canApprovePO: true,
        canManageVendors: true,
        canEvaluateBids: true,
        canGenerateContracts: true,
        canManageUsers: false,
        canViewBudgets: true
      },
      avatarUrl: "",
      derniereConnexion: new Date("2026-08-18T11:15:00Z")
    },
    {
      reference: "usr-1",
      name: "Zakaria Radouane",
      email: "zakariaradouane61@gmail.com",
      phone: "+212 6 61 23 45 67",
      department: "Technologies de l'Information",
      jobTitle: "Directeur des Systèmes d'Information (DSI)",
      role: "ADMIN",
      status: "Actif",
      spendingLimitMAD: 1000000,
      permissions: {
        canCreatePO: true,
        canApprovePO: true,
        canManageVendors: true,
        canEvaluateBids: true,
        canGenerateContracts: true,
        canManageUsers: true,
        canViewBudgets: true
      },
      avatarUrl: "",
      derniereConnexion: new Date("2026-08-18T13:40:00Z")
    }
  ];
  for (const u of utilisateurs) {
    await prisma.utilisateur.create({ data: { ...u, id: randomUUID(), creeLe: horodatage() } });
  }

  // ── Articles en stock (insertion inversée : STK-007 → STK-001) ───────
  const articles = [
    {
      reference: "STK-007",
      assetTag: "IT-CON-6001",
      name: "Cartouche Toner Noir HP LaserJet Enterprise (W9004MC)",
      category: "Consommables & Pièces",
      brand: "HP",
      model: "W9004MC",
      serialNumber: "LOT-HP-202604",
      quantity: 4,
      availableQty: 4,
      allocatedQty: 0,
      minThreshold: 6,
      unitPriceMAD: 850,
      totalValueMAD: 3400,
      location: "Réserve Consommables",
      status: "En Stock",
      vendorName: "BlueSky Fournitures & Bureau",
      purchaseDate: dateSeule("2026-05-20"),
      warrantyExpiry: null,
      assignedTo: undefined,
      notes: "Stock critique : seuil minimal de 6 unités requis."
    },
    {
      reference: "STK-006",
      assetTag: "IT-ACC-5001",
      name: "Docking Station USB-C Multi-Display 100W",
      category: "Périphériques & Accessoires",
      brand: "HP",
      model: "USB-C G5 Dock",
      serialNumber: "5CD109283",
      quantity: 30,
      availableQty: 14,
      allocatedQty: 16,
      minThreshold: 10,
      unitPriceMAD: 1200,
      totalValueMAD: 36000,
      location: "Magasin Central IT (Casablanca)",
      status: "En Stock",
      vendorName: "Apex Tech & Logistique Maroc",
      purchaseDate: dateSeule("2026-06-08"),
      warrantyExpiry: dateSeule("2028-06-08"),
      assignedTo: undefined,
      notes: "Stations d'accueil universelles double affichage HDMI/DP."
    },
    {
      reference: "STK-005",
      assetTag: "IT-NET-4001",
      name: "Switch Cisco Catalyst 9300 48 Ports PoE+ (C9300-48P)",
      category: "Réseau & Sécurité",
      brand: "Cisco",
      model: "Catalyst 9300",
      serialNumber: "FCW2248L01K",
      quantity: 4,
      availableQty: 1,
      allocatedQty: 3,
      minThreshold: 2,
      unitPriceMAD: 24500,
      totalValueMAD: 98000,
      location: "Local Technique Réseau",
      status: "En Stock",
      vendorName: "Vanguard Cybersécurité Maroc",
      purchaseDate: dateSeule("2026-05-02"),
      warrantyExpiry: dateSeule("2029-05-02"),
      assignedTo: undefined,
      notes: "Commutateur de cœur de réseau PoE+ pour bornes WiFi 6."
    },
    {
      reference: "STK-004",
      assetTag: "IT-SRV-3001",
      name: "Serveur Dell PowerEdge R760 2U (2x Xeon Gold 6430 / 128GB)",
      category: "Serveurs & Stockage",
      brand: "Dell",
      model: "PowerEdge R760",
      serialNumber: "SRV-R760-9018",
      quantity: 3,
      availableQty: 1,
      allocatedQty: 2,
      minThreshold: 1,
      unitPriceMAD: 78000,
      totalValueMAD: 234000,
      location: "Salle Serveurs Datacenter (Baie B2)",
      status: "En Stock",
      vendorName: "Apex Tech & Logistique Maroc",
      purchaseDate: dateSeule("2026-04-20"),
      warrantyExpiry: dateSeule("2031-04-20"),
      assignedTo: undefined,
      notes: "Cluster virtualisation VMware / Proxmox."
    },
    {
      reference: "STK-003",
      assetTag: "IT-MON-2001",
      name: "Écran Dell UltraSharp 27\" 4K USB-C Hub (U2723QE)",
      category: "Postes Fixes & Écrans",
      brand: "Dell",
      model: "UltraSharp U2723QE",
      serialNumber: "CN0K89201L",
      quantity: 25,
      availableQty: 12,
      allocatedQty: 13,
      minThreshold: 8,
      unitPriceMAD: 4800,
      totalValueMAD: 120000,
      location: "Stock IT Étage 3",
      status: "En Stock",
      vendorName: "Apex Tech & Logistique Maroc",
      purchaseDate: dateSeule("2026-05-15"),
      warrantyExpiry: dateSeule("2029-05-15"),
      assignedTo: undefined,
      notes: "Avec alimentation 90W USB-C PD et port Ethernet RJ45 intégré."
    },
    {
      reference: "STK-002",
      assetTag: "IT-LAP-1002",
      name: "Lenovo ThinkPad T14s Gen 4 (AMD Ryzen 7 PRO / 32GB)",
      category: "Laptops & Portables",
      brand: "Lenovo",
      model: "ThinkPad T14s",
      serialNumber: "PF389201A",
      quantity: 8,
      availableQty: 2,
      allocatedQty: 6,
      minThreshold: 3,
      unitPriceMAD: 13800,
      totalValueMAD: 110400,
      location: "Magasin Central IT (Casablanca)",
      status: "En Stock",
      vendorName: "Apex Tech & Logistique Maroc",
      purchaseDate: dateSeule("2026-05-15"),
      warrantyExpiry: dateSeule("2029-05-15"),
      assignedTo: {
        userName: "Sarah Bennani",
        department: "Ressources Humaines & Moyens Généraux",
        assignedDate: "2026-06-03"
      },
      notes: "Ultraportable haute autonomie."
    },
    {
      reference: "STK-001",
      assetTag: "IT-LAP-1001",
      name: "Dell Latitude 5540 i7 13th Gen (32GB / 1TB SSD)",
      category: "Laptops & Portables",
      brand: "Dell",
      model: "Latitude 5540",
      serialNumber: "5CD2389KL1",
      quantity: 15,
      availableQty: 9,
      allocatedQty: 6,
      minThreshold: 5,
      unitPriceMAD: 14500,
      totalValueMAD: 217500,
      location: "Magasin Central IT (Casablanca)",
      status: "En Stock",
      vendorName: "Apex Tech & Logistique Maroc",
      purchaseDate: dateSeule("2026-05-15"),
      warrantyExpiry: dateSeule("2029-05-15"),
      assignedTo: {
        userName: "Karim Berrada",
        department: "Ventes & Marketing",
        assignedDate: "2026-06-01"
      },
      notes: "Postes standards ingénieurs et managers."
    }
  ];
  for (const a of articles) {
    const cree = await prisma.articleStock.create({
      data: { ...a, id: randomUUID(), creeLe: horodatage() }
    });
    idArticle.set(cree.reference, cree.id);
  }

  // ── Mouvements de stock (insertion inversée : MVT-004 → MVT-001) ─────
  const mouvements = [
    {
      reference: "MVT-004",
      articleRef: "STK-007",
      itemName: "Cartouche Toner Noir HP LaserJet Enterprise",
      type: "Entrée Achat",
      quantity: 4,
      performedBy: "Zakaria Radouane",
      date: dateSeule("2026-05-20"),
      notes: "Réception partielle commande consommables."
    },
    {
      reference: "MVT-003",
      articleRef: "STK-002",
      itemName: "Lenovo ThinkPad T14s Gen 4",
      type: "Sortie Affectation",
      quantity: 1,
      performedBy: "Maya Lin",
      recipient: "Sarah Bennani",
      department: "Ressources Humaines & Moyens Généraux",
      date: dateSeule("2026-06-03"),
      notes: "Mise à disposition PC portable RH."
    },
    {
      reference: "MVT-002",
      articleRef: "STK-001",
      itemName: "Dell Latitude 5540 i7 13th Gen",
      type: "Sortie Affectation",
      quantity: 1,
      performedBy: "Zakaria Radouane (DSI)",
      recipient: "Karim Berrada",
      department: "Ventes & Marketing",
      date: dateSeule("2026-06-01"),
      notes: "Dotation matériel nouveau collaborateur."
    },
    {
      reference: "MVT-001",
      articleRef: "STK-001",
      itemName: "Dell Latitude 5540 i7 13th Gen",
      type: "Entrée Achat",
      quantity: 15,
      performedBy: "Zakaria Radouane (DSI)",
      date: dateSeule("2026-05-15"),
      notes: "Réception de commande fournisseur Apex Tech."
    }
  ];
  for (const m of mouvements) {
    const { articleRef, ...donnees } = m;
    await prisma.mouvementStock.create({
      data: {
        ...donnees,
        id: randomUUID(),
        stockItemId: idArticle.get(articleRef)!,
        creeLe: horodatage()
      }
    });
  }

  // ── Affectations (insertion inversée : 003 → 001) ─────────────────────
  await prisma.affectation.create({
    data: {
      id: randomUUID(),
      reference: "AFF-DSI-2026-003",
      templateType: "STANDARD_DSI_EQUIPMENT",
      beneficiaryName: "Omar Tazi",
      beneficiaryEmail: "o.tazi@entreprise.ma",
      beneficiaryPhone: "+212 6 62 88 99 00",
      beneficiaryCin: "BK445566",
      beneficiaryJobTitle: "Analyste Financier Senior",
      beneficiaryDepartment: "Finance & Contrôle de Gestion",
      beneficiarySite: "Casablanca Siège",
      assignedDate: dateSeule("2026-05-15"),
      status: "Restitué",
      authorizedBy: "Zakaria Radouane",
      dsiTitle: "Directeur des Systèmes d'Information (DSI)",
      termsAccepted: true,
      notes: "Dotation initiale lors de la prise de fonction.",
      creeLe: horodatage(),
      items: {
        create: [
          {
            stockItemId: "STK-001",
            assetTag: "IT-2026-001",
            name: "Lenovo ThinkPad T14s Gen 4 - Core i7 32GB RAM",
            brand: "Lenovo",
            model: "ThinkPad T14s Gen 4",
            serialNumber: "SN-TP-99281-A",
            category: "Laptops & Portables",
            condition: "Très bon état",
            accessories: ["Chargeur 65W USB-C", "Sacoche Lenovo ThinkPad"]
          }
        ]
      },
      returnRecord: {
        create: {
          returnDate: dateSeule("2026-06-05"),
          cause: "Renouvellement matériel / Upgrade",
          equipmentCondition: "Bon état d'usage",
          accessoriesReturned: ["Chargeur 65W USB-C", "Sacoche Lenovo ThinkPad"],
          missingAccessories: [],
          dataWiped: true,
          bitlockerUnlocked: true,
          technicalDiagnosis: "PC testé et fonctionnel. Clavier et écran en bon état. Données réinitialisées aux paramètres d'usine.",
          actionTaken: "Remise en stock disponible",
          inspectedBy: "Zakaria Radouane (DSI)",
          notes: "Restitution effectuée suite à passage sur station de calcul mobile."
        }
      }
    }
  });

  await prisma.affectation.create({
    data: {
      id: randomUUID(),
      reference: "AFF-DSI-2026-002",
      templateType: "STANDARD_DSI_EQUIPMENT",
      beneficiaryName: "Sarah Bennani",
      beneficiaryEmail: "s.bennani@entreprise.ma",
      beneficiaryPhone: "+212 6 61 23 45 67",
      beneficiaryCin: "BE892341",
      beneficiaryJobTitle: "Responsable Recrutement & RH",
      beneficiaryDepartment: "Ressources Humaines & Moyens Généraux",
      beneficiarySite: "Casablanca Siège",
      assignedDate: dateSeule("2026-06-03"),
      status: "Active",
      authorizedBy: "Zakaria Radouane",
      dsiTitle: "Directeur des Systèmes d'Information (DSI)",
      termsAccepted: true,
      notes: "Pack télétravail & bureautique complet remis en main propre.",
      creeLe: horodatage(),
      items: {
        create: [
          {
            stockItemId: "STK-002",
            assetTag: "IT-2026-002",
            name: "Dell Latitude 5540 Core i7 / 16GB / 512GB SSD",
            brand: "Dell",
            model: "Latitude 5540",
            serialNumber: "SN-DL5540-88910",
            category: "Laptops & Portables",
            condition: "Neuf / Excellent état",
            accessories: ["Sacoche Dell Pro 15.6\"", "Bloc d'alimentation 65W USB-C", "Souris sans fil Dell MS116"]
          },
          {
            stockItemId: "STK-004",
            assetTag: "IT-2026-004",
            name: "Écran Professionnel Dell UltraSharp 27\" 4K U2723QE",
            brand: "Dell",
            model: "UltraSharp U2723QE",
            serialNumber: "SN-DELL27-99120",
            category: "Postes Fixes & Écrans",
            condition: "Neuf / Excellent état",
            accessories: ["Câble HDMI 2.0 1.8m", "Câble USB-C vidéo 4K", "Cordon d'alimentation"]
          }
        ]
      }
    }
  });

  await prisma.affectation.create({
    data: {
      id: randomUUID(),
      reference: "AFF-DSI-2026-001",
      templateType: "DISTRA_SIM_SMARTPHONE",
      formCode: "IT-02",
      beneficiaryName: "Abdelhak Elfissi",
      beneficiaryEmail: "a.elfissi@distra.ma",
      beneficiaryPhone: "+212 6 61 88 12 34",
      beneficiaryCin: "BH554210",
      beneficiaryJobTitle: "Responsable Commercial",
      beneficiaryDepartment: "BU - Comm",
      beneficiarySite: "Berrechid",
      assignedDate: dateSeule("2026-08-15"),
      status: "Active",
      authorizedBy: "Directeur Systèmes d'Information",
      dsiTitle: "Département Systèmes D'Information",
      resourceType: "Carte SIM + SmartPhone",
      hasSimCard: true,
      simOperator: "IAM",
      simPhoneNumber: "06 61 88 12 34",
      simPuk: "89230147",
      simPin: "1234",
      hasSmartphone: true,
      deviceBrand: "HP",
      deviceImei: "358920198273615",
      deviceModel: "15-AY002NK",
      deviceConfiguration: "4 GB | 500 GB",
      operationType: "AFFECTATION",
      restitutionPreviousDevice: "NON",
      restitutedDeviceCondition: "Non applicable",
      incidentRemarks: "INCIDENT / PANNE",
      termsAccepted: true,
      notes: "Affectation conforme charte Distra SA. Matériel remis en main propre.",
      creeLe: horodatage(),
      items: {
        create: [
          {
            stockItemId: "STK-006",
            assetTag: "IT-TEL-001",
            name: "HP Smart Device 15-AY002NK (4GB/500GB) + SIM IAM",
            brand: "HP",
            model: "15-AY002NK",
            serialNumber: "358920198273615",
            category: "Périphériques & Accessoires",
            condition: "Neuf / Excellent état",
            accessories: ["Chargeur secteur", "Câble USB", "Kit Piéton"]
          }
        ]
      }
    }
  });

  const counts = {
    fournisseurs: await prisma.fournisseur.count(),
    utilisateurs: await prisma.utilisateur.count(),
    articlesStock: await prisma.articleStock.count(),
    mouvements: await prisma.mouvementStock.count(),
    affectations: await prisma.affectation.count(),
    lignesAffectation: await prisma.ligneAffectation.count(),
    retours: await prisma.retourAffectation.count()
  };
  console.log("Seed terminé :", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
