/**
 * src/automation/facebookPuppeteer.js
 * VERSION v6 — Fix ordre caption/image + React events + stabilisation modale
 */

import path from "path";
import fs from "fs-extra";
import { newPage } from "./browserManager.js";
import { config } from "../config/index.js";
import logger from "../utils/logger.js";

const FB_URL = "https://www.facebook.com";
const DEBUG_DIR = path.resolve("./logs/screenshots");
let isPublishing = false;

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// ============================================================
// HELPER — Trouver la vraie modale de post
// Facebook ouvre plusieurs dialogs simultanément (notifications,
// overlays). La modale de post contient toujours un <form method="POST">
// ============================================================
const getPostDialog = () => {
  const allDialogs = document.querySelectorAll('div[role="dialog"]');
  for (const dialog of allDialogs) {
    // La modale de post contient un form POST et a une taille réelle
    const hasForm = dialog.querySelector('form[method="POST"]');
    const rect = dialog.getBoundingClientRect();
    if (hasForm && rect.width > 100 && rect.height > 100) {
      return dialog;
    }
  }
  // Fallback : dialog avec contenteditable ou le plus grand
  let biggest = null;
  let maxArea = 0;
  for (const dialog of allDialogs) {
    const rect = dialog.getBoundingClientRect();
    const area = rect.width * rect.height;
    if (area > maxArea) {
      maxArea = area;
      biggest = dialog;
    }
  }
  return biggest;
};
// ============================================================
// ENTRY POINT
// ============================================================

export const publishViaPuppeteer = async (imagePath, caption) => {
  if (isPublishing)
    throw new Error("[FB] Concurrency lock: Publication en cours");

  isPublishing = true;
  let page = null;

  try {
    await fs.ensureDir(DEBUG_DIR);
    page = await newPage();

    const loggedIn = await checkLoginStatus(page);
    if (!loggedIn) {
      logger.info("[FB] Session expirée — reconnexion...");
      await loginToFacebook(page);
    } else {
      logger.info("[FB] ✅ Session active — login ignoré");
    }

    await navigateToPage(page);
    await openComposer(page);
    const postId = await createPost(page, imagePath, caption);

    logger.info("[FB] ✅ Publication réussie !", { postId });
    return { status: "success", facebookPostId: postId };
  } catch (error) {
    if (page) {
      const errorImg = path.join(DEBUG_DIR, `error-${Date.now()}.png`);
      await page.screenshot({ path: errorImg, fullPage: true }).catch(() => {});
      logger.error(`[FB] ❌ Échec. Screenshot: ${errorImg}`);
    }
    throw error;
  } finally {
    isPublishing = false;
    if (page) await page.close().catch(() => {});
  }
};

// ============================================================
// VÉRIFICATION SESSION
// ============================================================

const checkLoginStatus = async (page) => {
  try {
    await page.goto(FB_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
    await sleep(3000);
    const currentUrl = page.url();
    logger.info(`[FB] URL: ${currentUrl}`);

    if (currentUrl.includes("/login") || currentUrl.includes("login.php")) {
      return false;
    }

    return await page.evaluate(() => {
      const loginForm =
        document.querySelector('input[name="email"]') ||
        document.querySelector("#email");
      if (loginForm) return false;
      return !!(
        document.querySelector('[aria-label="Facebook"]') ||
        document.querySelector('[data-pagelet="LeftRail"]') ||
        document.querySelector('[role="navigation"]')
      );
    });
  } catch (err) {
    logger.warn("[FB] Erreur session", { message: err.message });
    return false;
  }
};

// ============================================================
// LOGIN
// ============================================================

const loginToFacebook = async (page) => {
  const { email, password } = config.facebook;
  if (!email || !password)
    throw new Error("[FB] Email/password manquants dans .env");

  await page.goto(`${FB_URL}/login`, {
    waitUntil: "networkidle2",
    timeout: 45000,
  });
  await sleep(2000);

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
      await page.type(sel, email, { delay: 40 });
      emailFilled = true;
      break;
    } catch {
      /* suivant */
    }
  }
  if (!emailFilled) throw new Error("[FB] Champ email introuvable");

  const passSelectors = [
    "#pass",
    'input[name="pass"]',
    'input[type="password"]',
  ];
  for (const sel of passSelectors) {
    try {
      await page.waitForSelector(sel, { visible: true, timeout: 5000 });
      await page.$eval(sel, (el) => (el.value = ""));
      await page.type(sel, password, { delay: 40 });
      break;
    } catch {
      /* suivant */
    }
  }

  await sleep(500);

  for (const sel of [
    'button[name="login"]',
    '[name="login"]',
    'button[type="submit"]',
  ]) {
    try {
      await page.click(sel);
      break;
    } catch {
      /* suivant */
    }
  }

  await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 45000 });
  const url = page.url();
  if (url.includes("/login") || url.includes("checkpoint")) {
    throw new Error(`[FB] Login échoué. URL: ${url}`);
  }
  logger.info("[FB] ✅ Login réussi");
  await sleep(3000);
};

