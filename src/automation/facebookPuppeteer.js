/**
 * src/automation/facebookPuppeteer.js
 * ============================================================
 * FACEBOOK PAGE PUBLISHER — VERSION PRODUCTION OPTIMISÉE
 * ============================================================
 */

import path from "path";
import fs from "fs-extra";
import { newPage } from "./browserManager.js";
import { config } from "../config/index.js";
import logger from "../utils/logger.js";

// ============================================================
// CONSTANTES & CONFIGURATION
// ============================================================

const FB_URL = "https://www.facebook.com";

const TIMEOUTS = {
  navigation: 45_000,
  action: 20_000,
  upload: 30_000,
  postConfirm: 15_000,
};

const TYPING_DELAY = 18;
let isPublishing = false;
const DEBUG_DIR = path.resolve("./generated-images");

// ============================================================
// POINT D'ENTRÉE PRINCIPAL
// ============================================================

export const publishViaPuppeteer = async (imagePath, caption) => {
  if (isPublishing) {
    throw new Error("[FB] Concurrency lock active — publication déjà en cours");
  }

  isPublishing = true;
  let page = null;

  try {
    await fs.ensureDir(DEBUG_DIR);
    logger.info("[FB] Démarrage du pipeline de publication Puppeteer");

    page = await newPage();

    const loggedIn = await checkLoginStatus(page);

    if (!loggedIn) {
      logger.info("[FB] Session expirée ou inexistante, reconnexion...");
      await loginToFacebook(page);
    } else {
      logger.info("[FB] Session active, étape de login ignorée");
    }

    await navigateToPage(page);

    const postId = await createPost(page, imagePath, caption);
    logger.info("[FB] ✅ Publication réussie avec succès", { postId });

    return { status: "success", facebookPostId: postId ?? null };
  } catch (error) {
    if (page) {
      await page
        .screenshot({
          path: path.join(DEBUG_DIR, "fb-error.png"),
          fullPage: true,
        })
        .catch(() => {});
    }

    logger.error("[FB] ❌ Échec critique de la publication", {
      message: error.message,
      stack: error.stack,
    });

    throw error;
  } finally {
    isPublishing = false;
    if (page) {
      await page.close().catch(() => {});
    }
  }
};

// ============================================================
// VÉRIFICATION DE LA SESSION
// ============================================================

const checkLoginStatus = async (page) => {
  try {
    await page.goto(FB_URL, {
      waitUntil: "domcontentloaded",
      timeout: TIMEOUTS.navigation,
    });

    await sleep(3000);

    const currentUrl = page.url();
    logger.info(`[FB] URL après navigation initiale: ${currentUrl}`);

    if (currentUrl.includes("/login") || currentUrl.includes("login.php")) {
      logger.info("[FB] Redirection vers page de login détectée");
      return false;
    }

    const isLoggedIn = await page.evaluate(() => {
      const loginForm =
        document.querySelector('input[name="email"]') ||
        document.querySelector("#email");
      if (loginForm) return false;

      const indicators = [
        document.querySelector('[aria-label="Facebook"]'),
        document.querySelector('[data-pagelet="LeftRail"]'),
        document.querySelector('[role="navigation"]'),
        document.querySelector('div[data-pagelet="Stories"]'),
      ];
      return indicators.some((el) => el !== null);
    });

    logger.info(`[FB] Statut de connexion évalué: ${isLoggedIn}`);
    return isLoggedIn;
  } catch (err) {
    logger.warn("[FB] Erreur lors de la vérification de session", {
      message: err.message,
    });
    return false;
  }
};

// ============================================================
// AUTHENTIFICATION
// ============================================================

