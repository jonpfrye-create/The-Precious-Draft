"use client";

import { useState } from "react";
import { HARDWARE, type Competition } from "@/lib/league/history";

/**
 * The three trophies, each one a door into its own record book.
 *
 * A disclosure rather than a tab strip, because a tab strip insists that
 * something is always open and this section should be able to sit shut -
 * the page is a poster first and an archive second. Clicking the open
 * card closes it again.
 */
export default function Hardware() {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const open = HARDWARE.find((c) => c.key === openKey) ?? null;

  return (
    <section className="flex flex-col gap-6">
      <h2 className="font-arcade text-[11px] text-[#e8a33d] sm:text-[13px]">
        THE HARDWARE
      </h2>

      <div className="grid gap-4 sm:grid-cols-3 sm:gap-5">
        {HARDWARE.map((comp) => {
          const isOpen = comp.key === openKey;
          return (
            <button
              key={comp.key}
              type="button"
              aria-expanded={isOpen}
              aria-controls="hardware-record"
              onClick={() => setOpenKey(isOpen ? null : comp.key)}
              className="flex cursor-pointer flex-col items-center gap-3 border-[3px] px-5 py-7 text-center transition-[background-color,transform] hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e8a33d]"
              style={{
                borderColor: comp.border,
                // The open card lifts out of the row rather than just
                // gaining a border - at a glance you should be able to
                // see which record book is on the table.
                background: isOpen ? "rgba(232,163,61,0.14)" : comp.tint,
              }}
            >
              <span className="font-arcade text-[12px] sm:text-[14px]">
                {comp.name}
              </span>
              <span className="font-plex text-[11px] leading-[1.85] text-[#a3937d] sm:text-xs">
                {comp.blurb}
              </span>
              <span className="font-plex mt-1 text-[10px] tracking-[0.24em] text-[#e8a33d] uppercase">
                {isOpen ? "Close" : `${comp.seasons.length} seasons`}
                <span aria-hidden> {isOpen ? "▲" : "▼"}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div id="hardware-record">
        {open ? <Record comp={open} /> : null}
      </div>
    </section>
  );
}

function Record({ comp }: { comp: Competition }) {
  const span =
    comp.seasons[comp.seasons.length - 1].year === comp.seasons[0].year
      ? `${comp.seasons[0].year}`
      : `${comp.seasons[comp.seasons.length - 1].year}–${comp.seasons[0].year}`;

  return (
    <div
      className="animate-poster-in flex flex-col border-[3px] bg-[#14100d]"
      style={{ borderColor: comp.border }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b-2 border-[#2a1f18] px-4 py-4 sm:px-6">
        <span className="font-arcade text-[11px] text-[#e8a33d] sm:text-[13px]">
          {comp.name}
        </span>
        <span className="font-plex text-[10px] tracking-[0.24em] text-[#8a7c68] uppercase sm:text-[11px]">
          {span} · {comp.seasons.length} seasons
        </span>
      </div>

      {/* Column headings are for the wide layout only. On a phone each
          year becomes its own block and the places label themselves,
          because four columns of names like "McCringleberry3Pumps" in
          366 pixels is not a table, it is a wall. */}
      <div className="font-plex hidden gap-x-5 px-6 py-3 text-[10px] tracking-[0.24em] text-[#8a7c68] uppercase sm:grid sm:grid-cols-[4.5rem_repeat(3,minmax(0,1fr))]">
        <span>Year</span>
        <span>First</span>
        <span>Second</span>
        <span>Third</span>
      </div>

      <ol className="flex flex-col">
        {comp.seasons.map((season) => (
          <li
            key={season.year}
            className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-x-4 gap-y-1 border-t-2 border-[#221a15] px-4 py-3 sm:grid-cols-[4.5rem_repeat(3,minmax(0,1fr))] sm:gap-x-5 sm:px-6"
          >
            <span className="font-arcade row-span-3 self-center text-[11px] text-[#efe6d2] tabular-nums sm:row-span-1 sm:text-[12px]">
              {season.year}
            </span>
            <Place label="1st" name={season.first} color="#e8a33d" />
            <Place label="2nd" name={season.second} color="#efe6d2" />
            <Place label="3rd" name={season.third} color="#a3937d" />
          </li>
        ))}
      </ol>
    </div>
  );
}

function Place({
  label,
  name,
  color,
}: {
  label: string;
  name: string;
  color: string;
}) {
  return (
    <span
      className="font-plex flex min-w-0 items-baseline gap-2 text-[12px] leading-snug sm:text-[13px]"
      style={{ color }}
    >
      <span
        aria-hidden
        className="w-6 shrink-0 text-[9px] tracking-[0.14em] text-[#6b5340] uppercase sm:hidden"
      >
        {label}
      </span>
      <span className="min-w-0 break-words">{name}</span>
    </span>
  );
}
