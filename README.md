# 🚀 GTech MediaBot

> **Système d'automatisation Facebook alimenté par l'IA pour G-tech-academy**
> **AI-powered Facebook automation system for G-tech-academy**

By **Billy Doumbouya** · G-tech-academy · Africa Tech 🌍

---

## 🇫🇷 DOCUMENTATION FRANÇAISE

### 📌 À propos du projet

GTech MediaBot est un système d'automatisation sociale complet qui :

- Génère automatiquement du contenu en français avec l'IA (OpenRouter)
- Crée des visuels futuristes 1200×630px via des templates HTML/CSS rendus par Puppeteer
- Publie automatiquement 3 fois par jour sur ta PAGE Facebook G-tech-academy
- Stocke tout l'historique et les analytics dans MongoDB Atlas
- Tourne en continu sur Railway sans intervention manuelle

### 🏗️ Architecture du projet

```
gtech-mediabot/
├── src/
│   ├── ai/
│   │   ├── openrouter.js       ← Client API OpenRouter (génération de contenu)
│   │   └── prompts.js          ← Templates de prompts par catégorie
│   ├── automation/
│   │   ├── browserManager.js   ← Gestionnaire Puppeteer (singleton browser)
│   │   ├── facebookGraphAPI.js ← Publication Graph API (méthode primaire)
│   │   ├── facebookPuppeteer.js← Publication Puppeteer (méthode fallback)
│   │   └── screenshotGenerator.js ← HTML → Image PNG
│   ├── config/
│   │   └── index.js            ← Chargement centralisé des variables d'env
│   ├── controllers/
│   │   └── postController.js   ← Logique HTTP (mince, délègue aux services)
│   ├── database/
│   │   └── connection.js       ← Connexion MongoDB Atlas
│   ├── middleware/
│   │   └── errorHandler.js     ← Gestionnaire d'erreurs global Express
│   ├── models/
│   │   ├── Post.js             ← Schéma Mongoose pour les posts
│   │   └── Analytics.js        ← Schéma Mongoose pour les analytics
│   ├── routes/
│   │   └── index.js            ← Définition des routes Express
│   ├── schedulers/
│   │   └── postScheduler.js    ← Cron jobs (3x/jour)
│   ├── scripts/
│   │   ├── manualTrigger.js    ← Déclenchement manuel (CLI)
│   │   └── setupSession.js     ← Configuration session Puppeteer (1 fois)
│   ├── services/
│   │   └── postService.js      ← Pipeline métier complet
│   ├── templates/
│   │   └── layouts.js          ← 5 layouts HTML/CSS dynamiques
│   ├── utils/
│   │   ├── asyncWrapper.js     ← Wrapper async + retry logic
│   │   └── logger.js           ← Configuration Winston
│   └── app.js                  ← Point d'entrée principal
├── .env.example                ← Template de configuration
├── .gitignore
└── package.json
```

### 📊 Pipeline complet

```
Cron Job (8h / 12h / 19h)
        ↓
  OpenRouter AI  →  Contenu JSON (titre, texte, CTA, hashtags)
        ↓
  Template HTML  →  Rendu dynamique avec le contenu AI
        ↓
  Puppeteer      →  Screenshot PNG 1200×630px
        ↓
  Graph API      →  Publication Facebook PAGE
        ↓  (si échec)
  Puppeteer      →  Publication fallback
        ↓
  MongoDB        →  Sauvegarde historique + analytics
```

### 🎨 Les 5 Layouts Visuels

| Layout           | Catégorie      | Style                                     |
| ---------------- | -------------- | ----------------------------------------- |
| `morning-glow`   | Matin          | Gradient violet-orange, énergie explosive |
| `tech-grid`      | Midi           | Dark tech, ambiance terminal/code         |
| `cta-blast`      | Soir           | CTA centré, conversion maximale           |
| `quote-card`     | Flexible       | Citation minimaliste, élégant             |
| `academy-banner` | Institutionnel | Split layout, branding G-tech             |

