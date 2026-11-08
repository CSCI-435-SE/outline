import path from "node:path";
import type { TestProjectConfiguration } from "vitest/config";
import config from "./vitest.config";

// Used by Stryker (stryker.config.mjs). Both variables are optional and take
// comma-separated lists:
//
// - STRYKER_VITEST_PROJECTS: project names to keep (e.g.
//   "shared-node,shared-jsdom,app"), useful to skip the server project, which
//   needs Postgres and Redis to be running.
// - STRYKER_VITEST_INCLUDE: test files or globs to run instead of each
//   project's default include (e.g. "server/utils/fs.test.ts"). Server code is
//   imported by most server tests, so without this a single mutated server
//   file can pull in nearly the whole server suite.
const parseList = (value: string | undefined) =>
  value
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const onlyProjects = parseList(process.env.STRYKER_VITEST_PROJECTS);
const onlyInclude = parseList(process.env.STRYKER_VITEST_INCLUDE);

const projectName = (project: TestProjectConfiguration) => {
  if (typeof project !== "object" || !("test" in project)) {
    return undefined;
  }
  const name = project.test?.name;
  return typeof name === "string" ? name : name?.label;
};

const narrowInclude = (
  project: TestProjectConfiguration
): TestProjectConfiguration | undefined => {
  if (!onlyInclude || typeof project !== "object" || !("test" in project)) {
    return project;
  }
  // Only route each requested file to the projects that would normally run it.
  const include = onlyInclude.filter((file) =>
    (project.test?.include ?? []).some((glob) => path.matchesGlob(file, glob))
  );
  if (!include.length) {
    return undefined;
  }
  return { ...project, test: { ...project.test, include } };
};

const projects = config.test?.projects
  ?.filter(
    (project) =>
      !onlyProjects || onlyProjects.includes(projectName(project) ?? "")
  )
  .map(narrowInclude)
  .filter((project) => project !== undefined);

export default {
  ...config,
  test: {
    ...config.test,
    projects,
  },
};