// ============================================================
// NAVIGATION
// ============================================================

const navigateToPage = async (page) => {
  const pageUrl = `${FB_URL}/${config.facebook.pageName}`;
  logger.info(`[FB] Navigation: ${pageUrl}`);

  await page.goto(pageUrl, { waitUntil: "networkidle2", timeout: 45000 });
  await sleep(3000);
  await page
    .screenshot({ path: path.join(DEBUG_DIR, "01-page-loaded.png") })
    .catch(() => {});

  try {
    const switchBtn = await page.$(
      '[aria-label*="Switch"], [aria-label*="Basculer"]',
    );
    if (switchBtn) {
      await switchBtn.click();
      await page
        .waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 })
        .catch(() => {});
      await sleep(3000);
    }
  } catch {
    /* pas de switch */
  }
};

// ============================================================
// OUVRIR LE COMPOSITEUR
// ============================================================

const openComposer = async (page) => {
  logger.info("[FB] Ouverture compositeur...");
  await sleep(2000);

  for (const sel of [
    '[aria-label="Share a thought..."]',
    '[aria-label="Write something..."]',
    '[aria-label="Create a post"]',
    '[aria-label="Créer une publication"]',
    '[aria-label="Créer un post"]',
  ]) {
    try {
      const el = await page.waitForSelector(sel, {
        timeout: 3000,
        visible: true,
      });
      if (el) {
        await el.click();
        logger.info(`[FB] Compositeur: ${sel}`);
        await sleep(2000);
        return;
      }
    } catch {
      /* suivant */
    }
  }

  const found = await page.evaluate(() => {
    const allButtons = document.querySelectorAll('div[role="button"]');
    for (const btn of allButtons) {
      const text = (btn.innerText || btn.textContent || "").trim();
      const rect = btn.getBoundingClientRect();
      if (
        rect.top > 350 &&
        rect.left < 700 &&
        rect.width > 100 &&
        (text.includes("Share a thought") ||
          text.includes("Write something") ||
          text.includes("Qu'avez-vous") ||
          text.includes("What's on your mind"))
      ) {
        btn.click();
        return true;
      }
    }
    return false;
  });

  if (found) {
    logger.info("[FB] Compositeur ouvert via texte scopé");
    await sleep(2000);
    return;
  }

  throw new Error("[FB] Compositeur introuvable. Voir 01-page-loaded.png");
};
// ============================================================
// HELPER — Re-saisie caption après upload (modale enrichie)
// La modale image de FB n'a plus role="textbox", seulement
// un contenteditable brut au-dessus de l'image uploadée
// ============================================================

// ============================================================
// HELPER — waitForStableTextbox v8
// Cherche contenteditable MÊME si offsetParent est null
// On vérifie juste que l'élément existe dans la modale active
// ============================================================
const waitForStableTextbox = async (page, timeoutMs = 12000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const found = await page.evaluate(() => {
      const allDialogs = document.querySelectorAll('div[role="dialog"]');
      for (const dialog of allDialogs) {
        const hasForm = dialog.querySelector('form[method="POST"]');
        const rect = dialog.getBoundingClientRect();
        if (hasForm && rect.width > 100 && rect.height > 100) {
          const ce = dialog.querySelectorAll('div[contenteditable="true"]');
          return ce.length > 0;
        }
      }
      return false;
    });
    if (found) return true;
    await sleep(500);
  }
  throw new Error("[FB] Textbox stable introuvable après timeout");
};

