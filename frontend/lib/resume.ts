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
  bullets: string[];
  tech: string[];
};

export type Education = {
  school: string;
  degree: string;
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
    "Full-Stack AI Engineer — production LLM agents, RAG, and development platforms.",
  email: "crhenry81@gmail.com",
  github: "https://github.com/colehenry",
  linkedin: "https://www.linkedin.com/in/cole-henry-9b699b178/",
  pdf: "/resume.pdf",

  experience: [
    {
      company: "Interscope Records (Universal Music Group)",
      role: "AI Software Engineer",
      start: "Sep 2025",
      end: "present",
      location: "Santa Monica, CA",
      bullets: [
        "Shipped production LLM agents serving 150+ internal users daily, built on Python backend services (LangGraph / MCP) running on GCP with Vertex AI and GCS-backed pipelines processing large-scale streaming and social data.",
        "Designed and built a RAG knowledge platform that lets LLM agents answer questions from internal docs, cutting manual analytics reporting 50%.",
        "Built an A&R research app that surfaces 100+ new artists weekly through automated pipelines, used by A&R to evaluate signings.",
        "Built a React + TypeScript analytics platform replacing 30+ Tableau dashboards, with embedded AI agents for natural-language data analysis.",
      ],
      tech: ["Python", "LangGraph", "MCP", "Vertex AI", "GCP", "React", "TypeScript"],
    },
    {
      company: "Interscope Records (Universal Music Group)",
      role: "Analytics Engineer",
      start: "Sep 2024",
      end: "Aug 2025",
      location: "Santa Monica, CA",
      bullets: [
        "Designed and maintained core data pipelines in Python and BigQuery powering automated executive and international reporting.",
        "Built 15+ Tableau dashboards used by international stakeholders.",
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
        "Built a natural language → SOQL service, enabling non-technical users to query Salesforce, reducing tickets by 30%.",
        "Built an error logging system processing 10K+ daily events with 99.9% accuracy, improving debugging efficiency.",
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
        "Taught 16 sections across English, music, and technology, collaborating with Spanish-speaking teachers.",
      ],
      tech: [],
    },
  ] satisfies Experience[],

  education: [
    {
      school: "University of North Carolina at Chapel Hill",
      degree: "B.A. Computer Science · B.S. Statistics & Analytics · Minor, Hispanic Studies",
      start: "2019",
      end: "2023",
    },
  ] satisfies Education[],

  skills: [
    {
      label: "Languages",
      skills: ["Python", "TypeScript", "SQL"],
    },
    {
      label: "AI / LLM",
      skills: ["LangGraph", "RAG", "LLM agents", "Embeddings", "Vertex AI", "MCP"],
    },
    {
      label: "Cloud & data",
      skills: ["GCP", "GCS", "BigQuery", "FastAPI"],
    },
  ] satisfies SkillGroup[],
};
