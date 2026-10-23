{\rtf1\ansi\ansicpg1252\cocoartf2761
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fnil\fcharset0 HelveticaNeue;\f1\froman\fcharset0 Times-Roman;}
{\colortbl;\red255\green255\blue255;\red0\green0\blue0;\red255\green255\blue255;\red0\green0\blue0;
}
{\*\expandedcolortbl;;\cssrgb\c0\c0\c0\c87059;\cssrgb\c100000\c100000\c100000;\cssrgb\c0\c0\c0;
}
{\*\listtable{\list\listtemplateid1\listhybrid{\listlevel\levelnfc0\levelnfcn0\leveljc0\leveljcn0\levelfollow0\levelstartat1\levelspace360\levelindent0{\*\levelmarker \{decimal\}}{\leveltext\leveltemplateid1\'01\'00;}{\levelnumbers\'01;}\fi-360\li720\lin720 }{\listname ;}\listid1}
{\list\listtemplateid2\listhybrid{\listlevel\levelnfc0\levelnfcn0\leveljc0\leveljcn0\levelfollow0\levelstartat1\levelspace360\levelindent0{\*\levelmarker \{decimal\}}{\leveltext\leveltemplateid101\'01\'00;}{\levelnumbers\'01;}\fi-360\li720\lin720 }{\listname ;}\listid2}
{\list\listtemplateid3\listhybrid{\listlevel\levelnfc0\levelnfcn0\leveljc0\leveljcn0\levelfollow0\levelstartat1\levelspace360\levelindent0{\*\levelmarker \{decimal\}}{\leveltext\leveltemplateid201\'01\'00;}{\levelnumbers\'01;}\fi-360\li720\lin720 }{\listname ;}\listid3}}
{\*\listoverridetable{\listoverride\listid1\listoverridecount0\ls1}{\listoverride\listid2\listoverridecount0\ls2}{\listoverride\listid3\listoverridecount0\ls3}}
\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\deftab720
\pard\tx220\tx720\pardeftab720\li720\fi-720\sa160\partightenfactor0
\ls1\ilvl0
\f0\fs32 \cf2 \cb3 {\listtext	1	}\expnd0\expndtw0\kerning0
What did you implement so far in the sprint, and what remains?\
\pard\tx720\pardeftab720\sa160\partightenfactor0
\cf2 \cb1 \
\pard\pardeftab720\sa240\partightenfactor0
\cf0 \outl0\strokewidth0 \strokec4 I have not implemented anything so far in the sprint. I still have to decide which issues I am going to pick. The main ones I am considering are Configurable staleness threshold per workspace (#62) and Retroactively scan existing documents for credentials (#66). I believe these additions are both medium-effort tasks that will be beneficial for document customization and security efficiency.\
Before starting, I want to look more closely at both issues and understand what changes would be needed to implement them. I also want to make sure I understand the requirements so that I do not run into unnecessary problems during development. Once I decide which issue to work on, I will need to explore the existing codebase and figure out how the new feature would fit into the current implementation.\
After that, I will focus on implementing the feature and making sure it works as expected. I will also need to test my changes and check for any errors before submitting them.\cf2 \outl0\strokewidth0 \
\pard\tx720\pardeftab720\sa160\partightenfactor0
\cf2 \
\pard\tx220\tx720\pardeftab720\li720\fi-720\sa160\partightenfactor0
\ls2\ilvl0\cf2 \cb3 \kerning1\expnd0\expndtw0 2		\expnd0\expndtw0\kerning0
What is one thing you learned about the codebase or about software engineering practice?\
\pard\tx720\pardeftab720\sa160\partightenfactor0
\cf2 \cb1 \
\pard\pardeftab720\sa240\partightenfactor0
\cf0 \outl0\strokewidth0 \strokec4 I learned about the importance of requirements engineering and breaking it down into steps. Although there are no stakeholders directly involved in this project, the class professor and TA play a similar role by providing expectations and clarifying what needs to be done. Checking and reviewing project expectations through both the sprint requirements website and Zulip will allow for better engineering planning and management practices.\
I think it is important to understand what is expected before starting to implement a feature instead of trying to figure everything out along the way. Having a clear idea of the requirements makes it easier to decide what needs to be done and how to approach the work. It can also help prevent mistakes that could have been avoided by reviewing the instructions earlier.\
Moving forward, I want to make sure I spend more time reviewing the requirements before choosing an issue and starting development. I also want to keep checking for updates or clarifications throughout the sprint, since requirements can sometimes be easier to understand after looking at the codebase. Overall, I think having a better understanding of the requirements will help me plan my work and complete tasks more efficiently.
\f1\fs24 \
\pard\tx720\pardeftab720\sa160\partightenfactor0

\f0\fs32 \cf2 \outl0\strokewidth0 \
\
\pard\tx220\tx720\pardeftab720\li720\fi-720\partightenfactor0
\ls3\ilvl0\cf2 \cb3 \kerning1\expnd0\expndtw0 3		\expnd0\expndtw0\kerning0
What is one thing you would do differently?\
\pard\tx720\pardeftab720\partightenfactor0
\cf2 \
\pard\pardeftab720\sa240\partightenfactor0
\cf0 \cb1 \outl0\strokewidth0 \strokec4 I am going to do more manual testing during this sprint. This is because in the last sprint I ran into merge-blocking errors due to a lack of manual testing. I will still use Claude to help with tests, but I also want to make sure I am manually testing my changes before considering a feature complete.\
Instead of moving on when a new feature seems to be working on the surface, I will manually do a deeper dive to look for possible bugs and errors that might otherwise be missed. I want to test different situations and make sure the feature works as expected, rather than only checking whether the main functionality works. I also want to make sure my changes do not cause problems with other parts of the project.\
I think spending more time testing during development will save time later because it will allow me to catch problems before they become bigger issues. The errors I ran into last sprint showed me that getting a feature to work is only part of the process. Making sure it works correctly is just as important. By improving my testing process, I hope to avoid similar problems and make merging my changes easier this sprint.
\f1\fs24 \
}