## 2024-05-26 - Setting up testing in Next.js without babel issues
 **Learning:** Next.js has built-in support for Jest through `next/jest`, which handles transpilation. Installing separate babel tools (@babel/core, @babel/preset-env, babel-jest) and custom configurations (`babel.config.js`) will conflict with Next's build process and SWC compilation, leading to build errors with JSX parsing.
 **Action:** For Next.js projects, use `next/jest` inside `jest.config.js` and do not install separate babel configurations when just testing simple unit tests.
