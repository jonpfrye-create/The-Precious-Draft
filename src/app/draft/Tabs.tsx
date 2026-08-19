"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * My team, or the whole board.
 *
 * Drafters had no way to see the board at all, which on a phone made the
 * draft feel like a form rather than a room - you could take your turn
 * and never see what anyone else had done.
 */
export default function Tabs() {
  const path = usePathname();
  const onBoard = path.startsWith("/draft/board");

  const base =
    "flex-1 rounded-md px-4 py-2 text-center text-sm font-semibold transition-colors";
  const on = "bg-black text-white dark:bg-white dark:text-black";
  const off = "text-zinc-500";

  return (
    <nav className="mx-auto mb-3 flex w-full max-w-md gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900">
      <Link href="/draft" className={`${base} ${onBoard ? off : on}`}>
        My team
      </Link>
      <Link href="/draft/board" className={`${base} ${onBoard ? on : off}`}>
        The board
      </Link>
    </nav>
  );
}
