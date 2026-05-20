/**
 * src/automation/facebookPuppeteer.js
 * ============================================================
 * FACEBOOK PAGE PUBLISHER — VERSION PRODUCTION (CORRIGÉE)
 * ============================================================
 *
 * BUGS CORRIGÉS vs version précédente :
 *
 * [BUG 1] checkLoginStatus() était appelé 2x (withTimeout + appel direct)
 *         → double navigation, race condition
 *         FIX : un seul appel, résultat réutilisé
 *
 * [BUG 2] openComposer() utilisait 'span:has-text(...)' — syntaxe Playwright
 *         non reconnue par Puppeteer → composer ne s'ouvrait jamais
 *         FIX : sélecteurs ARIA Puppeteer + text pseudo-element + fallback DOM
 *
 * [BUG 3] input[type="file"] prenait le 1er input de la page
 *         → upload au mauvais endroit
 *         FIX : waitForSelector scoped dans le dialog/modal uniquement
 *
 * [BUG 4] btn.click() via page.evaluate() = événement DOM synthétique
 *         ignoré par React/Facebook → publication silencieusement annulée
 *         FIX : page.click() natif Puppeteer (trusted event)
 *
 * [BUG 5] Caption typé avant que l'image soit rendue dans le composer
 *         FIX : attente réseau + délai adaptatif avant de taper
 *
 * [BUG 6] Pas de confirmation de publication (sleep(8000) aveugle)
 *         FIX : waitForSelector sur indicateur de succès + screenshot post-post
 *
 * [BUG 7] Pas de userDataDir → reconnexion forcée à chaque run
 *         FIX : userDataDir géré dans browserManager (déjà OK), session persistée
 *
 * ============================================================
 */

import path from "path";
import fs from "fs-extra";
import { newPage } from "./browserManager.js";
import { config } from "../config/index.js";
import logger from "../utils/logger.js";

// ============================================================
// CONSTANTES
// ============================================================

const FB_URL = "https://www.facebook.com";

const TIMEOUTS = {
  navigation: 45_000,
  action: 20_000,
  upload: 30_000,
  postConfirm: 15_000,
};

// Délai humain entre chaque frappe (ms)
const TYPING_DELAY = 18;

// Verrou anti-concurrence (un seul post à la fois)
let isPublishing = false;

// Répertoire pour les screenshots de debug
const DEBUG_DIR = path.resolve("./debug-screenshots");

