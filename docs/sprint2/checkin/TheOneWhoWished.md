What did you implement so far in the sprint, and what remains?

I implemented a stale documents indicator. It shows a “stale” label in the sidebar where documents are shown. By default, the time for a document to go stale is 180 days. I still need to implement the first part of the “Add a structured document review/approval workflow” issue which will be a lot of code split across multiple sprints.

What is one thing you learned about the codebase or about software engineering practice?

The existing “updated at” logic includes moving a document to another folder, so this whole time, anything that uses “last updated” such as the search function was affected by someone simply moving the document around, even if that document was never actually edited. That is why for this issue, I created a new “edited at” column so that documents that are moved do not use their “stale”  status. 

What is one thing you would do differently?

I committed a bug… (to the branch, not to main) by setting lastEditedAt only in a save hook. Since live editing in the editor skips hooks, typing in a document never updated the date, making this feature useless. I also didn’t think ahead about where to put the clock (stale) symbol. I originally put it in the sidebar where the hover menu appears when hovering over a document name, which made it impossible to hover over the clock itself as it would be covered by the hover menu. Good thing I caught that by manual testing\!