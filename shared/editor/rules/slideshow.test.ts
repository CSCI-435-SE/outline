import { extensionManager, findNodes, schema } from "../../test/editor";
import { DEFAULT_SLIDESHOW_INTERVAL } from "../lib/slideshow";

const serializer = extensionManager.serializer();
const parser = extensionManager.parser({
  schema,
  plugins: extensionManager.rulePlugins,
});

const parse = (markdown: string) => parser.parse(markdown)?.toJSON();

describe("slideshow markdown", () => {
  it("parses a slideshow block with its images in order and interval", () => {
    const [slideshow] = findNodes(
      parse(`:::slideshow 5000
![](https://example.com/a.png)
![](https://example.com/b.png)
![](/api/attachments.redirect?id=123)
:::`),
      "slideshow"
    );

    expect(slideshow?.attrs).toEqual({
      images: [
        "https://example.com/a.png",
        "https://example.com/b.png",
        "/api/attachments.redirect?id=123",
      ],
      interval: 5000,
    });
  });

  it("accepts bare urls and defaults the interval", () => {
    const [slideshow] = findNodes(
      parse(`:::slideshow
https://example.com/a.png
:::`),
      "slideshow"
    );

    expect(slideshow?.attrs).toEqual({
      images: ["https://example.com/a.png"],
      interval: DEFAULT_SLIDESHOW_INTERVAL,
    });
  });

  it("drops unsafe image urls", () => {
    const [slideshow] = findNodes(
      parse(`:::slideshow 3000
![](javascript:alert(1))
![](https://example.com/a.png)
:::`),
      "slideshow"
    );

    expect(slideshow?.attrs?.images).toEqual(["https://example.com/a.png"]);
  });

  it("parses an empty slideshow", () => {
    const [slideshow] = findNodes(
      parse(`:::slideshow 3000
:::`),
      "slideshow"
    );

    expect(slideshow?.attrs?.images).toEqual([]);
  });

  it("serializes a slideshow to markdown", () => {
    const doc = schema.nodes.doc.create(null, [
      schema.nodes.slideshow.create({
        images: ["https://example.com/a.png", "https://example.com/b (1).png"],
        interval: 3000,
      }),
    ]);

    expect(serializer.serialize(doc).trim()).toBe(
      `:::slideshow 3000
![](https://example.com/a.png)
![](https://example.com/b%20%281%29.png)
:::`
    );
  });

  it("round-trips through markdown unchanged", () => {
    const markdown = `Before

:::slideshow 4000
![](https://example.com/a.png)
![](https://example.com/b.png)
![](https://example.com/c.png)
:::

After`;

    const doc = parser.parse(markdown);
    const output = serializer.serialize(doc);

    expect(output.trim()).toBe(markdown);
    expect(parser.parse(output)?.toJSON()).toEqual(doc?.toJSON());
  });

  it("round-trips a slideshow in a list inside a notice", () => {
    const slideshow = schema.nodes.slideshow.create({
      images: ["https://example.com/a.png", "https://example.com/b.png"],
      interval: 3000,
    });
    const doc = schema.nodes.doc.create(null, [
      schema.nodes.container_notice.create({ style: "info" }, [
        schema.nodes.bullet_list.create(null, [
          schema.nodes.list_item.create(null, [
            schema.nodes.paragraph.create(null, schema.text("Photos")),
            slideshow,
          ]),
        ]),
      ]),
      schema.nodes.paragraph.create(null, schema.text("After the notice")),
    ]);

    const markdown = serializer.serialize(doc);
    const parsed = parser.parse(markdown);

    expect(markdown).toContain("::::info");
    expect(parsed?.toJSON()).toEqual(doc.toJSON());
    expect(findNodes(parsed?.toJSON(), "container_notice")).toHaveLength(1);
  });

  it("keeps the standard marker for notices without nested blocks", () => {
    const doc = schema.nodes.doc.create(null, [
      schema.nodes.container_notice.create({ style: "info" }, [
        schema.nodes.paragraph.create(null, schema.text("Hello")),
      ]),
    ]);

    expect(serializer.serialize(doc).trim()).toBe(`:::info
Hello

:::`);
  });

  it("does not affect notices", () => {
    const json = parse(`:::info
Hello
:::`);

    expect(findNodes(json, "container_notice")).toHaveLength(1);
    expect(findNodes(json, "slideshow")).toHaveLength(0);
  });

  it("falls back to a paragraph when the block is not closed", () => {
    const json = parse(`:::slideshow 3000
![](https://example.com/a.png)`);

    expect(findNodes(json, "slideshow")).toHaveLength(0);
  });
});
