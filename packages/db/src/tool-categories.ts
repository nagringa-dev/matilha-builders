// Slugs are append-only: deleting or renaming one orphans every tool holding it. Labels are safe to change. Retire a category by removing it from pickers, never from this list.
export const TOOL_CATEGORIES = [
	{ label: "Pagamentos", slug: "payments" },
	{ label: "Deploy", slug: "deploy" },
	{ label: "Design", slug: "design" },
	{ label: "Gravação de tela", slug: "screen-recording" },
	{ label: "Email", slug: "email" },
	{ label: "Backend", slug: "backend" },
	{ label: "Banco de dados", slug: "database" },
	{ label: "Auth", slug: "auth" },
	{ label: "Analytics", slug: "analytics" },
	{ label: "IA / Agentes", slug: "ai-agents" },
	{ label: "MCP", slug: "mcp" },
	{ label: "Automação", slug: "automation" },
	{ label: "Marketing", slug: "marketing" },
	{ label: "Suporte", slug: "support" },
	{ label: "Produtividade", slug: "productivity" },
	{ label: "No-code", slug: "no-code" },
	{ label: "Outros", slug: "other" },
] as const;

export type ToolCategorySlug = (typeof TOOL_CATEGORIES)[number]["slug"];

export const TOOL_CATEGORY_SLUGS = TOOL_CATEGORIES.map((c) => c.slug) as [
	ToolCategorySlug,
	...ToolCategorySlug[],
];

export function toolCategoryLabel(slug: string): string {
	return TOOL_CATEGORIES.find((entry) => entry.slug === slug)?.label ?? slug;
}
