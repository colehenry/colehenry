/**
 * Resume data, edited by hand for now.
 * TODO (later build): move this into the DB with an inline editor, per the
 * "Adding a tool" pattern in the README.
 *
 * Text fields are Localized<T> ({ en, es }) so the language toggle can swap
 * them and TypeScript refuses a bullet that's missing a translation. Dates
 * stay English-only - localizeDate() in lib/i18n/locale.tsx handles months
 * and "present" at render time.
 */
import type { Localized } from "@/lib/i18n/locale";

export type Bullet = {
  text: string;
  highlights?: string[];
};

export type Experience = {
  company: string;
  role: Localized<string>;
  start: string; // "Sep 2025"
  end: string; // "present"
  location?: Localized<string>;
  bullets: Array<Localized<Bullet>>;
  tech: string[];
};

export type Education = {
  school: string;
  degrees: Localized<string[]>;
  start: string;
  end: string;
  notes?: string;
};

export type SkillGroup = {
  label: Localized<string>;
  skills: string[];
};

export const resume = {
  name: "Cole Henry",
  tagline: {
    en: "AI software engineer building agents and data tools in production systems.",
    es: "Ingeniero de software de IA que construye agentes y herramientas de datos en sistemas de producción.",
  },
  email: "crhenry81@gmail.com",
  github: "https://github.com/colehenry",
  linkedin: "https://www.linkedin.com/in/cole-henry-9b699b178/",
  pdf: "/resume.pdf",

  experience: [
    {
      company: "Interscope Records (UMG)",
      role: {
        en: "AI Software Engineer",
        es: "Ingeniero de Software de IA",
      },
      start: "Sep 2025",
      end: "present",
      location: {
        en: "Santa Monica, CA",
        es: "Santa Mónica, California",
      },
      bullets: [
        {
          en: {
            text: "Shipped production LLM agents serving 150+ internal users daily, built on Python backend services (LangGraph / MCP) running on GCP with Vertex AI and GCS-backed pipelines processing large-scale streaming and social data.",
            highlights: [
              "LLM agents",
              "150+ internal users daily",
              "Python",
              "LangGraph / MCP",
            ],
          },
          es: {
            text: "Lancé agentes LLM en producción que atienden a más de 150 usuarios internos al día, construidos sobre servicios backend en Python (LangGraph / MCP) en GCP con Vertex AI y pipelines sobre GCS que procesan datos de streaming y redes sociales a gran escala.",
            highlights: [
              "agentes LLM",
              "más de 150 usuarios internos al día",
              "Python",
              "LangGraph / MCP",
            ],
          },
        },
        {
          en: {
            text: "Designed and built a RAG knowledge platform that lets LLM agents answer questions from internal docs, cutting manual analytics reporting 50%.",
            highlights: ["RAG knowledge platform", "LLM agents", "50%"],
          },
          es: {
            text: "Diseñé y construí una plataforma de conocimiento RAG que permite a agentes LLM responder preguntas a partir de documentación interna, reduciendo un 50% los informes analíticos manuales.",
            highlights: [
              "plataforma de conocimiento RAG",
              "agentes LLM",
              "50%",
            ],
          },
        },
        {
          en: {
            text: "Built an A&R research app that surfaces 100+ new artists weekly through automated pipelines, used by A&R to evaluate signings.",
            highlights: ["100+ new artists weekly"],
          },
          es: {
            text: "Construí una aplicación de investigación para A&R que descubre más de 100 artistas nuevos cada semana mediante pipelines automatizados, usada por A&R para evaluar fichajes.",
            highlights: ["más de 100 artistas nuevos cada semana"],
          },
        },
        {
          en: {
            text: "Built a React + TypeScript analytics platform replacing 30+ Tableau dashboards, with embedded AI agents for natural-language data analysis.",
            highlights: [
              "React + TypeScript",
              "30+ Tableau dashboards",
              "AI agents",
            ],
          },
          es: {
            text: "Construí una plataforma de analítica en React + TypeScript que reemplazó más de 30 dashboards de Tableau, con agentes de IA integrados para el análisis de datos en lenguaje natural.",
            highlights: [
              "React + TypeScript",
              "30 dashboards de Tableau",
              "agentes de IA",
            ],
          },
        },
      ],
      tech: [
        "Python",
        "LangGraph",
        "MCP",
        "Vertex AI",
        "GCP",
        "Airflow",
        "React",
        "TypeScript",
      ],
    },
    {
      company: "Interscope Records (UMG)",
      role: {
        en: "Analytics Engineer",
        es: "Ingeniero de Analítica",
      },
      start: "Sep 2024",
      end: "Aug 2025",
      location: {
        en: "Santa Monica, CA",
        es: "Santa Mónica, California",
      },
      bullets: [
        {
          en: {
            text: "Designed and maintained core data pipelines in Python and BigQuery powering automated executive and international reporting.",
            highlights: ["Python", "BigQuery"],
          },
          es: {
            text: "Diseñé y mantuve pipelines de datos clave en Python y BigQuery que alimentan informes ejecutivos e internacionales automatizados.",
            highlights: ["Python", "BigQuery"],
          },
        },
        {
          en: {
            text: "Built 15+ Tableau dashboards used by international stakeholders.",
            highlights: ["15+ Tableau dashboards"],
          },
          es: {
            text: "Construí más de 15 dashboards de Tableau usados por equipos internacionales.",
            highlights: ["15 dashboards de Tableau"],
          },
        },
      ],
      tech: ["Python", "BigQuery", "Tableau"],
    },
    {
      company: "HyperCard AI",
      role: {
        en: "Backend Developer",
        es: "Desarrollador Backend",
      },
      start: "Nov 2023",
      end: "Aug 2024",
      location: {
        en: "Cary, NC (Remote)",
        es: "Cary, Carolina del Norte (remoto)",
      },
      bullets: [
        {
          en: {
            text: "Built a natural language → SOQL service, enabling non-technical users to query Salesforce, reducing tickets by 30%.",
            highlights: ["natural language → SOQL", "30%"],
          },
          es: {
            text: "Construí un servicio de lenguaje natural → SOQL que permite a usuarios no técnicos consultar Salesforce, reduciendo los tickets un 30%.",
            highlights: ["lenguaje natural → SOQL", "30%"],
          },
        },
        {
          en: {
            text: "Built an error logging system processing 10K+ daily events with 99.9% accuracy, improving debugging efficiency.",
            highlights: ["10K+ daily events", "99.9% accuracy"],
          },
          es: {
            text: "Construí un sistema de registro de errores que procesa más de 10.000 eventos diarios con un 99,9% de precisión, mejorando la eficiencia de la depuración.",
            highlights: ["10.000 eventos diarios", "99,9% de precisión"],
          },
        },
      ],
      tech: ["Python", "Salesforce", "SOQL"],
    },
    {
      company: "IES Juan Gris Secondary School",
      role: {
        en: "Language & Culture Assistant",
        es: "Auxiliar de Conversación y Cultura",
      },
      start: "Oct 2023",
      end: "Jun 2024",
      location: {
        en: "Madrid, Spain",
        es: "Madrid, España",
      },
      bullets: [
        {
          en: {
            text: "Taught 16 sections across English, music, and technology, collaborating with Spanish-speaking teachers.",
            highlights: ["16 sections", "Spanish-speaking teachers"],
          },
          es: {
            text: "Impartí 16 grupos de inglés, música y tecnología, colaborando con profesores hispanohablantes.",
            highlights: ["16 grupos", "profesores hispanohablantes"],
          },
        },
      ],
      tech: [],
    },
  ] satisfies Experience[],

  education: [
    {
      school: "University of North Carolina at Chapel Hill",
      degrees: {
        en: [
          "B.A. Computer Science",
          "B.S. Statistics & Analytics",
          "Hispanic Studies Minor",
        ],
        es: [
          "B.A. en Ciencias de la Computación",
          "B.S. en Estadística y Analítica",
          "Minor en Estudios Hispánicos",
        ],
      },
      start: "2019",
      end: "2023",
    },
  ] satisfies Education[],

  languages: [
    {
      language: { en: "English", es: "Inglés" },
      level: { en: "Native", es: "Nativo" },
    },
    {
      language: { en: "Spanish", es: "Español" },
      level: { en: "C1", es: "C1" },
    },
  ],

  skills: [
    {
      label: { en: "Programming", es: "Programación" },
      skills: ["Python", "TypeScript", "SQL"],
    },
    {
      label: { en: "AI / LLM", es: "IA / LLM" },
      skills: [
        "LangGraph",
        "RAG",
        "LLM agents",
        "Embeddings",
        "Vertex AI",
        "MCP",
      ],
    },
    {
      label: { en: "Cloud & data", es: "Cloud y datos" },
      skills: ["GCP", "GCS", "BigQuery", "FastAPI"],
    },
  ] satisfies SkillGroup[],
};
