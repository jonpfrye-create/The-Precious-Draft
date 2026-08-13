export interface RankablePlayer {
  full_name: string;
  position: string | null;
  nfl_team: string | null;
  search_rank: number | null;
  status: string | null;
}

// Sleeper's search_rank is good for skill positions and useless for the
// rest: every active kicker shares rank 999, while retired kickers carry
// real ranks from years ago and therefore sort above them. Sorting on it
// alone opens the Leftovers kicker round with a list of retired players.
//
// So draftability comes first, and search_rank only breaks ties within it.

// 999 is Sleeper's "no meaningful ranking" filler, not a real position.
const UNRANKED = 999;

function isRostered(player: RankablePlayer): boolean {
  return player.nfl_team !== null && player.nfl_team !== "";
}

// Lower sorts earlier. Injured players stay well above retired ones -
// someone on IR is a real draft consideration; someone out of the league
// is not.
function statusRank(status: string | null): number {
  switch (status) {
    case "Active":
      return 0;
    case "Injured Reserve":
    case "Physically Unable to Perform":
      return 1;
    case "Inactive":
      return 3;
    default:
      return 2;
  }
}

function effectiveSearchRank(player: RankablePlayer): number {
  if (player.search_rank === null) return Number.MAX_SAFE_INTEGER;
  if (player.search_rank >= UNRANKED) return Number.MAX_SAFE_INTEGER - 1;
  return player.search_rank;
}

/**
 * Orders players by how plausible they are as the next pick.
 *
 * Nobody is filtered out - a team that insists on drafting a retired
 * kicker still can, which matters because "all kickers are available" is a
 * rule of this league. They just sink beneath everyone playing this season.
 *
 * Returns a new array; does not mutate the input.
 */
export function sortByDraftability<T extends RankablePlayer>(players: T[]): T[] {
  return [...players].sort((a, b) => {
    // On an NFL roster beats not, ahead of everything else.
    const rostered = Number(isRostered(b)) - Number(isRostered(a));
    if (rostered !== 0) return rostered;

    const status = statusRank(a.status) - statusRank(b.status);
    if (status !== 0) return status;

    const rank = effectiveSearchRank(a) - effectiveSearchRank(b);
    if (rank !== 0) return rank;

    // Alphabetical last, so the order is stable rather than arbitrary
    // among the hundreds of players sharing rank 999.
    return a.full_name.localeCompare(b.full_name);
  });
}