const typeInContentEditable = async (page, text) => {
  const clicked = await page.evaluate(() => {
    const allDialogs = document.querySelectorAll('div[role="dialog"]');
    let dialog = null;
    for (const d of allDialogs) {
      const hasForm = d.querySelector('form[method="POST"]');
      const rect = d.getBoundingClientRect();
      if (hasForm && rect.width > 100 && rect.height > 100) {
        dialog = d;
        break;
      }
    }
    if (!dialog) return false;

    const box =
      dialog.querySelector('[role="textbox"]') ||
      dialog.querySelector('div[contenteditable="true"]');
    if (!box) return false;

    box.click();
    box.focus();
    const range = document.createRange();
    range.selectNodeContents(box);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    return true;
  });

  if (clicked) {
    await page.keyboard.press("Delete");
    await sleep(200);
    await page.keyboard.type(text, { delay: 15 });
  }
};

const injectFileToInput = async (page, absPath) => {
  const imageBuffer = await fs.readFile(absPath);
  const base64Image = imageBuffer.toString("base64");
  const ext = path.extname(absPath).toLowerCase();
  const mimeMap = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
  };
  const mimeType = mimeMap[ext] || "image/jpeg";

  const injected = await page.evaluate(
    ({ base64, mime, filename }) => {
      const inputs = Array.from(
        document.querySelectorAll('input[type="file"]'),
      );
      if (inputs.length === 0) return false;

      const byteChars = atob(base64);
      const byteArray = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteArray[i] = byteChars.charCodeAt(i);
      }
      const blob = new Blob([byteArray], { type: mime });
      const file = new File([blob], filename, {
        type: mime,
        lastModified: Date.now(),
      });

      const dt = new DataTransfer();
      dt.items.add(file);

      for (const input of inputs) {
        try {
          input.style.display = "block";
          Object.defineProperty(input, "files", {
            value: dt.files,
            writable: false,
          });
          input.dispatchEvent(new Event("change", { bubbles: true }));
          input.dispatchEvent(new InputEvent("input", { bubbles: true }));
          // React synthetic event
          const reactKey = Object.keys(input).find(
            (k) => k.startsWith("__reactProps") || k.startsWith("__reactFiber"),
          );
          if (reactKey && input[reactKey]?.onChange) {
            input[reactKey].onChange({
              target: input,
              nativeEvent: new Event("change"),
            });
          }
        } catch {
          // continuer sur le suivant
        }
      }
      return true;
    },
    { base64: base64Image, mime: mimeType, filename: path.basename(absPath) },
  );

  return injected;
};

