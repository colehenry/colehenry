/**
 * Resume data, edited by hand for now.
 * TODO (later build): move this into the DB with an inline editor, per the
 * "Adding a tool" pattern in the README.
 */

export type Experience = {
  company: string;
  role: string;
  start: string; // "Sep 2025"
  end: string; // "present"
  location?: string;
  bullets: Array<string | { text: string; highlights: string[] }>;
  tech: string[];
};

export type Education = {
  school: string;
  degrees: string[];
  start: string;
  end: string;
  notes?: string;
};

export type SkillGroup = {
  label: string;
  skills: string[];
};

export const resume = {
  name: "Cole Henry",
  tagline:
    "Software engineer building agents and data tools in production systems.",
  email: "crhenry81@gmail.com",
  github: "https://github.com/colehenry",
  linkedin: "https://www.linkedin.com/in/cole-henry-9b699b178/",
  pdf: "/resume.pdf",

  experience: [
    {
      company: "Interscope Records (UMG)",
      role: "AI Software Engineer",
      start: "Sep 2025",
      end: "present",
      location: "Santa Monica, CA",
      bullets: [
        {
          text: "Shipped production LLM agents serving 150+ internal users daily, built on Python backend services (LangGraph / MCP) running on GCP with Vertex AI and GCS-backed pipelines processing large-scale streaming and social data.",
          highlights: [
            "LLM agents",
            "150+ internal users daily",
            "Python",
            "LangGraph / MCP",
          ],
        },
        {
          text: "Designed and built a RAG knowledge platform that lets LLM agents answer questions from internal docs, cutting manual analytics reporting 50%.",
          highlights: ["RAG knowledge platform", "LLM agents", "50%"],
        },
        {
          text: "Built an A&R research app that surfaces 100+ new artists weekly through automated pipelines, used by A&R to evaluate signings.",
          highlights: ["100+ new artists weekly"],
        },
        {
          text: "Built a React + TypeScript analytics platform replacing 30+ Tableau dashboards, with embedded AI agents for natural-language data analysis.",
          highlights: [
            "React + TypeScript",
            "30+ Tableau dashboards",
            "AI agents",
          ],
        },
      ],
      tech: [
        "Python",
        "LangGraph",
        "MCP",
        "Vertex AI",
        "GCP",
        "React",
        "TypeScript",
      ],
    },
    {
      company: "Interscope Records (UMG)",
      role: "Analytics Engineer",
      start: "Sep 2024",
      end: "Aug 2025",
      location: "Santa Monica, CA",
      bullets: [
        {
          text: "Designed and maintained core data pipelines in Python and BigQuery powering automated executive and international reporting.",
          highlights: ["Python", "BigQuery"],
        },
        {
          text: "Built 15+ Tableau dashboards used by international stakeholders.",
          highlights: ["15+ Tableau dashboards"],
        },
      ],
      tech: ["Python", "BigQuery", "Tableau"],
    },
    {
      company: "HyperCard AI",
      role: "Backend Developer",
      start: "Nov 2023",
      end: "Aug 2024",
      location: "Cary, NC (Remote)",
      bullets: [
        {
          text: "Built a natural language → SOQL service, enabling non-technical users to query Salesforce, reducing tickets by 30%.",
          highlights: ["natural language → SOQL", "30%"],
        },
        {
          text: "Built an error logging system processing 10K+ daily events with 99.9% accuracy, improving debugging efficiency.",
          highlights: ["10K+ daily events", "99.9% accuracy"],
        },
      ],
      tech: ["Python", "Salesforce", "SOQL"],
    },
    {
      company: "IES Juan Gris Secondary School",
      role: "Language & Culture Assistant",
      start: "Oct 2023",
      end: "Jun 2024",
      location: "Madrid, Spain",
      bullets: [
        {
          text: "Taught 16 sections across English, music, and technology, collaborating with Spanish-speaking teachers.",
          highlights: ["16 sections", "Spanish-speaking teachers"],
        },
      ],
      tech: [],
    },
  ] satisfies Experience[],

  education: [
    {
      school: "University of North Carolina at Chapel Hill",
      degrees: [
        "B.A. Computer Science",
        "B.S. Statistics & Analytics",
        "Hispanic Studies Minor",
      ],
      start: "2019",
      end: "2023",
    },
  ] satisfies Education[],

  languages: [
    { language: "English", level: "Native" },
    { language: "Spanish", level: "C1" },
  ],

  skills: [
    {
      label: "Programming",
      skills: ["Python", "TypeScript", "SQL"],
    },
    {
      label: "AI / LLM",
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
      label: "Cloud & data",
      skills: ["GCP", "GCS", "BigQuery", "FastAPI"],
    },
  ] satisfies SkillGroup[],
};
