/**
 * Site-chrome strings (nav, palette, section labels). Page/resume content
 * lives next to its source as Localized<T> fields instead — see lib/resume.ts.
 * `es` is typed against `en`, so a missing key fails the build.
 */
import type { Locale } from "@/lib/i18n/locale";

const en = {
  nav: {
    home: "Home",
    projects: "Projects",
    resume: "Resume",
    search: "Search",
    searchButton: "search",
    login: "Log in",
    logout: "Log out",
    owner: "owner",
  },
  palette: {
    placeholder: "Type a command or search…",
    noResults: "No results found.",
    navigate: "Navigate",
    actions: "Actions",
    owner: "Owner",
    toggleTheme: "Toggle theme",
    copyEmail: "Copy email",
    openGithub: "Open GitHub",
    loginGoogle: "Log in with Google",
    logout: "Log out",
    newPost: "New post",
    soon: "soon",
  },
  home: {
    // composed as `${nn} / ${word}` in section-label headings
    projectWord: "projects",
    resumeWord: "resume",
    email: "Email",
    resume: "Resume",
    kbdBefore: "press",
    kbdAfter: "to look around",
    resumeAside: "Resume highlights",
  },
  resume: {
    downloadPdf: "Download PDF",
    education: "Education",
    languages: "Languages",
    skills: "Skills",
  },
};

export type UiStrings = typeof en;

const es: UiStrings = {
  nav: {
    home: "Inicio",
    projects: "Proyectos",
    resume: "Currículum",
    search: "Buscar",
    searchButton: "buscar",
    login: "Iniciar sesión",
    logout: "Cerrar sesión",
    owner: "dueño",
  },
  palette: {
    placeholder: "Escribe un comando o busca…",
    noResults: "Sin resultados.",
    navigate: "Navegar",
    actions: "Acciones",
    owner: "Dueño",
    toggleTheme: "Cambiar tema",
    copyEmail: "Copiar correo",
    openGithub: "Abrir GitHub",
    loginGoogle: "Iniciar sesión con Google",
    logout: "Cerrar sesión",
    newPost: "Nueva entrada",
    soon: "pronto",
  },
  home: {
    projectWord: "proyectos",
    resumeWord: "currículum",
    email: "Correo",
    resume: "Currículum",
    kbdBefore: "pulsa",
    kbdAfter: "para explorar",
    resumeAside: "Puntos destacados del currículum",
  },
  resume: {
    downloadPdf: "Descargar PDF",
    education: "Educación",
    languages: "Idiomas",
    skills: "Habilidades",
  },
};

export const ui: Record<Locale, UiStrings> = { en, es };
