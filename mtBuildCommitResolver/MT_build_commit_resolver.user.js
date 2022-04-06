// ==UserScript==
// @name         MT build commit resolver
// @description  Adds a link and an iframe opening that link into the latest build in MT about/build page
// @author       Uygar Gumus (uygargumus@microsoft.com)
// @match        https://teams.microsoft.com/api/mt/part/*/about/build
// @match        https://teams.microsoft.com/api/mt/*/about/build
// @match        https://middletier.dod.teams.microsoft.us/about/build
// @match        https://middletier.gov.teams.microsoft.us/about/build
// @match        https://teams.live.com/api/mt/adhoc/shadow/*/about/build
// @require      https://ajax.googleapis.com/ajax/libs/jquery/2.1.0/jquery.min.js
// @grant        GM_addStyle
// ==/UserScript==
/* global $ */
/* eslint-disable no-multi-spaces, curly */
(function() {
    'use strict';
    const url = "https://domoreexp.visualstudio.com/Teamspace/_git/Teamspace-MiddleTier/commit";
    const wikiPage = "https://domoreexp.visualstudio.com/Teamspace/_wiki/wikis/Teamspace.wiki/2655/Determine-which-MT-build-is-running-where"

    const jsonString = $('pre')[0].innerHTML;
    const jsonObj  = $.parseJSON (jsonString);
    const commitHash = jsonObj.commitHash;
    const targetUrl = `${url}/${commitHash}`;

    const linkDiv  = $( `
        <div id="commitLink">
           Please use this <a style="text-decoration: underline;" href="${targetUrl}" target="_blank">link</a> to access the commit.
           <br/>
           For other environments, see: <a style="text-decoration: underline;" href="${wikiPage}" target="_blank">Determine which MT build is running where </a> wiki page.
        </div>`
    );
    linkDiv.appendTo('body');

    const iframe = $(`<iframe src="${targetUrl}" frameborder="0" scrolling="yes" style="overflow:hidden;
               height:800px; width:100%;
               height="100%" width="100%"></iframe>`);
    iframe.appendTo('body');

    GM_addStyle ( `
    #commitLink {
        color: white;
        background: #6264A7;
        padding: 2ex 1.3ex;
        border: 1px double gray;
        border-radius: 1ex;
        margin-top: 2ex;
    }`
    );
})();