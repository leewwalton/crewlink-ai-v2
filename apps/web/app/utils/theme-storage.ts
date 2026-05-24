export const THEME_STORAGE_KEY = "crewlinkai-theme";

export type Theme = "light" | "dark";

export function readStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  try {
    const saved =
      localStorage.getItem(THEME_STORAGE_KEY) ??
      localStorage.getItem("crew-link-theme") ??
      localStorage.getItem("theme");
    return saved === "light" || saved === "dark" ? saved : null;
  } catch {
    return null;
  }
}

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

export function persistTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore storage failures in restricted browser contexts.
  }
}

export const themeInitScript = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}")||localStorage.getItem("crew-link-theme")||localStorage.getItem("theme");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t);}}catch(e){}})();`;
