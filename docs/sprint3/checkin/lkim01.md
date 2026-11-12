1. What have you implemented so far, and what remains?

I implemented Part 3 of the slideshow feature (#113). Selecting a slideshow now shows a strip of thumbnails where editors can reorder, remove, and add images by upload or by link, and each change is one undo step. Readers get dot indicators and previous/next arrows. Auto-advance pauses on hover, on focus, or when the slideshow is off-screen, and stops entirely with reduced motion. I also fixed uploaded slideshow images not loading on public share links, and made printing show every image. Automated tests are written and passing. What remains is the manual cross-view checks (two-browser collaboration, the public link, read-only, print), then review and merge.

2. What is one thing you learned about testing in your project?

I learned that the expected value has to come from the acceptance criteria, not from what the code returns. When a test failed, it was tempting to paste the actual output in as the new expected value. I could only check whether the test or the code was wrong by going back to the AC. I also learned where unit tests stop. Real-time sync, print layout and reduced-motion animation depend on a live collaboration server or CSS that the test environment doesn't render, so they need a written manual checklist instead. Keeping the list-editing and index logic in small pure functions made the rest easy to test.

3. What is one risk to finishing your work by Nov 19, and what will you do about it?

The biggest risk is that the manual cross-view checks find bugs late. Collaboration, public share links and clicking buttons inside the editor haven't been tested in a real browser, and a problem there could take several days to fix. To reduce that, I'll run the full manual checklist by Nov 14, so there is time to fix anything before the deadline. I'll ask a teammate to be the second user for the two-browser collaboration test and to review the PR early. If a minor issue can't be fixed in time, I'll document it as tech debt in the PR rather than delay the merge.

**PR:** [Feat: slideshow image editing and playback controls, part 3 of 3 (#113)](https://github.com/CSCI-435-SE/outline/pull/116)
