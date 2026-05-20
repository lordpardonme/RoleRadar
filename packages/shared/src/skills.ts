export const KNOWN_SKILLS = [
  "JavaScript",
  "TypeScript",
  "React",
  "Next.js",
  "Node.js",
  "Express",
  "Fastify",
  "Python",
  "Django",
  "Flask",
  "Java",
  "Spring",
  "Go",
  "Rust",
  "C#",
  ".NET",
  "SQL",
  "Postgres",
  "MySQL",
  "MongoDB",
  "Redis",
  "AWS",
  "GCP",
  "Azure",
  "Docker",
  "Kubernetes",
  "Terraform",
  "GraphQL",
  "REST",
  "Tailwind",
  "Prisma",
  "Machine Learning",
  "Data Analysis",
  "Excel",
  "Salesforce",
  "HubSpot",
  "SEO",
  "Figma",
  "Product Management",
  "Project Management",
  "Customer Success",
  "Recruiting",
  "B2B Sales",
  "Copywriting",
  "Content Strategy"
];

export function extractKnownSkills(text: string): string[] {
  const normalized = ` ${text.toLowerCase()} `;
  return KNOWN_SKILLS.filter((skill) => {
    const escaped = skill.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9+#.])${escaped}([^a-z0-9+#.]|$)`, "i").test(normalized);
  });
}