### ⏰ Stratégie de publication

| Heure | Catégorie | Contenu                                     |
| ----- | --------- | ------------------------------------------- |
| 08:00 | `morning` | Motivation entrepreneuriale, mindset        |
| 12:00 | `midday`  | Tech, code, carrière, conseils pratiques    |
| 19:00 | `evening` | CTA G-tech-academy, rejoindre la communauté |

---

### 🛠️ Installation locale

**Prérequis :** Node.js 18+, compte MongoDB Atlas, clé OpenRouter

```bash
# 1. Cloner le projet
git clone https://github.com/ton-compte/gtech-mediabot.git
cd gtech-mediabot

# 2. Installer les dépendances
npm install

# 3. Configurer l'environnement
cp .env.example .env
# Ouvre .env et remplis toutes les variables

# 4. (Optionnel) Configurer la session Puppeteer
npm run setup-session
# Un navigateur visible s'ouvre → connecte-toi à Facebook → appuie ENTRÉE

# 5. Lancer en développement
npm run dev

# 6. Tester manuellement
npm run trigger morning
npm run trigger midday
npm run trigger evening
```

---

### ☁️ Déploiement Railway

Railway est une plateforme cloud simple qui exécute des apps Node.js sans configuration complexe.

**Étapes :**

1. Crée un compte sur [railway.app](https://railway.app)
2. Crée un nouveau projet → "Deploy from GitHub repo"
3. Connecte ton dépôt GitHub
4. Va dans **Variables** et ajoute toutes les variables de `.env.example`
5. Railway détecte automatiquement `npm start` comme commande de démarrage
6. Le bot démarre et tourne 24/7

**Variables Railway obligatoires :**

```
MONGODB_URI
OPENROUTER_API_KEY
FACEBOOK_PAGE_ID
FACEBOOK_PAGE_ACCESS_TOKEN
NODE_ENV=production
```

---

### 🍃 Configuration MongoDB Atlas

1. Crée un compte sur [cloud.mongodb.com](https://cloud.mongodb.com)
2. Crée un cluster gratuit (M0)
3. Crée un utilisateur database (Database Access)
4. Autorise les connexions depuis partout : `0.0.0.0/0` (Network Access)
5. Clique "Connect" → "Connect your application" → copie l'URI
6. Remplace `<password>` dans l'URI par ton mot de passe
7. Colle dans `MONGODB_URI` de ton `.env`

---

### 🤖 Configuration OpenRouter

1. Crée un compte sur [openrouter.ai](https://openrouter.ai)
2. Va dans **Keys** → crée une nouvelle clé API
3. Copie la clé dans `OPENROUTER_API_KEY`
4. Modèle recommandé : `mistralai/mistral-7b-instruct` (rapide + économique)
5. Alternative premium : `anthropic/claude-3-haiku` (meilleure qualité)

---

### 📘 Configuration Facebook

#### Méthode 1 : Graph API (recommandée)

1. Va sur [developers.facebook.com](https://developers.facebook.com)
2. Crée une App → type "Business"
3. Ajoute le produit "Pages"
4. Dans Graph API Explorer → sélectionne ta PAGE
5. Génère un Page Access Token avec permissions : `pages_manage_posts`, `pages_read_engagement`
6. Convertis en token long-lived via [Access Token Debugger](https://developers.facebook.com/tools/debug/accesstoken/)
7. Copie le **Page ID** (dans les paramètres de ta page) et le **token**

#### Méthode 2 : Session Puppeteer (fallback)

```bash
npm run setup-session
```

- Un navigateur s'ouvre
- Connecte-toi manuellement à Facebook
- Navigue vers ta page G-tech-academy
- Appuie ENTRÉE dans le terminal
- La session est sauvegardée → plus besoin de te reconnecter

---

### 📡 Endpoints API

| Méthode | Route               | Description                     |
| ------- | ------------------- | ------------------------------- |
| `GET`   | `/health`           | Status du serveur               |
| `POST`  | `/api/trigger-post` | Déclencher un post manuellement |
| `GET`   | `/api/posts`        | Historique des posts            |
| `GET`   | `/api/analytics`    | Analytics du jour + global      |

**Exemple :**

```bash
# Déclencher un post matin manuellement
curl -X POST http://localhost:3000/api/trigger-post \
  -H "Content-Type: application/json" \
  -d '{"category": "morning"}'
```

---

### 📝 Système de logs

Les logs sont gérés par **Winston** et stockés dans `src/logs/` :

| Fichier          | Contenu                                       |
| ---------------- | --------------------------------------------- |
| `app.log`        | Tous les événements (info, warn, error)       |
| `error.log`      | Erreurs uniquement (plus facile à surveiller) |
| `exceptions.log` | Exceptions non gérées                         |
| `rejections.log` | Promesses rejetées non gérées                 |

---

### 🔮 Évolutivité future

Le projet est architecturé pour s'étendre facilement :

- **Instagram** → ajouter `src/automation/instagramPublisher.js`
- **LinkedIn** → ajouter `src/automation/linkedinPublisher.js`
- **WhatsApp Business** → via Meta API officielle
- **TikTok** → via TikTok Developer API
- **Nouveaux layouts** → ajouter dans `src/templates/layouts.js`
- **Nouvelles catégories de contenu** → ajouter dans `src/ai/prompts.js`
- **Dashboard web** → ajouter un frontend React consommant l'API Express

---

## 🇬🇧 ENGLISH DOCUMENTATION

### 📌 About the Project

GTech MediaBot is a complete social automation system that:

- Automatically generates French-language content using AI (OpenRouter)
- Creates futuristic 1200×630px visuals via HTML/CSS templates rendered by Puppeteer
- Automatically publishes 3 times daily to the G-tech-academy Facebook PAGE
- Stores all history and analytics in MongoDB Atlas
- Runs continuously on Railway with no manual intervention

### 🛠️ Local Installation

**Requirements:** Node.js 18+, MongoDB Atlas account, OpenRouter API key

```bash
# 1. Clone the project
git clone https://github.com/your-account/gtech-mediabot.git
cd gtech-mediabot

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Open .env and fill in all variables

# 4. (Optional) Set up Puppeteer session
npm run setup-session

# 5. Start in development
npm run dev

# 6. Manually test the pipeline
npm run trigger morning
npm run trigger midday
npm run trigger evening
```

### ☁️ Railway Deployment

1. Create account at [railway.app](https://railway.app)
2. New Project → "Deploy from GitHub repo"
3. Connect your GitHub repository
4. Go to **Variables** and add all variables from `.env.example`
5. Railway auto-detects `npm start`
6. Bot runs 24/7 automatically

### 🏛️ Architecture Principles

| Principle              | Implementation                                        |
| ---------------------- | ----------------------------------------------------- |
| Separation of concerns | controllers / services / models / routes are separate |
| Single responsibility  | Each file does ONE thing                              |
| Fail gracefully        | Every cron error is caught — scheduler never dies     |
| Hybrid publishing      | Graph API primary → Puppeteer fallback                |
| Session persistence    | Login once, reuse session for months                  |
| Centralized config     | All env vars validated at startup                     |
| Structured logging     | Winston with rotation and log levels                  |

### 🔑 Key Commands

```bash
npm start              # Production start
npm run dev            # Development with auto-reload
npm run trigger morning  # Manual pipeline test
npm run setup-session   # One-time browser session setup
```

---

## 📄 License

MIT — Billy Doumbouya · G-tech-academy · 2024

---

_Built with ❤️ for African tech entrepreneurship 🌍_
#   g - t e c h - m e d i a b o t 
 
 
