import type { TestProjectConfiguration } from "vitest/config";
import config from "./vitest.config";

// Used by Stryker (stryker.config.mjs). Set STRYKER_VITEST_PROJECTS to a
// comma-separated list of project names (e.g. "shared-node,shared-jsdom,app")
// to skip the others – useful to avoid the server project, which needs
// Postgres and Redis to be running.
const only = process.env.STRYKER_VITEST_PROJECTS?.split(",").map((name) =>
  name.trim()
);

const projectName = (project: TestProjectConfiguration) => {
  if (typeof project !== "object" || !("test" in project)) {
    return undefined;
  }
  const name = project.test?.name;
  return typeof name === "string" ? name : name?.label;
};

export default only
  ? {
      ...config,
      test: {
        ...config.test,
        projects: config.test?.projects?.filter((project) =>
          only.includes(projectName(project) ?? "")
        ),
      },
    }
  : config;