const loginToFacebook = async (page) => {
  const { email, password } = config.facebook;

  if (!email || !password) {
    throw new Error(
      "[FB] Identifiants FACEBOOK_EMAIL ou FACEBOOK_PASSWORD absents du fichier .env",
    );
  }

  logger.info("[FB] Rendu de la page d'authentification...");
  await page.goto(`${FB_URL}/login`, {
    waitUntil: "networkidle2",
    timeout: TIMEOUTS.navigation,
  });

  await sleep(2000);

  // Saisie de l'identifiant
  const emailSelectors = [
    "#email",
    'input[name="email"]',
    'input[type="email"]',
  ];
  let emailFilled = false;

  for (const sel of emailSelectors) {
    try {
      await page.waitForSelector(sel, { visible: true, timeout: 5000 });
      await page.$eval(sel, (el) => (el.value = ""));
      await page.type(sel, email, { delay: 25 });
      emailFilled = true;
      break;
    } catch {}
  }

  if (!emailFilled) throw new Error("[FB] Champ de saisie email introuvable");

  // Saisie du mot de passe
  const passSelectors = [
    "#pass",
    'input[name="pass"]',
    'input[type="password"]',
  ];
  let passFilled = false;

  for (const sel of passSelectors) {
    try {
      await page.waitForSelector(sel, { visible: true, timeout: 5000 });
      await page.$eval(sel, (el) => (el.value = ""));
      await page.type(sel, password, { delay: 25 });
      passFilled = true;
      break;
    } catch {}
  }

  if (!passFilled)
    throw new Error("[FB] Champ de saisie mot de passe introuvable");

  await sleep(500);

  // Soumission du formulaire
  const loginSelectors = [
    '[name="login"]',
    'button[type="submit"]',
    '[data-testid="royal_login_button"]',
  ];
  let formSubmitted = false;

  for (const sel of loginSelectors) {
    try {
      await page.click(sel);
      formSubmitted = true;
      break;
    } catch {}
  }

  if (!formSubmitted)
    throw new Error("[FB] Bouton de soumission de connexion introuvable");

  await page.waitForNavigation({
    waitUntil: "networkidle2",
    timeout: TIMEOUTS.navigation,
  });

  const url = page.url();
  if (url.includes("/login") || url.includes("checkpoint")) {
    throw new Error(`[FB] Échec d'authentification. Bloqué sur l'URL: ${url}`);
  }

  logger.info("[FB] ✅ Authentification réussie");
  await sleep(3000);
};

// ============================================================
// NAVIGATION VERS LA PAGE CIBLE
// ============================================================

const navigateToPage = async (page) => {
  const pageUrl = `${FB_URL}/${config.facebook.pageName}`;
  logger.info(`[FB] Redirection vers l'espace de la page: ${pageUrl}`);

  await page.goto(pageUrl, {
    waitUntil: "networkidle2",
    timeout: TIMEOUTS.navigation,
  });

  await handleSwitchToPageModal(page);

  await page
    .screenshot({ path: path.join(DEBUG_DIR, "fb-page-loaded.png") })
    .catch(() => {});
};

const handleSwitchToPageModal = async (page) => {
  try {
    const switchBtn = await page.waitForSelector(
      [
        '[aria-label*="Switch now"]',
        '[aria-label*="Basculer"]',
        '[aria-label*="Switch to"]',
      ].join(", "),
      { timeout: 4000, visible: true },
    );

    if (switchBtn) {
      logger.info(
        "[FB] Modale de basculement de profil détectée, exécution...",
      );
      await switchBtn.click();
      await page
        .waitForNetworkIdle({ idleTime: 1500, timeout: 8000 })
        .catch(() => {});
    }
  } catch {
    // Aucune modale détectée, comportement normal attendu
  }
};

// ============================================================
// FLUX DE CRÉATION DU POST
// ============================================================

const createPost = async (page, imagePath, caption) => {
  logger.info("[FB] Initialisation du compositeur de texte...");
  const composerOpened = await openComposer(page);

  if (!composerOpened) {
    throw new Error(
      "[FB] Impossible d'initialiser ou de trouver la fenêtre d'écriture",
    );
  }

  await page
    .screenshot({ path: path.join(DEBUG_DIR, "fb-composer-open.png") })
    .catch(() => {});

  logger.info("[FB] Injection de l'élément média...");
  await uploadImage(page, imagePath);

  logger.info("[FB] Écriture de la légende de publication...");
  await typeCaption(page, caption);

  await page
    .screenshot({ path: path.join(DEBUG_DIR, "fb-before-submit.png") })
    .catch(() => {});

  logger.info("[FB] Envoi de l'ordre de publication...");
  await clickPostButton(page);

  logger.info("[FB] Analyse et validation de la mise en ligne...");
  const postId = await waitForPostConfirmation(page);

  await page
    .screenshot({ path: path.join(DEBUG_DIR, "fb-after-submit.png") })
    .catch(() => {});

  return postId;
};

