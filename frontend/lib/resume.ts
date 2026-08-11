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
    en: "AI Software Engineer building production multi-agent LLM systems, data platforms, and internal products used by 180+ weekly users.",
    es: "Ingeniero de software (IA) centrado en sistemas LLM multiagente y plataformas de datos en producción, usados por más de 180 usuarios semanales.",
  },
  email: "crhenry81@gmail.com",
  github: "https://github.com/colehenry",
  linkedin: "https://www.linkedin.com/in/cole-henry-9b699b178/",
  // the Spanish CV is its own document, not a translation of the English PDF
  pdf: { en: "/resume.pdf", es: "/Curriculum2026.pdf" },

  experience: [
    {
      company: "Interscope Records (UMG)",
      role: {
        en: "AI Software Engineer",
        es: "Ingeniero de software (IA)",
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
            text: "Architected and built a multi-agent LLM system on Vertex AI and LangGraph serving 180+ weekly internal users; interviewed 20+ stakeholders to encode domain knowledge and design specialized agents for business and data queries",
            highlights: [
              "multi-agent LLM system",
              "180+ weekly internal users",
              "20+ stakeholders",
              "Vertex AI",
              "LangGraph",
            ],
          },
          es: {
            text: "Diseñé y desarrollé un sistema LLM multiagente con Vertex AI y LangGraph para 180+ usuarios internos semanales; definí agentes especializados a partir de entrevistas con 20+ stakeholders",
            highlights: [
              "sistema LLM multiagente",
              "180+ usuarios internos semanales",
              "20+ stakeholders",
              "Vertex AI",
              "LangGraph",
            ],
          },
        },
        {
          en: {
            text: "Built a React/TypeScript analytics platform with FastAPI backend that replaced 30+ Tableau dashboards and embedded AI agents directly on report pages, enabling natural language queries against live data",
            highlights: [
              "React/TypeScript analytics platform",
              "FastAPI backend",
              "30+ Tableau dashboards",
              "AI agents",
            ],
          },
          es: {
            text: "Desarrollé una plataforma de analítica en React/TypeScript y FastAPI que sustituyó 30+ dashboards de Tableau e incorporó agentes de IA para consultar datos en lenguaje natural",
            highlights: [
              "plataforma de analítica en React/TypeScript y FastAPI",
              "30+ dashboards de Tableau",
              "agentes de IA",
            ],
          },
        },
        {
          en: {
            text: "Built a TypeScript and Python A&R research application ingesting TikTok, streaming, and social data to surface thousands of emerging artists per week, with team workspace and artist outreach tools used for signing decisions",
            highlights: [
              "TypeScript and Python",
              "thousands of emerging artists per week",
              "artist outreach tools",
            ],
          },
          es: {
            text: "Desarrollé una app de scouting de A&R en TypeScript y Python que cruza datos de TikTok, streaming y redes sociales para detectar miles de artistas emergentes y apoyar decisiones de fichaje",
            highlights: [
              "TypeScript y Python",
              "miles de artistas emergentes",
              "decisiones de fichaje",
            ],
          },
        },
      ],
      tech: ["Vertex AI", "LangGraph", "React", "TypeScript", "FastAPI"],
    },
    {
      company: "Interscope Records (UMG)",
      role: {
        en: "Data Engineer",
        es: "Ingeniero de datos",
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
            text: "Built and maintained Python and BigQuery pipelines powering daily and weekly executive reporting across streaming and sales data",
            highlights: ["Python", "BigQuery"],
          },
          es: {
            text: "Desarrollé y mantuve pipelines en Python y BigQuery para reporting ejecutivo diario y semanal de streaming y ventas",
            highlights: ["Python", "BigQuery"],
          },
        },
        {
          en: {
            text: "Designed a reporting layer serving 15+ standardized views to international stakeholders, reducing ad-hoc requests by consolidating metrics into queryable data models",
            highlights: ["15+ standardized views"],
          },
          es: {
            text: "Creé una capa de reporting con 15+ vistas estandarizadas para equipos internacionales, centralizando métricas y reduciendo peticiones ad hoc",
            highlights: ["15+ vistas estandarizadas", "peticiones ad hoc"],
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
            text: "Built an LLM-powered natural language to Salesforce query service, letting non-technical users run database queries in plain English and reducing support tickets by 30%",
            highlights: ["LLM-powered", "30%"],
          },
          es: {
            text: "Desarrollé un servicio LLM que convierte lenguaje natural en consultas de Salesforce, reduciendo un 30 % los tickets de soporte",
            highlights: ["servicio LLM", "30 %", "tickets de soporte"],
          },
        },
        {
          en: {
            text: "Designed an error monitoring system processing 10K+ daily events, enabling rapid debugging across the platform",
            highlights: ["10K+ daily events", "rapid debugging"],
          },
          es: {
            text: "Creé un sistema de monitorización de errores para 10.000+ eventos diarios, agilizando la depuración de la plataforma",
            highlights: ["10.000+ eventos diarios", "depuración"],
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
        "Vertex AI",
        "MCP",
      ],
    },
    {
      label: { en: "Cloud & data", es: "Cloud y datos" },
      skills: [
        "GCP",
        "BigQuery",
        "React",
        "Next.js",
        "FastAPI",
        "PostgreSQL",
      ],
    },
  ] satisfies SkillGroup[],
};
