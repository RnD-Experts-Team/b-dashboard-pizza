import {
  CalendarCheck,
  CalendarDays,
  CalendarOff,
  ClipboardCheck,
  GitCompare,
  Info,
  ListChecks,
  Radio,
  RefreshCw,
  Search,
} from "lucide-react";
import type { GuideStep } from "@/components/shared/page-guide";

/**
 * The guided tour of the scheduling page.
 *
 * The page is three views of one week, and the difference between them is the
 * thing people get wrong — a manager who has only ever seen Planned does not
 * know that Actual exists, let alone that a clock-in lands there by itself. So
 * the tour drives the view as it goes rather than describing what the reader
 * cannot see, and puts the original view back when it ends.
 *
 * Steps and their views are declared together, and the pair is what gets
 * filtered before opening. Keying the views off the step index separately would
 * break the moment a step was dropped for a missing target, and keying off the
 * step id cannot work at all: three steps deliberately spotlight the same grid.
 */

/**
 * Which of the three views a step needs.
 *
 * `mode` is the grid's own planned/actual switch, not the API's `ScheduleMode`
 * — that carries a third value, `"both"`, which is a request parameter and
 * never something on screen.
 */
export interface SchedulingGuideView {
  mode: "planned" | "actual";
  comparison: boolean;
}

export interface SchedulingGuideEntry {
  step: GuideStep;
  /** The view this step needs on screen. Omitted = leave whatever is showing. */
  view?: SchedulingGuideView;
}

const PLANNED: SchedulingGuideView = { mode: "planned", comparison: false };
const ACTUAL: SchedulingGuideView = { mode: "actual", comparison: false };
const COMPARE: SchedulingGuideView = { mode: "planned", comparison: true };