// ============================================================
// OUVERTURE DE L'ÉDITEUR
// ============================================================

const openComposer = async (page) => {
  const textSelectors = [
    "::-p-text(What's on your mind)",
    "::-p-text(Share a thought)",
    "::-p-text(Qu'avez-vous en tête)",
    "::-p-text(Quoi de neuf)",
    "::-p-text(Write something)",
    "::-p-text(Écrivez quelque chose)",
  ];

  for (const sel of textSelectors) {
    try {
      const el = await page.$(sel);
      if (el) {
        await el.click();
        await page
          .waitForNetworkIdle({ idleTime: 1000, timeout: 5000 })
          .catch(() => {});
        return true;
      }
    } catch {}
  }

  const ariaSelectors = [
    'div[role="main"] div[role="button"][tabindex="0"]',
    '[data-pagelet="FeedComposer"] div[role="button"]',
  ];

  for (const sel of ariaSelectors) {
    try {
      const el = await page.$(sel);
      if (el) {
        const text = await page.evaluate((node) => node.innerText ?? "", el);
        if (text.length > 2) {
          await el.click();
          await page
            .waitForNetworkIdle({ idleTime: 1000, timeout: 5000 })
            .catch(() => {});
          return true;
        }
      }
    } catch {}
  }

  const found = await page.evaluate(() => {
    const keywords = [
      "what's on your mind",
      "share a thought",
      "qu'avez-vous en tête",
      "quoi de neuf",
      "write something",
      "écrivez quelque chose",
    ];
    const nodes = document.querySelectorAll('div[role="button"], span');
    for (const node of nodes) {
      const text = (node.innerText || node.textContent || "")
        .toLowerCase()
        .trim();
      if (keywords.some((k) => text.includes(k))) {
        const clickable = node.closest('[role="button"]') ?? node;
        clickable.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        return true;
      }
    }
    return false;
  });

  if (found) {
    await page
      .waitForNetworkIdle({ idleTime: 1000, timeout: 5000 })
      .catch(() => {});
  }

  return found;
};

// ============================================================
// COMPORTEMENT D'UPLOAD MEDIA (CORRIGÉ)
// ============================================================

const uploadImage = async (page, imagePath) => {
  const absPath = path.resolve(imagePath);
  if (!(await fs.pathExists(absPath))) {
    throw new Error(`[FB] Fichier image introuvable: ${absPath}`);
  }

  // 1. Essayer directement l'input caché (injecté par Facebook sans clic)
  let fileInput = await page.$('div[role="dialog"] input[type="file"]');
  if (fileInput) {
    await fileInput.uploadFile(absPath);
    logger.info(
      "[FB] Fichier uploadé via le champ hidden (sans boîte de dialogue).",
    );
    await waitForImagePreview(page);
    return;
  }

  // 2. Fallback : activation du bouton média avec interception du file chooser natif
  logger.info(
    "[FB] Input absent, activation du bouton média avec interception de la boîte de dialogue...",
  );

  const photoBtnSelector = [
    'div[role="dialog"] [aria-label*="Photo"]',
    'div[role="dialog"] [aria-label*="photo"]',
    'div[role="dialog"] [aria-label*="Video"]',
    'div[role="dialog"] [aria-label*="Média"]',
  ].join(", ");

  const photoBtn = await page.waitForSelector(photoBtnSelector, {
    timeout: 5000,
    visible: true,
  });

  // On prépare l'interception du file chooser AVANT le clic
  const fileChooserPromise = page
    .waitForFileChooser({ timeout: 3000 })
    .catch(() => null);
  await photoBtn.click();

  const fileChooser = await fileChooserPromise;
  if (fileChooser) {
    // On utilise la boîte de dialogue native pour uploader → elle se ferme automatiquement
    await fileChooser.accept([absPath]);
    logger.info("[FB] Image uploadée via le file chooser natif.");
  } else {
    // Aucune boîte de dialogue, l'input devrait être maintenant présent
    fileInput = await page.waitForSelector('input[type="file"]', {
      timeout: 5000,
    });
    if (!fileInput)
      throw new Error(
        "[FB] Input file introuvable après activation du bouton média.",
      );
    await fileInput.uploadFile(absPath);
    logger.info("[FB] Image uploadée via input après activation.");
  }

  await waitForImagePreview(page);
};

