export interface BuiltInTemplate {
  /** The title of the template, also used to identify it when seeding. */
  title: string;
  /** A short summary shown in the template gallery. */
  description: string;
  /** An emoji used as the template icon. */
  icon: string;
  /** The template content as Markdown, may include template variables. */
  text: string;
}

/**
 * Templates that are provided to every workspace by default. Workspace admins
 * may edit or delete the seeded copies like any other workspace template.
 */
export const builtInTemplates: BuiltInTemplate[] = [
  {
    title: "Meeting notes",
    description:
      "Capture the agenda, discussion, decisions and action items from a meeting.",
    icon: "🗓️",
    text: `**Date:** {date}
**Facilitator:** {author}
**Attendees:**

## Agenda

1.

## Notes



## Decisions

-

## Action items

- [ ]
`,
  },
  {
    title: "Project brief",
    description:
      "Outline the problem, goals, scope and timeline before a project kicks off.",
    icon: "🚀",
    text: `**Owner:** {author}
**Last updated:** {date}

## Problem

What problem are we solving, and for whom?

## Goals

-

## Non-goals

-

## Scope



## Milestones

| Milestone | Date | Owner |
|---|---|---|
|  |  |  |

## Risks & open questions

-
`,
  },
  {
    title: "Retrospective",
    description:
      "Reflect on what went well, what didn't, and what the team will change next time.",
    icon: "🔁",
    text: `**Sprint / period:**
**Date:** {date}

## What went well

-

## What didn't go well

-

## What we learned

-

## Action items

- [ ]
`,
  },
  {
    title: "Bug report",
    description:
      "Describe a defect with reproduction steps, expected behavior and impact.",
    icon: "🐛",
    text: `**Reported by:** {author}
**Date:** {date}
**Severity:**

## Summary



## Steps to reproduce

1.

## Expected behavior



## Actual behavior



## Environment

- Browser / OS:
- Version:
`,
  },
  {
    title: "Decision record",
    description:
      "Document an important decision, the options considered and why it was made.",
    icon: "⚖️",
    text: `**Status:** Proposed
**Date:** {date}
**Deciders:** {author}

## Context

What is the situation that requires a decision?

## Options considered

1.

## Decision



## Consequences

-
`,
  },
];
