Link to PR: https\://github.com/CSCI-435-SE/outline/pull/114 

What have you implemented so far, and what remains?

I’ve implemented the second part of the review workflow feature. There was a lot I had to move to part three as the PR was getting too big. However, I still made sure that we have a working feature we will be able to demo by the end of sprint 3\. Now, I have to implement the “scan document content with credentials on update” feature. This will definitely be a much smaller feature as Mustafa’s credential pattern library was merged earlier this sprint. It did have bugs… which needed to be fixed before merging before anyone could work on the issues that depended on that library.

What is one thing you learned about testing in your project?

The AI makes mistakes… huge ones. Like putting something in the entirely wrong spot huge. I manually tested how the review workflow would go with two different users logged in at once, and there were many aspects of the feature missing despite the AI telling me everything was fine. Good thing I tested it… because otherwise the feature would be unusable. Manual testing also allowed me to see how the UI would actually look in the workflow, which led me to change a lot of it so that it was intuitive for a human to understand.

What is one risk to finishing your work by Nov 19, and what will you do about it?

My second PR depends on the credential pattern library that was merged with bugs… while some were fixed (I had to ask my teammate to fix it…) there is probably some remaining tech debt. I will make sure that feature is reliable first before implementing my feature, which shouldn’t add too many lines of code since I suspect my feature won’t be too big.