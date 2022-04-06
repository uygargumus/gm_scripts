## About
This script adds a link and an iframe opening that links into the latest build in MT about/build page. See [Determine which MT build is running where](https://domoreexp.visualstudio.com/Teamspace/_wiki/wikis/Teamspace.wiki/2655/Determine-which-MT-build-is-running-where) for details

## Setup steps:
1. Install Tampermonkey extension into your browser.
1. Go to the Tampermonkey dashboard and create a new script and copy paste the content of the  ``MT_build_commit_resolver.user.js`` file.
1. Save the new script and make sure that it is enabled.
1. Navigate to https://teams.microsoft.com/api/mt/part/dogfood/about/build and verify that a link and iframe exist.

## Notes
1. This relies on how browsers render json content. Chromium based browsers add the json content in a `<pre>` tag. So, the script relies on this tag for parsing the Json content. 
    * This is tested in Microsoft Edge and Google Chrome browsers. It may not work in other non-Chromium based browsers.
