import { type SQL, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Streak weeks are calendar weeks in the community's timezone, not rolling
 * 7-day windows: they start Monday at 00:00 local time. Anchoring to UTC would
 * roll the week over at 21:00 on Sunday for everyone here.
 */
export const WEEK_TIME_ZONE = "America/Sao_Paulo";

/**
 * A check-in stays editable for 14 days after it was posted, then locks. This
 * is a rolling window, deliberately independent of the calendar weeks the
 * streak counts: it gives everyone the same amount of time to fix a post, no
 * matter which weekday they wrote it on.
 */
export const EDIT_WINDOW_MS = 14 * MS_PER_DAY;

const localDateFormatter = new Intl.DateTimeFormat("en-CA", {
	day: "2-digit",
	month: "2-digit",
	timeZone: WEEK_TIME_ZONE,
	year: "numeric",
});

/**
 * 1970-01-01 (epoch day 0) was a Thursday, so shifting by 3 days puts Monday
 * at the start of each 7-day bucket.
 */
const EPOCH_TO_MONDAY_OFFSET_DAYS = 3;

/**
 * Index of the Monday-anchored calendar week a moment falls into, counted in
 * São Paulo local time. Two moments share an index exactly when they belong to
 * the same week; subtracting two indexes gives the number of week boundaries
 * crossed between them.
 */
export function weekIndex(date: Date): number {
	const [year = 0, month = 0, day = 0] = localDateFormatter
		.format(date)
		.split("-")
		.map(Number);
	const epochDays = Math.floor(Date.UTC(year, month - 1, day) / MS_PER_DAY);
	return Math.floor((epochDays + EPOCH_TO_MONDAY_OFFSET_DAYS) / 7);
}

/**
 * Weekly check-in cadence: the first check-in of a calendar week scores the
 * point for that week. Extra check-ins in the same week are still recorded but
 * don't score again. Skipping a whole week resets the streak to 1.
 */
export function computeNextStreak(
	previousStreak: number,
	lastCheckInAt: Date | null,
	now: Date
): number {
	if (!lastCheckInAt) {
		return 1;
	}
	const weeksApart = weekIndex(now) - weekIndex(lastCheckInAt);
	if (weeksApart <= 0) {
		// Same week (or a backdated check-in): keep the point already scored.
		return Math.max(previousStreak, 1);
	}
	return weeksApart === 1 ? Math.max(previousStreak, 1) + 1 : 1;
}

/**
 * A founder enters a negative streak after skipping a full calendar week.
 * Each additional skipped week decreases the displayed streak by one more.
 * The current week never decays — there's still time to check in.
 */
export function computeCurrentStreak(
	previousStreak: number,
	lastCheckInAt: Date | null,
	now: Date
): number {
	if (!lastCheckInAt) {
		return previousStreak;
	}

	const weeksWithoutCheckIn = weekIndex(now) - weekIndex(lastCheckInAt);
	return weeksWithoutCheckIn >= 2 ? 1 - weeksWithoutCheckIn : previousStreak;
}

/**
 * SQL mirror of computeCurrentStreak, for ORDER BY on the decayed streak
 * value instead of the raw stored column. `lastCheckInColumn` is a
 * `timestamp without time zone` holding a UTC instant, so it needs converting
 * to São Paulo local time before the weeks are bucketed.
 */
export function currentStreakSql(
	streakColumn: AnyPgColumn,
	lastCheckInColumn: AnyPgColumn,
	now: Date
): SQL<number> {
	const nowWeek = sql`date_trunc('week', ${now}::timestamptz at time zone ${WEEK_TIME_ZONE})`;
	const lastWeek = sql`date_trunc('week', (${lastCheckInColumn} at time zone 'UTC') at time zone ${WEEK_TIME_ZONE})`;
	const weeksWithoutCheckIn = sql`(extract(day from (${nowWeek} - ${lastWeek})) / 7)::int`;
	return sql<number>`
		case
			when ${lastCheckInColumn} is null then ${streakColumn}
			when ${weeksWithoutCheckIn} >= 2 then 1 - (${weeksWithoutCheckIn})
			else ${streakColumn}
		end
	`;
}
