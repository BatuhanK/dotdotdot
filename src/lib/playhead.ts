import type { TimedItem, Timeline } from './timeline'

/** When an item starts on the timeline: keyboard opens, typing bubble shows, or the bubble appears. */
export function itemStart(item: TimedItem): number {
  if (item.appearAt < 0) return 0 // already on screen when the video starts
  return item.composeStart ?? item.typing[0]?.[0] ?? item.appearAt
}

/** The frame to show when jumping to an item: a moment into its typing, so it is recognizable. */
export function seekTimeFor(item: TimedItem): number {
  if (item.appearAt < 0) return 0
  if (item.composeStart !== null) return item.composeStart + 0.3
  return (item.typing[0]?.[0] ?? item.appearAt) + 0.6
}

/** The message playing at time t: the last one that has started. */
export function activeItemAt(timeline: Timeline, t: number): TimedItem | null {
  let found: TimedItem | null = null
  for (const it of timeline.items) {
    if (it.appearAt >= 0 && itemStart(it) <= t + 1e-3) found = it
  }
  return found
}
