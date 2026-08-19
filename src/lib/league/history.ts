/**
 * Seventeen years of results, as the league remembers them.
 *
 * Three competitions, each with its own start date: the Precious has run
 * since 2009, Leftovers since 2021, Microwave since 2023. Only the
 * podium is recorded - where any individual manager finished is nobody's
 * business but theirs.
 *
 * Hand-entered from the commissioner's own records and checked by
 * `history.test.ts`, which is the only thing standing between a typo and
 * a wrong year on a screen in front of the people who were there.
 */

export type Podium = {
  year: number;
  first: string;
  second: string;
  third: string;
};

export type Competition = {
  key: string;
  name: string;
  /** What winning it, or not, actually means. */
  blurb: string;
  border: string;
  tint: string;
  /** Newest first - the way anybody reading it wants to see it. */
  seasons: Podium[];
};

const PRECIOUS: Podium[] = [
  { year: 2025, first: "50 Shades of Gay", second: "Battlesnakeowitz", third: "Mom! The Meatloaf!" },
  { year: 2024, first: "50 Shades of Gay", second: "Prestige Worldwide", third: "Run the Precious" },
  { year: 2023, first: "Run the Precious", second: "Jonny Clams", third: "You Got a Purdy Mouth" },
  { year: 2022, first: "The Justin Jeffersons", second: "Run the Precious", third: "Jonny Clams" },
  { year: 2021, first: "Battlesnakeowitz", second: "Jonny Clams", third: "2 Gurley’s 1 Kupp" },
  { year: 2020, first: "Urine Trouble", second: "Son of Dad", third: "Lawyers Guns N Money" },
  { year: 2019, first: "Sofa King Tactilious", second: "Jonny Clams", third: "50 Shades of Gay" },
  { year: 2018, first: "Battlesnakeowitz", second: "Urine Trouble", third: "Goatse Lemonparty" },
  { year: 2017, first: "McCringleberry3Pumps", second: "Sofa King Tactilious", third: "Jonny Clams" },
  { year: 2016, first: "Prestige Worldwide", second: "Urine Trouble", third: "Gurley Men" },
  { year: 2015, first: "Bangers & Crooks", second: "Sofa King Tactilious", third: "Greg Hardy Sex Party" },
  { year: 2014, first: "Sofa King Tactilious", second: "JakmeriusTaktheratrx", third: "RayRiceElevatorParty" },
  { year: 2013, first: "Bangers & Crooks", second: "Battlesnakeowitz", third: "Urine Trouble" },
  { year: 2012, first: "Sofa King Tactilious", second: "Prestige Worldwide", third: "KockyKock’73" },
  { year: 2011, first: "Battlesnakeowitz", second: "Urine Trouble", third: "Bangers & Crooks" },
  { year: 2010, first: "Urine Trouble", second: "No More Mr. Nice Guy", third: "Touchdown... There?" },
  { year: 2009, first: "Battlesnakeowitz", second: "Fightin’ Fitz", third: "Daring to be Great" },
];

const LEFTOVERS: Podium[] = [
  { year: 2025, first: "Alshon Joffrey", second: "Moonrise Artist", third: "Charcandrik Westeros" },
  { year: 2024, first: "Shane Meereen", second: "White Welkers", third: "Charcandrik Westeros" },
  { year: 2023, first: "A Gurley Has No Name", second: "Moonrise Artist", third: "Alshon Joffrey" },
  { year: 2022, first: "Jameis Lannister", second: "White Welkers", third: "Alshon Joffrey" },
  { year: 2021, first: "Alshon Joffrey", second: "White Welkers", third: "Jameis Lannister" },
];

const MICROWAVE: Podium[] = [
  { year: 2025, first: "WILSON!!!!", second: "Fannin’ Out the Flames", third: "Hey Franklin" },
  { year: 2024, first: "The Dortcher Chamber", second: "Lazard Focused", third: "Takes a Tol-bert" },
  { year: 2023, first: "Dell in a Handbasket", second: "C Otten Mouth", third: "The Bourne Stupidity" },
];

export const HARDWARE: Competition[] = [
  {
    key: "precious",
    name: "THE PRECIOUS",
    blurb: "First place. Handed over in silence, reclaimed without ceremony.",
    border: "#e8a33d",
    tint: "rgba(232,163,61,0.06)",
    seasons: PRECIOUS,
  },
  {
    key: "leftovers",
    name: "LEFTOVERS",
    blurb: "Everything between glory and disgrace. Nobody has asked to see it.",
    border: "#6b5340",
    tint: "transparent",
    seasons: LEFTOVERS,
  },
  {
    key: "microwave",
    name: "MICROWAVE",
    blurb: "Last place. It heats things. That is the whole of the punishment.",
    border: "#c1391f",
    tint: "rgba(193,57,31,0.07)",
    seasons: MICROWAVE,
  },
];

/**
 * The season the league is about to play, as a Roman numeral for the
 * poster. Derived from the results rather than typed in beside them, so
 * the two can never drift: seventeen years in the books makes this the
 * eighteenth.
 */
export function currentSeasonNumber(): number {
  return PRECIOUS.length + 1;
}

const NUMERALS: [number, string][] = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
  [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
  [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

export function toRoman(n: number): string {
  let left = n;
  let out = "";
  for (const [value, numeral] of NUMERALS) {
    while (left >= value) {
      out += numeral;
      left -= value;
    }
  }
  return out;
}
