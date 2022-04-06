// ==UserScript==
// @name         Move to current iteration
// @version      1.1
// @description  Adds buttons to update the completed work in the work items
// @author       Uygar Gumus (uygargumus@microsoft.com)
// @match        https://*.visualstudio.com/*/_sprints/taskboard/*
// @require      https://openuserjs.org/src/libs/sizzle/GM_config.js
// @updateURL    https://github.com/uygargumus/gm_scripts/raw/mainline/move-to-current-sprint/move-to-current-sprint.user.js
// @downloadURL  https://github.com/uygargumus/gm_scripts/raw/mainline/move-to-current-sprint/move-to-current-sprint.user.js
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function () {
  "use strict";
  const pattern =
    /(?<scheme>http|https|ftp|sftp|sip|sips|file):\/\/(?:(?<username>[^`!@#$^&*()+=,:;'"{}\|\[\]\s\/\\]+)(?::(?<password>[^`!@#$^&*()+=,:;'"{}\|\[\]\s\/\\]+))?@)?(?:(?<ipv4>((?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)))|\[(?<ipv6>(?:(?:[0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|(?:[\da-f]{1,4}:){1,7}:|(?:[\da-f]{1,4}:){1,6}:[\da-f]{1,4}|(?:[\da-f]{1,4}:){1,5}(?::[\da-f]{1,4}){1,2}|(?:[\da-f]{1,4}:){1,4}(?::[\da-f]{1,4}){1,3}|(?:[\da-f]{1,4}:){1,3}(?::[\da-f]{1,4}){1,4}|(?:[\da-f]{1,4}:){1,2}(?::[\da-f]{1,4}){1,5}|[\da-f]{1,4}:(?:(?::[\da-f]{1,4}){1,6})|:(?:(?::[\da-f]{1,4}){1,7}|:)|fe80:(?::[\da-f]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(?:ffff(?::0{1,4}){0,1}:){0,1}(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)|(?:[\da-f]{1,4}:){1,4}:(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)))\]|(?:(?<sub_domain>[^\s~`!@#$%^&*()_+=,.?:;'"{}\|\[\]\/\\]+\.)*(?<domain>[^\s~`!@#$%^&*()_+=,.?:;'"{}\|\[\]\/\\]+)(?<tld>\.[^\s~`!@#$%^&*()\-_+=,.?:;'"{}\|\[\]\/\\0-9]{2,})))+(?<port>:\d+)?(?:\/(?<path>\/?[^\s`@#$^&=.?"{}\\]+\/)*(?<file>[^\s`@#$^&=?"{}\/\\]+)?(?<query>\?[^\s`#$^"{}\/\\]+)*(?<fragment>#[^\s`$^&=?"{}\/\\]+)?)?/;

  String.prototype.matchWithGroups = function (pattern) {
    var matches = this.match(pattern);
    return (
      pattern
        // get the pattern as a string
        .toString()
        // suss out the groups
        .match(/<(.+?)>/g)
        // remove the braces
        .map(function (group) {
          return group.match(/<(.+)>/)[1];
        })
        // create an object with a property for each group having the group's match as the value
        .reduce(function (acc, curr, index, arr) {
          acc[curr] = matches[index + 1];
          return acc;
        }, {})
    );
  };

  GM_config.init({
    id: "MyMVTConfig",
    fields: {
      pat: {
        label: "PAT (Personal access token)",
        type: "text",
        default: "",
      },
    },
  });

  GM_registerMenuCommand("Setting", () => {
    GM_config.open();
  });

  window.addEventListener(
    "load",
    function () {
      const urlGroups = window.location.href.matchWithGroups(pattern);

      const path = urlGroups.file.split("/");
      const organization = urlGroups.domain.slice(0, -1);
      const projectName = path[0];
      const teamName = path[3];

      const patToken = GM_config.get("pat");
      const authToken = btoa(unescape(encodeURIComponent(`:${patToken}`)));

      function moveItemToIteration(item, path) {
        const id = item.id;
        const state = item.fields["System.State"];
        if (state == "Closed" || state == "Resolved") {
          console.log(`${id} is in ${state}. skipping`);
          return;
        }

        if (item.fields["System.IterationPath"] == path) {
          console.log(`${id} is in ${path} already. skipping`);
          return;
        }

        var myHeaders = new Headers();
        myHeaders.append("Content-Type", "application/json-patch+json");
        myHeaders.append("Authorization", `Basic ${authToken}`);

        var request = JSON.stringify([
          {
            op: "add",
            path: "/fields/System.IterationPath",
            value: path,
          },
        ]);

        var requestOptions = {
          method: "PATCH",
          headers: myHeaders,
          body: request,
          redirect: "follow",
        };

        fetch(
          `https://dev.azure.com/${organization}/${projectName}/_apis/wit/workitems/${id}?api-version=6.0`,
          requestOptions
        ).catch((error) => console.error("error", error));
      }

      function moveToIteration(id, path) {
        console.log(`Moving ${id} to ${path}`);
        var myHeaders = new Headers();
        myHeaders.append("Authorization", `Basic ${authToken}`);

        var requestOptions = {
          method: "GET",
          headers: myHeaders,
          redirect: "follow",
        };

        fetch(
          `https://dev.azure.com/${organization}/${projectName}/_apis/wit/workitems/${id}?api-version=6.0`,
          requestOptions
        )
          .then((response) => response.json())
          .then((workItem) => moveItemToIteration(workItem, path))
          .catch((error) => console.log("error", error));
      }

      function moveAllToIteration(path) {
        $("div.tbTile").each(function () {
          const item = $(this);
          const id = item.attr("id").split("-")[1];
          moveToIteration(id, path);
        });
      }

      function moveAllToCurrentSprint() {
        var myHeaders = new Headers();
        myHeaders.append("Authorization", `Basic ${authToken}`);

        var requestOptions = {
          method: "GET",
          headers: myHeaders,
          redirect: "follow",
        };

        fetch(
          `https://dev.azure.com/${organization}/${projectName}/${teamName}/_apis/work/teamsettings/iterations?$timeframe=current&api-version=6.0`,
          requestOptions
        )
          .then((response) => response.json())
          .then((iterations) => iterations.value[0])
          .then((iteraton) => iteraton.path)
          .then((path) => moveAllToIteration(path))
          .catch((error) => console.log("error", error));
      }

      var button = $("<input/>").attr({
        type: "button",
        value: `Move open items to the current sprint`,
      });

      button.click(moveAllToCurrentSprint);

      $("div.ms-CommandBar-primaryCommands").append(button);
    },
    false
  );
})();

