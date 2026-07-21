import type { Database } from "@/lib/database.types";

export type SpotRating = Database["public"]["Tables"]["spot_ratings"]["Row"];

export type SpotRatingSummary = {
  average: number | null;
  count: number;
  myRating: number | null;
  myFavorite: boolean;
  myNote: string | null;
  favoriteCount: number;
};

export type RaterOption = {
  userId: string;
  label: string;
};

export function summarizeRatings(
  ratings: SpotRating[],
  currentUserId: string | null,
): Record<string, SpotRatingSummary> {
  const bySpot = new Map<string, SpotRating[]>();
  for (const rating of ratings) {
    const list = bySpot.get(rating.spot_id) ?? [];
    list.push(rating);
    bySpot.set(rating.spot_id, list);
  }

  const summaries: Record<string, SpotRatingSummary> = {};
  for (const [spotId, list] of bySpot.entries()) {
    const numeric = list
      .map((entry) => entry.rating)
      .filter((value): value is number => typeof value === "number");
    const mine = currentUserId
      ? list.find((entry) => entry.user_id === currentUserId)
      : undefined;
    summaries[spotId] = {
      average: numeric.length
        ? Math.round((numeric.reduce((sum, value) => sum + value, 0) / numeric.length) * 10) / 10
        : null,
      count: numeric.length,
      myRating: mine?.rating ?? null,
      myFavorite: mine?.is_favorite ?? false,
      myNote: mine?.note ?? null,
      favoriteCount: list.filter((entry) => entry.is_favorite).length,
    };
  }
  return summaries;
}

export function emptySummary(): SpotRatingSummary {
  return {
    average: null,
    count: 0,
    myRating: null,
    myFavorite: false,
    myNote: null,
    favoriteCount: 0,
  };
}
