// ==UserScript==
// @name         Completed work buttons
// @version      1.2
// @description  Adds buttons to update the completed work in the work items
// @author       Uygar Gumus (uygargumus@microsoft.com)
// @match        https://*.visualstudio.com/*/_sprints/taskboard/*
// @require      https://openuserjs.org/src/libs/sizzle/GM_config.js
// @updateURL    https://github.com/uygargumus/gm_scripts/raw/mainline/azure-workitem-buttons/azure-workitem-button.user.js
// @downloadURL  https://github.com/uygargumus/gm_scripts/raw/mainline/azure-workitem-buttons/azure-workitem-button.user.js
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
    id: "WorkItemsConfig",
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

      const patToken = GM_config.get("pat");
      const authToken = btoa(unescape(encodeURIComponent(`:${patToken}`)));

      function addButtons(item, id) {
        console.log(`adding new buttons for ${id}`);
        item.append(createButton(id, 0.25));
        item.append(createButton(id, 0.5));
        item.append(createButton(id, 1));
      }

      function updateCompletedWork(id, completed) {
        console.log(`New completed days for ${id} is ${completed}`);
        if (completed < 0) {
          console.warn(
            `Can not set negative completed work for ${id} Requested: ${completed} setting 0`
          );
          completed = 0;
        }

        var myHeaders = new Headers();
        myHeaders.append("Content-Type", "application/json-patch+json");
        myHeaders.append("Authorization", `Basic ${authToken}`);

        var request = JSON.stringify([
          {
            op: "add",
            path: "/fields/Microsoft.VSTS.Scheduling.CompletedWork",
            value: completed,
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

      function addCompletedWork(id, completed) {
        console.log(`Adding ${completed} days to ${id}`);
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
          .then(
            (workItem) =>
              workItem.fields["Microsoft.VSTS.Scheduling.CompletedWork"]
          )
          .then((completedWork) => completedWork ?? 0)
          .then((completedWork) => completedWork + completed)
          .then((completedWork) => updateCompletedWork(id, completedWork))
          .catch((error) => console.log("error", error));
      }

      function createButton(id, completed) {
        var button = $("<input/>").attr({
          id: `button_${id}_${completed}`,
          type: "button",
          value: `${completed}`,
        });
        button.click(function () {
          addCompletedWork(id, completed);
        });
        button.contextmenu(function () {
          addCompletedWork(id, -completed);
        });
        return button;
      }

      var observeDOM = (function () {
        var MutationObserver =
          window.MutationObserver || window.WebKitMutationObserver;

        return function (obj, callback) {
          if (!obj || obj.nodeType !== 1) return;

          if (MutationObserver) {
            // define a new observer
            var mutationObserver = new MutationObserver(callback);

            // have the observer observe foo for changes in children
            mutationObserver.observe(obj, { childList: true, subtree: true });
            return mutationObserver;
          }

          // browser support fallback
          else if (window.addEventListener) {
            obj.addEventListener("DOMNodeInserted", callback, false);
            //obj.addEventListener('DOMNodeRemoved', callback, false)
          }
        };
      })();

      function onDomChanged(event) {
        event.forEach((record) =>
          record.addedNodes.forEach((node) => {
            if (node.tagName == "DIV" && node.id) {
              if (node.id.startsWith("tile-")) {
                const id = node.id.split("-")[1];
                console.log(`${node.tagName} - ${node.id}`);
                addButtons($(node), id);
              }
            }
          })
        );
      }

      const elem = document.querySelector("div");
      observeDOM(elem, onDomChanged);

      $("div.tbTile").each(function () {
        const item = $(this);
        const id = item.attr("id").split("-")[1];
        addButtons(item, id);
      });
    },
    false
  );
})();

