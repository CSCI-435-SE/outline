**What have you implemented so far, and what remains?**

I finished the first two parts of the request access feature (#12): showing the No access page instead of Resource
not found (#94, PR #98), and adding an optional reason and an email notification to access requests (#95, PR #102).
Both are merged. I am completing the third part (#96), which was mostly built already, so I am fixing how the page
handles a failed pending-request check and adding tests. A review of my earlier work also found bugs, such as admins
being emailed about documents they cannot open, which I am fixing in this PR. Remaining: merge those
changes, add AI logs for #12, and start #107, which I have not begun.

**What is one thing you learned about testing in your project?**

I learned that a passing test only matters if it can fail for the right reason. In #94 the API tests already returned
the correct 403 and 404, but the page still showed "Resource not found", because the bug was in the frontend, which had
no automated tests. I strengthened the API tests to check the error code and added tests for the page itself. I also
learned not to trust tests written by the same AI that wrote the fix, so I run them myself and break the code on purpose
to confirm each one fails.

**What is one risk to finishing your work by Nov 19, and what will you do about it?**

My main risk is time. Sprint 2 cleanup, including #96, the bug fixes, and AI logs, has taken most of my time, and I have not started #107, a high effort issue about managing server settings from the admin page. To handle this, I will finish and push the #96 work and stop adding cleanup. Then I will read #107, split it into smaller sub-issues as I did with #12, and have a teammate review the spec before coding, so at least one part is finished and tested by Nov 19. If time runs short, I will tell my team early and carry the remainder over.

**Link:** Code PR: https://github.com/CSCI-435-SE/outline/pull/118