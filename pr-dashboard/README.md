## About

This creates a PR dashboard in https://domoreexp.visualstudio.com/prs page.

## Setup steps:

1. Install Tampermonkey extension into your browser.
1. Go to the Tampermonkey dashboard and create a new script and copy paste the content of the [pr-dashboard.user.js](// @downloadURL https://domoreexp.visualstudio.com/Teamspace/_apis/git/repositories/SkypeSpaces-Infra/Items?path=%2Ftools%2Ftampermonkey-scripts%2Fpr-dashboard%2Fpr-dashboard.user.js
   ) file.
1. Save the new script and make sure that it is enabled.
1. If you want to access to the PRs assigned to your team, generate a PAT token from the Azure Dev ops and set it in the settings based
1. Navigate to https://domoreexp.visualstudio.com/prs and verify that a link and iframe exist.

#### The Dashboard

![Screen Shot 2022-03-29 at 11.48.26 AM.png](https://domoreexp.visualstudio.com/11ac29bc-5a99-400b-b225-01839ab0c9df/_apis/git/repositories/211f66df-d239-4f48-a15c-d0ae7fbb2fa5/pullRequests/499968/attachments/Screen%20Shot%202022-03-29%20at%2011.48.26%20AM.png)

#### The settings page

![Screen Shot 2022-03-29 at 11.48.38 AM.png](https://domoreexp.visualstudio.com/11ac29bc-5a99-400b-b225-01839ab0c9df/_apis/git/repositories/211f66df-d239-4f48-a15c-d0ae7fbb2fa5/pullRequests/499968/attachments/Screen%20Shot%202022-03-29%20at%2011.48.38%20AM.png)