export const SCHEDULING_GUIDE: SchedulingGuideEntry[] = [
  {
    step: {
      id: "sched-intro",
      icon: CalendarDays,
      title: "How scheduling works here",
      description:
        "You plan a week, your team works it, and this page keeps both records side by side — one week at a time.",
      bullets: [
        "Planned — the shifts you intend. Build the week here, then publish it so your team knows when to come in.",
        "Actual — what really happened. When someone clocks in at the store their shift appears here by itself, waiting for you to check it.",
        "Compare — the two together, so you can see who worked longer, shorter, or not at all.",
        "Nothing you plan reaches your team until you publish the week.",
        "This tour moves through all three, and puts you back where you started.",
      ],
      placement: "bottom",
      noHighlight: true,
    },
  },

  {
    step: {
      id: "sched-week",
      icon: CalendarDays,
      title: "The week on screen",
      description:
        "Everything below belongs to the week named here — the shifts, the hours, and the totals.",
      bullets: [
        "The arrows move one week at a time, backwards or forwards",
        "Today brings you back to the week you are in",
        "You can plan ahead as far as you like",
      ],
      placement: "bottom",
    },
    view: PLANNED,
  },

  {
    step: {
      id: "sched-views",
      icon: GitCompare,
      title: "Switching between the views",
      description:
        "Planned and Actual are two separate records of the same week. Moving between them changes nothing — it only changes what you are looking at, so it is always safe to have a look.",
      bullets: [
        "Compare shows both at once, and cannot be edited",
        "Switching is instant, and nothing you have done is lost",
      ],
      placement: "bottom",
    },
    view: PLANNED,
  },

  {
    step: {
      id: "sched-grid",
      icon: CalendarCheck,
      title: "Planned — building the week",
      description:
        "A row per employee, a column per day. This is the schedule your staff will be given.",
      bullets: [
        "Click an empty cell to add a shift there",
        "Hover over a shift to edit or delete it",
        "New shifts are held as drafts until you press Save, so you can lay out a whole week before committing to any of it",
        "Publish the week once you are happy with it — that is what your team sees",
      ],
      placement: "top",
    },
    view: PLANNED,
  },

  {
    step: {
      id: "sched-grid",
      icon: ClipboardCheck,
      title: "Actual — what really happened",
      description:
        "The same week, but attendance. Shifts appear here on their own when someone clocks in, so most of the work is confirming rather than typing.",
      bullets: [
        "A shift marked C was recorded by the time clock",
        "Tick to accept it, pencil to correct the times, bin to remove it",
        "A clock-in on a day you planned is shown under that plan, waiting for you to agree",
        "A shift someone is working right now shows a pulsing dot and no end time",
        "Use \"Needs attention\" in the toolbar to work through only the shifts worth checking",
      ],
      placement: "top",
    },
    view: ACTUAL,
  },

  {
    step: {
      id: "sched-grid",
      icon: GitCompare,
      title: "Compare — plan against reality",
      description:
        "Plan on top, what was recorded underneath, in every cell. This is where you check a week before it goes to payroll.",
      bullets: [
        "Any difference from the plan is flagged, and the size of it is shown beside the shift",
        "Hover a shift to see how far off each end was — \"in −4m · out +8m\"",
        "Nothing can be changed from here — use Planned or Actual for that",
        "Hover over any cell for the full breakdown",
      ],
      placement: "top",
    },
    view: COMPARE,
  },

  {
    step: {
      id: "sched-legend",
      icon: Info,
      title: "What the colours mean",
      description:
        "Every shift carries a thin coloured bar down its leading edge. That bar is the whole colour system, and it means the same thing in all three views. This button opens the key whenever you need it.",
      bullets: [
        "Green — the hours match the plan",
        "Amber — worth a look: the hours differ from the plan, they changed after you signed them off, or the shift lands on someone's time off",
        "Red — a problem: a no-show, or two shifts overlapping",
        "Purple — worked without being planned",
        "No bar at all — nothing to flag, including a shift still being worked",
        "A C beside a shift means the time clock recorded it, not you",
      ],
      placement: "bottom",
    },
    view: COMPARE,
  },

  {
    step: {
      id: "sched-search",
      icon: Search,
      title: "Finding one person",
      description:
        "Type a name to show just that person. The hours and totals follow whatever is filtered.",
      bullets: [
        "The filter beside it narrows the week to one department",
        "Both apply to every view",
      ],
      placement: "bottom",
    },
    view: PLANNED,
  },

  {
    step: {
      id: "sched-on-the-clock",
      icon: Radio,
      title: "Who is working right now",
      description:
        "Everyone punched in at the store this minute, however they punched — through this app, a clock on the wall, or the time-clock system itself.",
      bullets: [
        "Clock someone in or out from here",
        "It keeps itself up to date while the list is open",
        "A shift appears in Actual the moment someone clocks in, and fills in as they work",
      ],
      placement: "bottom",
    },
    view: ACTUAL,
  },

  {
    step: {
      id: "sched-availability",
      icon: CalendarOff,
      title: "When people cannot work",
      description:
        "Blocked times and time off for this week. Scheduling someone over one of these does not stop you — it flags the shift so you can decide.",
      placement: "bottom",
    },
    view: PLANNED,
  },

  {
    step: {
      id: "sched-refresh",
      icon: RefreshCw,
      title: "Keeping it up to date",
      description:
        "Beside the button it tells you when this week was last checked. It checks again on its own after a few minutes.",
      bullets: [
        "Press Refresh if you think something has changed since — a new clock-in, or someone else editing the same week",
      ],
      placement: "bottom",
    },
    view: PLANNED,
  },

  {
    step: {
      id: "sched-actions",
      icon: ListChecks,
      title: "Everything in the Actions menu",
      description:
        "One line each. Most of these change the plan, so they are available in the Planned view only.",
      bullets: [
        "Copy Previous Week — fills this week with last week's shifts",
        "Clear Week — removes every shift in the week",
        "Publish Week — sends the plan out to staff",
        "Published History — every time you published this week, and the image that went out with it",
        "Save as Template — keeps this week's pattern to reuse",
        "Load Week Template — applies a saved pattern to this week",
        "Export as Excel — downloads the week as a spreadsheet",
        "Screenshot — an image of the whole week",
        "Employee Screenshot — an image of one person's row",
      ],
      placement: "bottom",
    },
    view: PLANNED,
  },
];
