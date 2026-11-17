import { getFilterVisibility } from "./filterVisibility";

describe("getFilterVisibility", () => {
    describe("with no query and no document", () => {
        const visibility = getFilterVisibility({ hasDocument: false });

        it("shows the status filter (AC1)", () => {
            expect(visibility.documentType).toBe(true);
        });

        it("shows the date filter (AC1)", () => {
            expect(visibility.date).toBe(true);
        });

        it("shows the sort control (AC1)", () => {
            expect(visibility.sort).toBe(true);
        });

        it("shows the title-only toggle (AC1)", () => {
            expect(visibility.title).toBe(true);
        });

        it("keeps the collection and user filters visible (AC1)", () => {
            expect(visibility.collection).toBe(true);
            expect(visibility.user).toBe(true);
        });

        it("does not show the document filter chip", () => {
            expect(visibility.document).toBe(false);
        });
    });

    describe("with a query", () => {
        it("shows every filter except the document chip (AC2: unchanged)", () => {
            const visibility = getFilterVisibility({
                hasDocument: false,
                query: "wiki",
            });
            expect(visibility).toEqual({
                document: false,
                collection: true,
                user: true,
                documentType: true,
                date: true,
                title: true,
                sort: true,
            });
        });
    });

    describe("scoped to a document", () => {
        it("shows the document chip and hides collection (AC3: unchanged)", () => {
            const visibility = getFilterVisibility({ hasDocument: true });
            expect(visibility.document).toBe(true);
            expect(visibility.collection).toBe(false);
        });

        it("hides the user filter and title toggle without a query (AC3)", () => {
            const visibility = getFilterVisibility({ hasDocument: true });
            expect(visibility.user).toBe(false);
            expect(visibility.title).toBe(false);
        });

        it("shows the user filter once there is a query (AC3)", () => {
            const visibility = getFilterVisibility({
                hasDocument: true,
                query: "wiki",
            });
            expect(visibility.user).toBe(true);
        });
    });
});