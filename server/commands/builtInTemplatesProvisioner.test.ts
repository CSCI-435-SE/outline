import { Template } from "@server/models";
import { builtInTemplates } from "@server/onboarding/templates";
import { buildAdmin } from "@server/test/factories";
import builtInTemplatesProvisioner from "./builtInTemplatesProvisioner";

describe("builtInTemplatesProvisioner", () => {
  it("should seed built-in workspace templates", async () => {
    const user = await buildAdmin();

    const created = await builtInTemplatesProvisioner({ user });

    expect(created).toHaveLength(builtInTemplates.length);

    const templates = await Template.findAll({
      where: { teamId: user.teamId },
    });
    expect(templates).toHaveLength(builtInTemplates.length);

    for (const template of templates) {
      expect(template.isBuiltIn).toEqual(true);
      expect(template.collectionId).toBeNull();
      expect(template.publishedAt).toBeTruthy();
      expect(template.description).toBeTruthy();
      expect(template.content?.content?.length).toBeGreaterThan(0);
      expect(template.createdById).toEqual(user.id);
    }
  });

  it("should not create duplicates when run again", async () => {
    const user = await buildAdmin();

    await builtInTemplatesProvisioner({ user });
    const created = await builtInTemplatesProvisioner({ user });

    expect(created).toHaveLength(0);
    expect(await Template.count({ where: { teamId: user.teamId } })).toEqual(
      builtInTemplates.length
    );
  });

  it("should not recreate built-in templates that were deleted", async () => {
    const user = await buildAdmin();

    const [first] = await builtInTemplatesProvisioner({ user });
    await first.destroy();

    const created = await builtInTemplatesProvisioner({ user });

    expect(created).toHaveLength(0);
    expect(await Template.count({ where: { teamId: user.teamId } })).toEqual(
      builtInTemplates.length - 1
    );
  });
});