const createPost = async (page, imagePath, caption) => {
  logger.info("[FB] Création post v10...");

  const absPath = path.resolve(imagePath);
  if (!(await fs.pathExists(absPath)))
    throw new Error(`[FB] Image introuvable: ${absPath}`);

  // Attendre la modale de post (form POST visible)
  await page.waitForFunction(
    () => {
      const allDialogs = document.querySelectorAll('div[role="dialog"]');
      for (const d of allDialogs) {
        const hasForm = d.querySelector('form[method="POST"]');
        const rect = d.getBoundingClientRect();
        if (hasForm && rect.width > 100 && rect.height > 100) return true;
      }
      return false;
    },
    { timeout: 15000, polling: 300 },
  );
  logger.info("[FB] ✅ Modale post détectée (form POST)");
  await sleep(1500);

  await page
    .screenshot({ path: path.join(DEBUG_DIR, "02-modal-open.png") })
    .catch(() => {});

  // ============================================================
  // ÉTAPE 1 — Upload image
  // ============================================================
  logger.info("[FB] Upload image...");
  const uploaded = await injectFileToInput(page, absPath);

  if (!uploaded) {
    logger.warn("[FB] DataTransfer échouée, fallback...");
    await page.evaluate(() => {
      document.querySelectorAll('input[type="file"]').forEach((i) => {
        i.style.cssText =
          "display:block!important;opacity:1!important;position:fixed!important;" +
          "top:0;left:0;z-index:99999;width:200px;height:200px";
      });
    });
    const fileInput = await page
      .waitForSelector('input[type="file"]', { timeout: 8000, visible: false })
      .catch(() => null);
    if (fileInput) {
      await fileInput.uploadFile(absPath);
    } else {
      throw new Error("[FB] Impossible d'uploader l'image");
    }
  }
  logger.info("[FB] ✅ Image uploadée");

  // ============================================================
  // ÉTAPE 2 — Attendre preview dans la bonne modale
  // ============================================================
  await page
    .waitForFunction(
      () => {
        const allDialogs = document.querySelectorAll('div[role="dialog"]');
        for (const d of allDialogs) {
          const hasForm = d.querySelector('form[method="POST"]');
          const rect = d.getBoundingClientRect();
          if (!hasForm || rect.width < 100) continue;
          for (const img of d.querySelectorAll("img")) {
            if (
              img.src.startsWith("blob:") ||
              img.src.includes("fbcdn") ||
              img.src.startsWith("data:image/png") ||
              img.src.startsWith("data:image/jpeg")
            )
              return true;
          }
        }
        return false;
      },
      { timeout: 30000, polling: 500 },
    )
    .catch(() => logger.warn("[FB] Preview non détectée, on continue..."));

  await sleep(1500);
  await page
    .screenshot({ path: path.join(DEBUG_DIR, "03-image-uploaded.png") })
    .catch(() => {});

  // ============================================================
  // ÉTAPE 3 — Caption via click Puppeteer natif
  // ============================================================
  logger.info("[FB] Saisie caption...");

  const textBox = await page
    .waitForSelector(
      'form[method="POST"] [role="textbox"], form[method="POST"] div[contenteditable="true"]',
      { visible: true, timeout: 8000 },
    )
    .catch(() => null);

  if (textBox) {
    await textBox.click(); // ← click Puppeteer natif, pas evaluate
    await sleep(400);
    await page.keyboard.down("Control");
    await page.keyboard.press("a");
    await page.keyboard.up("Control");
    await page.keyboard.press("Delete");
    await sleep(200);
    await page.keyboard.type(caption, { delay: 20 });
    logger.info("[FB] ✅ Caption saisi");
    await sleep(800);
  } else {
    logger.warn("[FB] Zone texte introuvable dans modale post");
  }

  await page
    .screenshot({ path: path.join(DEBUG_DIR, "04-caption-typed.png") })
    .catch(() => {});

  // ============================================================
  // ÉTAPE 4 — Bouton "Next" dans la bonne modale
  // ============================================================
  logger.info("[FB] Recherche Next...");

  const nextClicked = await page.evaluate(() => {
    const allDialogs = document.querySelectorAll('div[role="dialog"]');
    let dialog = null;
    for (const d of allDialogs) {
      const hasForm = d.querySelector('form[method="POST"]');
      const rect = d.getBoundingClientRect();
      if (hasForm && rect.width > 100 && rect.height > 100) {
        dialog = d;
        break;
      }
    }
    if (!dialog) return false;

    const allSpans = dialog.querySelectorAll("span");
    for (const span of allSpans) {
      const text = (span.innerText || span.textContent || "").trim();
      if (text === "Next" || text === "Suivant") {
        let target = span;
        for (let i = 0; i < 8; i++) {
          target = target.parentElement;
          if (!target) break;
          const role = target.getAttribute("role");
          const tabindex = target.getAttribute("tabindex");
          const tag = target.tagName.toLowerCase();
          if (role === "button" || tag === "button" || tabindex === "0") {
            target.dispatchEvent(
              new MouseEvent("click", { bubbles: true, cancelable: true }),
            );
            return `${tag}[role=${role}][tabindex=${tabindex}]`;
          }
        }
        span.dispatchEvent(
          new MouseEvent("click", { bubbles: true, cancelable: true }),
        );
        return "span-direct";
      }
    }
    return false;
  });

  // Après nextClicked, remplace sleep(3000) par :
  if (nextClicked) {
    logger.info(`[FB] ✅ Next cliqué (${nextClicked})`);

    // Attendre que le bouton Next disparaisse = modale 2 chargée
    await page
      .waitForFunction(
        () => {
          const allDialogs = document.querySelectorAll('div[role="dialog"]');
          for (const d of allDialogs) {
            const hasForm = d.querySelector('form[method="POST"]');
            const rect = d.getBoundingClientRect();
            if (!hasForm || rect.width < 100) continue;
            const spans = d.querySelectorAll("span");
            for (const s of spans) {
              if (
                (s.innerText || "").trim() === "Next" ||
                (s.innerText || "").trim() === "Suivant"
              )
                return false;
            }
            return true; // Next a disparu
          }
          return false;
        },
        { timeout: 10000, polling: 300 },
      )
      .catch(() => logger.warn("[FB] Next pas encore disparu"));

    await sleep(1000);
    await page
      .screenshot({ path: path.join(DEBUG_DIR, "05-post-settings.png") })
      .catch(() => {});
  }

  // ============================================================
  // ÉTAPE 5 — Bouton "Post" dans la bonne modale
  // ============================================================
  logger.info("[FB] Recherche bouton Post...");

  await page
    .waitForFunction(
      () => {
        const allDialogs = document.querySelectorAll('div[role="dialog"]');
        let dialog = null;
        for (const d of allDialogs) {
          const hasForm = d.querySelector('form[method="POST"]');
          const rect = d.getBoundingClientRect();
          if (hasForm && rect.width > 100 && rect.height > 100) {
            dialog = d;
            break;
          }
        }
        if (!dialog) return false;
        const keywords = ["post", "publier", "share", "partager"];
        for (const btn of dialog.querySelectorAll('[role="button"], button')) {
          const text = (btn.innerText || btn.textContent || "")
            .trim()
            .toLowerCase();
          const disabled =
            btn.getAttribute("aria-disabled") === "true" || btn.disabled;
          if (keywords.includes(text) && !disabled) return true;
        }
        return false;
      },
      { timeout: 15000, polling: 500 },
    )
    .catch(() => logger.warn("[FB] Bouton Post pas encore actif..."));

  const publishSelectors = [
    'form[method="POST"] button[aria-label="Post"]',
    'form[method="POST"] button[aria-label="Publier"]',
    'form[method="POST"] div[aria-label="Post"]',
    'form[method="POST"] div[aria-label="Publier"]',
    'form[method="POST"] div[aria-label="Share"]',
    'form[method="POST"] div[aria-label="Partager"]',
  ];

  let published = false;

  for (const sel of publishSelectors) {
    try {
      const btn = await page.waitForSelector(sel, {
        timeout: 3000,
        visible: true,
      });
      if (btn) {
        await btn.click();
        published = true;
        logger.info(`[FB] ✅ Post cliqué: ${sel}`);
        break;
      }
    } catch {
      /* suivant */
    }
  }

  // Fallback texte dans form POST
  if (!published) {
    published = await page.evaluate(() => {
      const allDialogs = document.querySelectorAll('div[role="dialog"]');
      let dialog = null;
      for (const d of allDialogs) {
        const hasForm = d.querySelector('form[method="POST"]');
        const rect = d.getBoundingClientRect();
        if (hasForm && rect.width > 100 && rect.height > 100) {
          dialog = d;
          break;
        }
      }
      if (!dialog) return false;
      const keywords = ["post", "publier", "share", "partager"];
      for (const btn of dialog.querySelectorAll('[role="button"], button')) {
        const text = (btn.innerText || btn.textContent || "")
          .trim()
          .toLowerCase();
        const disabled =
          btn.getAttribute("aria-disabled") === "true" || btn.disabled;
        if (keywords.includes(text) && !disabled) {
          btn.dispatchEvent(
            new MouseEvent("click", { bubbles: true, cancelable: true }),
          );
          return true;
        }
      }
      return false;
    });
    if (published) logger.info("[FB] ✅ Post cliqué via fallback texte");
  }

  if (!published)
    throw new Error("[FB] Bouton Post introuvable. Voir 05-post-settings.png");

  await page
    .waitForSelector('div[role="dialog"]', { hidden: true, timeout: 30000 })
    .catch(() => logger.warn("[FB] Modale non fermée"));

  await page
    .screenshot({ path: path.join(DEBUG_DIR, "06-after-publish.png") })
    .catch(() => {});
  logger.info("[FB] ✅ Post publié !");
  return "SUCCESS";
};
