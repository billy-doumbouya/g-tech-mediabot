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