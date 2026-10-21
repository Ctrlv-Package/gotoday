# Photos: the stopping rule

GoToday shows, in order of preference:
1. **The organizer's own photo** for the event (from its page or post).
2. **A shared library photo for the event's type** (storytime, concert, market…)
   when the organizer's photo is missing, blocked, or a generic banner/logo.
3. Nothing — a card without a photo beats a misleading photo.

## When to stop tuning

Photo selection is *done* for a category when a card with the category photo gets
clicked at roughly the same rate as a card with the organizer's own photo
(check Analytics: card clicks by photo kind). Until that measurement exists for a
category:

- **No new per-title or per-keyword photo rules.** The commit history shows where
  that road leads: an endless series of one-listing fixes.
- A wrong-photo report is fixed by improving the **category** match or the
  generic-picture rejection, never by special-casing one event, one venue or
  one title.
- Photos that could frighten or mislead (horror imagery, dolls/clowns for kids'
  events, a different town's skyline) are the exception: those are correctness
  bugs, fixed immediately, and the fix is a rejection rule, not a new picture.

If a category has no honest library photo, it ships without one.
