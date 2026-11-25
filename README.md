# Keyhold

Gestionnaire de mots de passe web, compatible **KeePass / KeePassXC** (format **KDBX 4**, Argon2id).
Tout est chiffré et déchiffré **dans votre navigateur** : aucun serveur ne voit vos données.

- Site statique (Vite + React + TypeScript + Tailwind), hébergé sur Vercel, utilisable hors ligne (PWA).
- Aucun compte, aucun backend, aucun analytics, aucun script tiers.

## Utilisation

1. **Créer un coffre** : nom, mot de passe maître (jauge de robustesse + vérification Have I Been Pwned), fichier clé optionnel (généré au format KeePass XML v2 `.keyx`, ou fichier existant).
2. **Ouvrir un coffre** : n'importe quel `.kdbx` (KeePass 2.x, KeePassXC, KeeWeb…), mot de passe et/ou fichier clé.
3. **Enregistrer** (`Ctrl/Cmd + S`) :
   - Chrome / Edge : écriture directe dans le fichier d'origine (File System Access API).
   - Firefox / Safari : téléchargement du `.kdbx` mis à jour (repli).
   - Option « se souvenir de ce coffre » : seule la copie **chiffrée** est gardée dans IndexedDB pour un accès hors ligne.
4. **Verrouiller** (`Ctrl/Cmd + L`) — automatique après inactivité (5 min par défaut) et dès que l'onglet est masqué.
5. Groupes, entrées (titre, identifiant, mot de passe, URL, notes, champs personnalisés protégés ou non, tags, expiration, historique avec restauration), corbeille, recherche (champs non secrets uniquement).
6. **Générateur** : mot de passe (longueur, jeux de caractères, exclusion des caractères ambigus) ou phrase de passe (liste EFF de 7 776 mots), entropie + jauge zxcvbn-ts.
7. **Audit** : mots de passe compromis (HIBP), faibles, réutilisés, expirés.

Le fichier reste le vôtre : ouvrez-le à tout moment dans KeePassXC.

## Sécurité

### Principes

