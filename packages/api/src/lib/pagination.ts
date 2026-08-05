import { PAGE_SIZE } from "./constants";

export function paginate<T>(items: T[], cursor: number) {
	return {
		items,
		nextCursor: items.length === PAGE_SIZE ? cursor + PAGE_SIZE : undefined,
	};
}