const waitForImagePreview = async (page) => {
  try {
    await page.waitForSelector(
      [
        'div[role="dialog"] img[src*="blob:"]',
        'div[role="dialog"] img[src*="facebook"]',
        'div[role="dialog"] div[data-visualcompletion="media-vc-image"]',
      ].join(", "),
      { timeout: TIMEOUTS.upload, visible: true },
    );
    logger.info("[FB] Aperçu image confirmé dans le compositor");
  } catch {
    logger.warn(
      "[FB] Aperçu image non détecté visuellement, application du délai de sécurité...",
    );
    await sleep(5000);
  }
};

// ============================================================
// RECOUVREMENT ET ÉCRITURE DU TEXTE
// ============================================================

const typeCaption = async (page, caption) => {
  if (!caption) return;

  const textboxSelectors = [
    'div[role="dialog"] div[contenteditable="true"]',
    'div[role="dialog"] div[role="textbox"]',
    'div[contenteditable="true"][data-lexical-editor="true"]',
  ];

  let textbox = null;

  for (const sel of textboxSelectors) {
    try {
      textbox = await page.waitForSelector(sel, {
        timeout: TIMEOUTS.action,
        visible: true,
      });
      if (textbox) break;
    } catch {}
  }

  if (!textbox) {
    logger.warn(
      "[FB] Zone d'édition introuvable. Recours au mécanisme de simulation virtuelle",
    );
    await typeViaCopyPaste(page, caption);
    return;
  }

  await textbox.click();
  await sleep(400);
  await page.keyboard.type(caption, { delay: TYPING_DELAY });
  logger.info("[FB] Chaîne de texte injectée dans le champ d'écriture");
};

const typeViaCopyPaste = async (page, caption) => {
  await page.evaluate(async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "absolute";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
  }, caption);

  await page.keyboard.down("Control");
  await page.keyboard.press("v");
  await page.keyboard.up("Control");
};

// ============================================================
// VALIDATION ET CLIC SUR LE BOUTON PUBLIER (OPTIMISÉ)
// ============================================================

// ============================================================
// VALIDATION ET CLIC SUR LE BOUTON PUBLIER (CORRIGÉ – NE FERME PAS LA BOÎTE)
// ============================================================