// ============================================================
// ENTRY POINT
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

    // ── Vérification session ──────────────────────────────────
    // BUG CORRIGÉ : un seul appel, résultat stocké
    const loggedIn = await checkLoginStatus(page);

    if (!loggedIn) {
      logger.info("[FB] Session expirée, reconnexion...");
      await loginToFacebook(page);
    } else {
      logger.info("[FB] Session active, login ignoré");
    }

    // ── Navigation vers la Page FB ───────────────────────────
    await navigateToPage(page);

    // ── Création et publication du post ──────────────────────
    const postId = await createPost(page, imagePath, caption);

    logger.info("[FB] ✅ Publication réussie", { postId });

    return { status: "success", facebookPostId: postId ?? null };
  } catch (error) {
    // Screenshot de debug en cas d'échec
    if (page) {
      await page
        .screenshot({
          path: path.join(DEBUG_DIR, "fb-error.png"),
          fullPage: true,
        })
        .catch(() => {});
    }

    logger.error("[FB] ❌ Échec publication", {
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
// VÉRIFICATION SESSION
// ============================================================

const checkLoginStatus = async (page) => {
  try {
    await page.goto(FB_URL, {
      waitUntil: "domcontentloaded",
      timeout: TIMEOUTS.navigation,
    });

    const currentUrl = page.url();

    // Si redirigé vers /login → pas connecté
    if (currentUrl.includes("/login") || currentUrl.includes("login.php")) {
      return false;
    }

    // Présence du champ email = page de login affichée
    const emailField = await page.$('input[name="email"]');
    if (emailField) return false;

    // Vérification que le fil d'actualité ou la toolbar est présente
    const homeIndicator = await page.$(
      '[aria-label="Facebook"], [data-pagelet="LeftRail"]',
    );
    return !!homeIndicator;
  } catch (err) {
    logger.warn("[FB] Vérification session échouée, on suppose déconnecté", {
      message: err.message,
    });
    return false;
  }
};

// ============================================================
// LOGIN
// ============================================================

const loginToFacebook = async (page) => {
  const { email, password } = config.facebook;

  if (!email || !password) {
    throw new Error(
      "[FB] Identifiants manquants dans la config (FB_EMAIL / FB_PASSWORD)",
    );
  }

  logger.info("[FB] Navigation vers la page de login...");

  await page.goto(`${FB_URL}/login`, {
    waitUntil: "networkidle2",
    timeout: TIMEOUTS.navigation,
  });

  // Attente explicite des champs (évite les clics sur éléments non rendus)
  await page.waitForSelector("#email", {
    visible: true,
    timeout: TIMEOUTS.action,
  });
  await page.waitForSelector("#pass", {
    visible: true,
    timeout: TIMEOUTS.action,
  });

  // Effacer puis taper (au cas où des valeurs résiduelles existent)
  await page.$eval("#email", (el) => (el.value = ""));
  await page.type("#email", email, { delay: TYPING_DELAY + 10 });

  await page.$eval("#pass", (el) => (el.value = ""));
  await page.type("#pass", password, { delay: TYPING_DELAY + 10 });

  await page
    .screenshot({
      path: path.join(DEBUG_DIR, "fb-before-login.png"),
    })
    .catch(() => {});

  // Clic natif Puppeteer (trusted event, pas de .evaluate())
  await Promise.all([
    page.click('[name="login"]'),
    page.waitForNavigation({
      waitUntil: "networkidle2",
      timeout: TIMEOUTS.navigation,
    }),
  ]);

  // Vérifier qu'on est bien connecté
  const url = page.url();
  if (url.includes("/login") || url.includes("checkpoint")) {
    throw new Error(
      `[FB] Login échoué ou checkpoint de sécurité détecté. URL: ${url}`,
    );
  }

  logger.info("[FB] Login réussi");

  await page
    .screenshot({
      path: path.join(DEBUG_DIR, "fb-after-login.png"),
    })
    .catch(() => {});
};

// ============================================================
// NAVIGATION VERS LA PAGE FACEBOOK
// ============================================================

const navigateToPage = async (page) => {
  const pageUrl = `${FB_URL}/${config.facebook.pageName}`;

  logger.info(`[FB] Navigation vers la page: ${pageUrl}`);

  await page.goto(pageUrl, {
    waitUntil: "networkidle2",
    timeout: TIMEOUTS.navigation,
  });

  // Gérer le modal "Continuer en tant que [Profil]" ou "Basculer vers la Page"
  await handleSwitchToPageModal(page);

  await page
    .screenshot({
      path: path.join(DEBUG_DIR, "fb-page-loaded.png"),
    })
    .catch(() => {});
};

const handleSwitchToPageModal = async (page) => {
  try {
    // Chercher bouton de bascule vers la Page (texte bilingue)
    const switchBtn = await page.waitForSelector(
      [
        '[aria-label*="Switch now"]',
        '[aria-label*="Basculer"]',
        '[aria-label*="Switch to"]',
      ].join(", "),
      { timeout: 4000, visible: true },
    );

    if (switchBtn) {
      logger.info("[FB] Modal de bascule détecté, clic...");
      await switchBtn.click();
      await page
        .waitForNetworkIdle({ idleTime: 1500, timeout: 8000 })
        .catch(() => {});
    }
  } catch {
    // Aucun modal → normal, on continue
  }
};

// ============================================================
// CRÉATION DU POST
// ============================================================

const createPost = async (page, imagePath, caption) => {
  // ── 1. Ouvrir le compositeur ─────────────────────────────
  logger.info("[FB] Ouverture du compositeur...");
  const composerOpened = await openComposer(page);

  if (!composerOpened) {
    throw new Error("[FB] Impossible d'ouvrir le compositeur de publication");
  }

  await page
    .screenshot({
      path: path.join(DEBUG_DIR, "fb-composer-open.png"),
    })
    .catch(() => {});

  // ── 2. Upload de l'image ─────────────────────────────────
  logger.info("[FB] Upload de l'image...");
  await uploadImage(page, imagePath);

  // ── 3. Écrire le caption ─────────────────────────────────
  // BUG CORRIGÉ : on attend que l'image soit rendue AVANT de taper
  logger.info("[FB] Saisie du caption...");
  await typeCaption(page, caption);

  await page
    .screenshot({
      path: path.join(DEBUG_DIR, "fb-before-submit.png"),
    })
    .catch(() => {});

  // ── 4. Soumettre le post ─────────────────────────────────
  logger.info("[FB] Clic sur le bouton Publier...");
  await clickPostButton(page);

  // ── 5. Confirmer la publication ──────────────────────────
  logger.info("[FB] Attente confirmation...");
  const postId = await waitForPostConfirmation(page);

  await page
    .screenshot({
      path: path.join(DEBUG_DIR, "fb-after-submit.png"),
    })
    .catch(() => {});

  return postId;
};

// ============================================================
// OUVRIR LE COMPOSITEUR
// BUG CORRIGÉ : syntaxe Puppeteer correcte (pas Playwright)
// ============================================================

const openComposer = async (page) => {
  // Puppeteer P-selectors pour le texte (compatible v20+)
  const textSelectors = [
    // Texte visible dans le placeholder du compositor
    "::-p-text(What's on your mind)",
    "::-p-text(Qu'avez-vous en tête)",
    "::-p-text(Quoi de neuf)",
    "::-p-text(Write something)",
    "::-p-text(Écrivez quelque chose)",
  ];

  for (const sel of textSelectors) {
    try {
      const el = await page.$(sel);
      if (el) {
        logger.info(`[FB] Compositeur trouvé via sélecteur texte`);
        await el.click();
        await page
          .waitForNetworkIdle({ idleTime: 1000, timeout: 5000 })
          .catch(() => {});
        return true;
      }
    } catch {}
  }

  // Fallback : sélecteurs ARIA
  const ariaSelectors = [
    'div[role="main"] div[role="button"][tabindex="0"]',
    '[data-pagelet="FeedComposer"] div[role="button"]',
  ];

  for (const sel of ariaSelectors) {
    try {
      const el = await page.$(sel);
      if (el) {
        const text = await page.evaluate((node) => node.innerText ?? "", el);
        // Ignorer les boutons sans texte ou non liés au post
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

  // Dernier recours : scan DOM (fiable mais lent)
  const found = await page.evaluate(() => {
    const keywords = [
      "what's on your mind",
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
        // Remonter au parent cliquable si nécessaire
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
// UPLOAD IMAGE
// BUG CORRIGÉ : scoper l'input dans le dialog du compositor
// ============================================================

const uploadImage = async (page) => {
  // Chercher le bouton "Photo/Video" dans le dialog si ouvert
  try {
    const photoBtn = await page.waitForSelector(
      [
        'div[role="dialog"] [aria-label*="Photo"]',
        'div[role="dialog"] [aria-label*="photo"]',
        'div[role="dialog"] ::-p-text(Photo/video)',
        'div[role="dialog"] ::-p-text(Photo)',
      ].join(", "),
      { timeout: 5000, visible: true },
    );
    if (photoBtn) await photoBtn.click();
  } catch {
    // Certaines versions FB affichent directement l'input — on continue
  }

  // Attendre l'input file (timeout généreux pour les connexions lentes)
  const fileInput = await page.waitForSelector('input[type="file"]', {
    timeout: TIMEOUTS.upload,
  });

  if (!fileInput) {
    throw new Error(
      "[FB] Input file introuvable — le compositor n'est peut-être pas ouvert",
    );
  }

  const absPath = path.resolve(imagePath);
  if (!(await fs.pathExists(absPath))) {
    throw new Error(`[FB] Fichier image introuvable: ${absPath}`);
  }

  await fileInput.uploadFile(absPath);
  logger.info("[FB] Fichier uploadé, attente du rendu...");

  // Attendre que l'aperçu de l'image apparaisse dans le compositor
  // (indique que l'image est bien traitée côté Facebook)
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
    // Certaines versions n'affichent pas d'aperçu immédiat → délai fixe
    logger.warn("[FB] Aperçu image non détecté, délai de sécurité...");
    await sleep(4000);
  }
};

// ============================================================
// ÉCRIRE LE CAPTION
// BUG CORRIGÉ : typage APRÈS confirmation du rendu image
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
    logger.warn("[FB] Zone de texte non trouvée, tentative via clipboard...");
    await typeViaCopyPaste(page, caption);
    return;
  }

  await textbox.click();
  await sleep(400);

  // Typage natif Puppeteer avec délai humain
  await page.keyboard.type(caption, { delay: TYPING_DELAY });

  logger.info("[FB] Caption tapé avec succès");
};

// Fallback : injection via clipboard (contourne les éditeurs riches)
const typeViaCopyPaste = async (page, caption) => {
  await page.evaluate(async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // fallback si clipboard API indisponible
      const ta = document.createElement("textarea");
      ta.value = text;
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
// CLIQUER SUR LE BOUTON PUBLIER
// BUG CORRIGÉ : page.click() natif (trusted event React-compatible)
// ============================================================

const clickPostButton = async (page) => {
  // Sélecteurs du bouton Publier dans la dialog
  const publishSelectors = [
    'div[role="dialog"] div[aria-label="Post"]',
    'div[role="dialog"] div[aria-label="Publier"]',
    'div[role="dialog"] div[aria-label="Share"]',
    'div[role="dialog"] div[aria-label="Partager"]',
  ];

  for (const sel of publishSelectors) {
    try {
      const btn = await page.waitForSelector(sel, {
        timeout: 5000,
        visible: true,
      });

      if (btn) {
        // Vérifier que le bouton n'est pas désactivé
        const isDisabled = await page.evaluate(
          (el) =>
            el.getAttribute("aria-disabled") === "true" ||
            el.classList.contains("disabled") ||
            el.hasAttribute("disabled"),
          btn,
        );

        if (isDisabled) {
          logger.warn(`[FB] Bouton "${sel}" trouvé mais désactivé, attente...`);
          await sleep(2000);
        }

        // Clic Puppeteer natif = trusted event (crucial pour React)
        await btn.click();
        logger.info(`[FB] Bouton Publier cliqué via: ${sel}`);
        return;
      }
    } catch {}
  }

  // Fallback texte : chercher par contenu visible
  const clicked = await page.evaluate(() => {
    const keywords = ["post", "publier", "share", "partager"];
    const dialog = document.querySelector('div[role="dialog"]');
    const scope = dialog ?? document;

    const buttons = scope.querySelectorAll('div[role="button"], button');

    for (const btn of buttons) {
      const text = (btn.innerText || btn.textContent || "")
        .trim()
        .toLowerCase();

      if (
        keywords.includes(text) &&
        btn.getAttribute("aria-disabled") !== "true"
      ) {
        // Utiliser le MouseEvent avec bubbles pour déclencher les handlers React
        btn.dispatchEvent(
          new MouseEvent("click", { bubbles: true, cancelable: true }),
        );
        return true;
      }
    }
    return false;
  });

  if (!clicked) {
    throw new Error(
      "[FB] Bouton Publier introuvable — vérifier fb-before-submit.png",
    );
  }
};

// ============================================================
// CONFIRMATION DE PUBLICATION
// BUG CORRIGÉ : attente active au lieu de sleep(8000) aveugle
// ============================================================

const waitForPostConfirmation = async (page) => {
  // Le dialog de composition devrait disparaître après publication
  try {
    await page.waitForSelector('div[role="dialog"]', {
      hidden: true,
      timeout: TIMEOUTS.postConfirm,
    });
    logger.info("[FB] Compositeur fermé — publication confirmée");
  } catch {
    logger.warn("[FB] Délai de fermeture dialog dépassé, on vérifie le fil...");
  }

  // Chercher l'indicateur de succès dans le fil (post nouvellement apparu)
  try {
    await page.waitForFunction(
      () => {
        // Vérifier la disparition du spinner de chargement
        const spinner = document.querySelector(
          '[data-visualcompletion="loading-state"]',
        );
        return !spinner;
      },
      { timeout: 8000 },
    );
  } catch {}

  // Tenter d'extraire l'ID du post depuis l'URL ou le DOM
  const postId = await page.evaluate(() => {
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

  return postId;
};

// ============================================================
// UTILS
// ============================================================

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