| Exigence | Mise en œuvre |
|---|---|
| Zéro connaissance | Chiffrement/déchiffrement local via [kdbxweb](https://github.com/keeweb/kdbxweb) (MIT) + WebCrypto. Rien en clair ne quitte l'appareil. |
| Pas de crypto maison | Format KDBX 4 par kdbxweb ; Argon2 par [hash-wasm](https://github.com/Daninet/hash-wasm) (MIT) dans un Web Worker ; SHA-1/SHA-256/AES/HMAC par WebCrypto ; aléa par `crypto.getRandomValues` (tirage sans biais). |
| KDF par défaut | Argon2id, 64 Mio, 10 itérations, parallélisme 2 (~1 s sur un portable récent ; ~2 s à l'enregistrement, vérification incluse). |
| Réseau | Un seul hôte externe : `api.pwnedpasswords.com`, uniquement pour la vérification HIBP. |
| HIBP | k-anonymity : SHA-1 calculé localement, **seuls les 5 premiers caractères** hexadécimaux sont envoyés, en-tête `Add-Padding: true`, `credentials: omit`, `cache: no-store`. Requête **uniquement quand on quitte le champ ou sur « Vérifier »**, jamais pendant la frappe (sinon chaque préfixe partiel fuiterait 20 bits). Désactivable dans les réglages. Résultats en mémoire uniquement, effacés au verrouillage. |
| Stockage | `localStorage` : préférences d'interface uniquement (thème, délai de verrouillage). IndexedDB : uniquement le fichier `.kdbx` **chiffré** (contrôle de signature KDBX avant écriture). Jamais le mot de passe maître ni le fichier clé. |
| Presse-papiers | Vidé 30 s après une copie de secret (et au verrouillage) ; une copie ultérieure d'une valeur non secrète annule l'effacement. Si la lecture du presse-papiers est déjà autorisée, il n'est vidé que s'il contient encore le secret (comparaison d'empreinte SHA-256, le secret n'est pas conservé). |
| Enregistrement | Les enregistrements d'un coffre sont sérialisés (kdbxweb n'est pas ré-entrant) et chaque fichier produit est **redéchiffré avant écriture** : un fichier corrompu n'écrase jamais l'original. Si le fichier sur disque a changé depuis son ouverture (KeePassXC, synchro), l'écriture est refusée (« Enregistrer sous… »). À l'ouverture d'un coffre mémorisé, le fichier d'origine est relu s'il a changé. |
| Verrouillage | Inactivité configurable (échéance sur l'horloge murale, résiste à la mise en veille) + onglet masqué (y compris s'il l'était déjà au déverrouillage) + `pagehide` : la référence à la base déchiffrée est abandonnée. Si des modifications n'étaient pas enregistrées, une copie **chiffrée** de récupération est écrite dans IndexedDB (même si « mémoriser » est désactivé ; supprimée au prochain enregistrement). |

### En-têtes HTTP (`vercel.json`)

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self';
  img-src 'self' data:; font-src 'self'; connect-src 'self' https://api.pwnedpasswords.com;
  worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none';
  frame-ancestors 'none'; upgrade-insecure-requests
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
X-Frame-Options: DENY, Cross-Origin-Opener-Policy: same-origin, Permissions-Policy (tout désactivé)
```

Aucun script ni style inline (vérifié à chaque build par `scripts/check-dist.mjs`).
`'wasm-unsafe-eval'` est **nécessaire** pour compiler le module WebAssembly d'Argon2 ; il n'autorise ni `eval()` ni `new Function()` (contrairement à `'unsafe-eval'`). Sans lui, Argon2 en JS pur serait 10 à 20× plus lent.

### Modèle de menace

**Protège contre :**
- Le serveur d'hébergement (Vercel) ou un intermédiaire réseau : ils ne voient que du code statique ; aucune donnée utilisateur ne leur est envoyée.
- Le vol du fichier `.kdbx` ou de la copie IndexedDB : protégé par AES-256/ChaCha20 et Argon2id (robustesse = celle du mot de passe maître + fichier clé).
- Have I Been Pwned : n'apprend qu'un préfixe de 5 caractères partagé par des centaines de hachages (k-anonymity, padding contre l'analyse de taille).
- Injection de script tiers / XSS classique : CSP stricte sans inline, aucun `innerHTML`, React échappe tout.
- Clickjacking : `frame-ancestors 'none'`.
- Oubli d'un onglet ouvert : verrouillage automatique.

**Ne protège PAS contre :**
- Un appareil compromis (malware, keylogger, extension de navigateur malveillante ayant accès à la page).
- Une compromission de la chaîne de livraison du code (compte Vercel/GitHub, dépendance npm piégée) : une appli web sert son code à chaque visite. Atténuation : dépendances épinglées (`package-lock.json`), aucune dépendance chargée depuis un CDN, PWA mise en cache ; pour un niveau de confiance maximal, auto-hébergez un build vérifié.
- Un mot de passe maître faible.
- L'accès physique à une session **déverrouillée**.

### Limites connues

- **Mémoire** : JavaScript ne permet pas d'effacer de façon garantie les chaînes en mémoire. kdbxweb garde les champs protégés chiffrés en mémoire (XOR + sel) et ne les déchiffre qu'à l'affichage/copie, mais des copies peuvent subsister jusqu'au ramasse-miettes.
- **Presse-papiers** : l'effacement après 30 s échoue si la page n'a plus le focus à ce moment ; il est retenté au retour du focus. Les gestionnaires d'historique du presse-papiers (OS) peuvent conserver une copie.
- **Verrouillage sur `pagehide`** (fermeture d'onglet) : la copie de récupération chiffrée est asynchrone et peut ne pas aboutir ; le navigateur demande toutefois confirmation avant de fermer un onglet avec des modifications non enregistrées.
- **Mot de passe maître** : les champs sont en `autocomplete="off"`, mais certains navigateurs peuvent quand même proposer de l'enregistrer ; refusez.
- **Mise à jour silencieuse** : la PWA se met à jour automatiquement ; un déploiement compromis remplacerait le code (limite inhérente à toute appli web hébergée).
- **Navigateurs sans File System Access API** (Firefox, Safari) : l'enregistrement télécharge un nouveau fichier au lieu de réécrire l'original.
- **Non pris en charge** (MVP) : pièces jointes (conservées mais non éditables), YubiKey / challenge-response, synchronisation/fusion, saisie automatique, extension navigateur, Argon2 version 0x10 (très anciens fichiers).
- Les fichiers KDBX 3.1 s'ouvrent et se réenregistrent dans leur format d'origine.
- `kdbxweb` : dernière version npm 2.1.1 (2021), non maintenue activement (dépôt modifié pour la dernière fois en 2024) ; c'est pourtant la seule implémentation KDBX 4 JavaScript éprouvée (KeeWeb). Ses dépendances Node (`@xmldom/xmldom`, `crypto`) sont remplacées par des stubs dans le bundle navigateur : le `DOMParser` natif et WebCrypto sont utilisés (y compris en test, Node 22 exposant `crypto.subtle`). Dépendances runtime épinglées en version exacte. `npm audit --omit=dev` : 0 vulnérabilité (4 modérées en dev, via workbox-build, outil de build uniquement).

## Compatibilité vérifiée

Tests automatisés (`tests/kdbx-fixtures.test.ts`) :
- fichier KDBX 4 / Argon2id créé par Keyhold puis **modifié et réenregistré par `keepassxc-cli` 2.7.6**, rouvert par Keyhold ;
- base créée nativement par KeePassXC 2.7.6 (avec historique) ; base KeePassXC protégée par fichier clé seul ;
- fichiers de référence KeePass 2.x de la suite de tests kdbxweb (KDBX 4.1, Argon2id + fichier clé).

Vérifié manuellement : une base Keyhold (Argon2id 64 Mio, fichier clé, tags, champ protégé) s'ouvre dans `keepassxc-cli` 2.7.6.

## Développement

```bash
npm ci
npm run dev          # http://localhost:5173
npm run verify       # lint + typecheck + tests + build + e2e (gates)
```

Gates (revue de sécurité indépendante effectuée ; tous les findings critiques/hauts/moyens corrigés, avec tests de régression) :
- `npm run lint` : oxlint (`no-explicit-any`, `ban-ts-comment`, `no-console`, …) + `scripts/check-forbidden.mjs` (rejette `any`, `@ts-ignore`, `eslint-disable`, `.skip`, `catch {}` vide, `innerHTML`, `console.*`).
- `npm test` : aller-retour KDBX, mauvais mot de passe / fichier corrompu, fixtures KeePassXC, HIBP (seul le préfixe de 5 caractères part — `fetch` mocké), isolation réseau (statique + runtime), générateur.
- `npm run build` : typecheck + build + `scripts/check-dist.mjs` (HTML sans inline).
- `npm run e2e` : Playwright sur `dist/` servi avec les en-têtes exacts de `vercel.json` — aucune violation CSP, aucune requête HIBP pendant la frappe, préfixe de 5 caractères + `Add-Padding` seulement, aucune requête vers une autre origine, aucun secret dans localStorage/sessionStorage/titre/URL, IndexedDB ne contient que des conteneurs KDBX chiffrés.

## Déploiement (Vercel)

Projet Vercel relié au dépôt GitHub, framework « Vite », commande `npm run build`, sortie `dist`. Les en-têtes de sécurité viennent de `vercel.json`.

## Licences et crédits

- Code : MIT.
- [kdbxweb](https://github.com/keeweb/kdbxweb) (MIT), [hash-wasm](https://github.com/Daninet/hash-wasm) (MIT), [zxcvbn-ts](https://github.com/zxcvbn-ts/zxcvbn) (MIT), [lucide](https://lucide.dev) (ISC), Inter (OFL).
- Liste de mots : [EFF Large Wordlist](https://www.eff.org/dice) — Electronic Frontier Foundation, CC BY 3.0 US.
- Fixtures de test : voir `tests/fixtures/README.md`.
- « KeePass » et « KeePassXC » sont des projets indépendants ; Keyhold n'y est pas affilié.
