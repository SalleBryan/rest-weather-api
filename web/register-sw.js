"use strict";
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {
      const note = document.getElementById("storageNote");
      if (note)
        note.textContent =
          "Offline app caching is unavailable. Saved forecasts still work while this page is open.";
    });
  });
}
