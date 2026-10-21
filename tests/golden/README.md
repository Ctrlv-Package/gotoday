# Golden set — listing quality regression check

`listings.json` is a small, hand-labelled set of real listing judgments: things GoToday
must **keep** (a family storytime, a park concert, a book-club meeting) and things it must
**drop** (a code-enforcement hearing, an election-site notice, a drink promo, a listing
whose title is only "Event Full").

Most drop cases come straight from this repository's commit history — each one was a real
cleanup commit. The set is run by `tests/golden.test.ts` as part of `npm test`, so a new
filter rule that accidentally kills a storytime fails the build instead of reaching the site.

## Adding a case

1. When the admin review surfaces a new junk pattern (or a good listing that was dropped),
   copy its **title, tags and the first ~200 characters of its description** into
   `listings.json` with `"keep": true/false`, the expected drop `reason` if it should drop
   (`announcement | meeting | passive-display | service-or-support | fitness-class |
   recurring-instruction | marked-ineligible`), and a one-line `note` saying where the
   judgment came from.
2. Run `npm test`. If the new case fails, the filter — not the case — is what changes,
   unless the judgment itself was wrong, in which case say so in the note.

Keep the set small and decisive: ~30–80 cases that encode real judgments beat thousands of
unlabelled listings.