const clickPostButton = async (page) => {
  logger.info("[FB] Retrait propre du focus sans fermer le compositeur...");

  // 1. Cliquer dans la zone d'édition pour déplacer le focus
  const textboxSelectors = [
    'div[role="dialog"] div[contenteditable="true"]',
    'div[role="dialog"] div[role="textbox"]',
  ];

  let textbox = null;
  for (const sel of textboxSelectors) {
    try {
      textbox = await page.waitForSelector(sel, {
        timeout: 2000,
        visible: true,
      });
      if (textbox) break;
    } catch {}
  }

  if (textbox) {
    await textbox.click({ clickCount: 1 }); // simple clic, pas de triple clic
    await sleep(300);
    // Appuyer sur la touche "Fin" pour sortir des suggestions (sans fermer)
    await page.keyboard.press("End");
    await sleep(300);
  } else {
    // Fallback : cliquer dans un endroit neutre du dialogue
    await page.evaluate(() => {
      const dialog = document.querySelector('div[role="dialog"]');
      if (dialog) dialog.click();
    });
    await sleep(500);
  }

  logger.info("[FB] Recherche du bouton de soumission...");

  const selectors = [
    'div[role="dialog"] div[aria-label="Post"]',
    'div[role="dialog"] div[aria-label="Publier"]',
    'div[role="dialog"] div[aria-label="Share"]',
    'div[role="dialog"] div[aria-label="Partager"]',
    'div[role="dialog"] div[aria-label="Publicar"]',
    'div[role="dialog"] div[role="button"] ::-p-text(Post)',
    'div[role="dialog"] div[role="button"] ::-p-text(Publier)',
    'div[role="dialog"] div[role="button"] ::-p-text(Share)',
    'div[role="dialog"] div[role="button"] ::-p-text(Partager)',
  ];

  // 2. Attente active du bouton cliquable (jusqu'à 15 secondes)
  const start = Date.now();
  let btn = null;

  while (!btn && Date.now() - start < 15_000) {
    for (const selector of selectors) {
      try {
        const el = await page.$(selector);
        if (el) {
          // Vérifier qu'il n'est pas désactivé (opacité faible ou grisé)
          const isDisabled = await el.evaluate((node) => {
            const style = window.getComputedStyle(node);
            return (
              style.opacity < 0.5 ||
              node.getAttribute("aria-disabled") === "true"
            );
          });
          if (!isDisabled) {
            btn = el;
            logger.info(`[FB] Bouton actif trouvé : ${selector}`);
            break;
          }
        }
      } catch {}
    }
    if (!btn) await sleep(500);
  }

  // 3. Fallback amélioré : chercher le bouton bleu (couleur primaire Facebook)
  if (!btn) {
    logger.warn(
      "[FB] Aucun sélecteur n'a fonctionné, recherche du bouton bleu...",
    );
    btn = await page
      .evaluateHandle(() => {
        const dialog = document.querySelector('div[role="dialog"]');
        if (!dialog) return null;
        const allButtons = Array.from(
          dialog.querySelectorAll('[role="button"], button'),
        );
        // Ne garder que les boutons de taille suffisante et de couleur bleue
        const valid = allButtons.filter((b) => {
          const rect = b.getBoundingClientRect();
          if (rect.height < 25 || rect.width < 50) return false;
          const style = window.getComputedStyle(b);
          const bg = style.backgroundColor;
          // Détection simple du bleu Facebook (hex ou rgb)
          return (
            bg.includes("rgb(24, 119, 242)") ||
            bg.includes("#1877f2") ||
            bg.includes("rgb(23, 119, 242)") ||
            b.getAttribute("aria-label")?.toLowerCase().includes("post") ||
            b.getAttribute("aria-label")?.toLowerCase().includes("publier") ||
            b.getAttribute("aria-label")?.toLowerCase().includes("share")
          );
        });
        // On prend le dernier (généralement le bouton de publication)
        return valid[valid.length - 1] || null;
      })
      .then((h) => h.asElement());
  }

  if (!btn) {
    throw new Error(
      "[FB] Blocage critique : Bouton d'envoi final non localisable.",
    );
  }

  await page.evaluate((el) => el.scrollIntoView({ block: "center" }), btn);
  await sleep(1500);

  logger.info("[FB] Clic final sur le bouton de publication...");
  try {
    await btn.click();
  } catch (err) {
    await page.evaluate((el) => el.click(), btn);
  }

  logger.info(
    "[FB] 🎉 Ordre de publication envoyé ! Passage à la confirmation...",
  );
};

// ============================================================
// VALIDATION DU FLUX ET ANALYSE POST-POST
// ============================================================

const waitForPostConfirmation = async (page) => {
  try {
    await page.waitForSelector('div[role="dialog"]', {
      hidden: true,
      timeout: TIMEOUTS.postConfirm,
    });
    logger.info("[FB] Fermeture de l'interface d'édition détectée");
  } catch {
    logger.warn(
      "[FB] Fin de boîte de dialogue non détectée à la fin de la limite temporelle",
    );
  }

  try {
    await page.waitForFunction(
      () => !document.querySelector('[data-visualcompletion="loading-state"]'),
      { timeout: 8000 },
    );
  } catch {}

  return await page.evaluate(() => {
    const links = Array.from(
      document.querySelectorAll('a[href*="/posts/"], a[href*="fbid="]'),
    );
    if (links.length > 0) {
      const href = links[0].href;
      const match = href.match(/\/posts\/(\d+)/) ?? href.match(/fbid=(\d+)/);
      return match ? match[1] : null;
    }
    return null;
  });
};

// ============================================================
// PETITS OUTILS UTILS
// ============================================================

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
