// ==UserScript==
// @name         PR Dashboard
// @description  Create a PR Dashboard
// @author       Uygar Gumus (uygargumus@microsoft.com)
// @version      1.0
// @updateURL    https://domoreexp.visualstudio.com/Teamspace/_apis/git/repositories/SkypeSpaces-Infra/Items?path=%2Ftools%2Ftampermonkey-scripts%2Fpr-dashboard%2Fpr-dashboard.user.js
// @downloadURL  https://domoreexp.visualstudio.com/Teamspace/_apis/git/repositories/SkypeSpaces-Infra/Items?path=%2Ftools%2Ftampermonkey-scripts%2Fpr-dashboard%2Fpr-dashboard.user.js
// @match        https://domoreexp.visualstudio.com/prs
// @match        https://domoreexp.visualstudio.com/pr
// @require      https://ajax.googleapis.com/ajax/libs/jquery/2.1.0/jquery.min.js
// @require      https://openuserjs.org/src/libs/sizzle/GM_config.js
// @require      https://momentjs.com/downloads/moment.min.js
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// ==/UserScript==
/* global $ */
/* eslint-disable no-multi-spaces, curly */
(function () {
  "use strict";
  document.title = "PR Dashboard";
  $(".container").remove();
  GM_config.init({
    id: "MyPrsConfig",
    fields: {
      pat: {
        label: "PAT (Personal access token)",
        type: "text",
        default: "",
      },
      organization: {
        label: "Organization ",
        type: "text",
        default: "domoreexp",
      },
      project: {
        label: "Project ",
        type: "text",
        default: "Teamspace",
      },
      showPrsIReview: {
        label: "Show the PRs I need to review",
        type: "checkbox",
        default: true,
      },
      showPrsIApproved: {
        label: "Show the PRs I already approved",
        type: "checkbox",
        default: false,
      },
      showOthersDraft: {
        label: "Show the draft PRs assigned to me",
        type: "checkbox",
        default: true,
      },
      prSLA: {
        label: "SLA for PR review (in days)",
        type: "number",
        default: 3,
      },
    },
  });

  GM_registerMenuCommand("Setting", () => {
    GM_config.open();
  });

  const organization = GM_config.get("organization");
  const projectName = GM_config.get("project");
  const patToken = GM_config.get("pat");
  const authToken = btoa(unescape(encodeURIComponent(`:${patToken}`)));
  const showPrsIReview = GM_config.get("showPrsIReview");
  const showPrsIApproved = GM_config.get("showPrsIApproved");
  const showOthersDraft = GM_config.get("showOthersDraft");
  const baseUrl = `https://${organization}.visualstudio.com/${projectName}`;
  const slaDays = GM_config.get("prSLA");
  const processedPrs = new Set();

  const DateDiff = {
    inDays: function (d1, d2) {
      var t2 = d2.getTime();
      var t1 = d1.getTime();
      return parseInt((t2 - t1) / (24 * 3600 * 1000));
    },
  };

  const PRStatus = {
    None: 0,
    Reviewed: 5,
    Late: 10,
    Approved: 15,
  };

  function calAPI(url, process, sync) {
    const settings = {
      url: url,
      method: "GET",
      timeout: 0,
      async: sync != true,
      headers: {
        Authorization: `Basic ${authToken}`,
      },
    };

    var jqxhr = $.ajax(settings);
    jqxhr.done(process);
  }

  function getApprovalState(reviewer) {
    //Vote on a pull request:
    //10 - approved 5 - approved with suggestions 0 - no vote -5 - waiting for author -10 - rejected
    switch (reviewer.vote) {
      case 10:
        return $(`<span>✅</span>`);
      case 5:
        return $(`<span>🤓</span>`);
      case -5:
        return $(`<span>❓</span>`);
      case -10:
        return $(`<span>🚫</span>`);
    }
    if (reviewer.isRequired === true) {
      return $(`<span>🛂</span>`);
    }
    return $(`<span></span>`);
  }

  function getChatMessage(reviewer, prUrl) {
    //Vote on a pull request:
    //10 - approved 5 - approved with suggestions 0 - no vote -5 - waiting for author -10 - rejected
    const name = reviewer.displayName.split(" ")[0];
    switch (reviewer.vote) {
      case 10:
        return `Hello ${name}, thank you for approving ${prUrl}`;
      case 5:
        return `Hello ${name}, thank you for approving ${prUrl}. I am checking your suggestions and I will try to address them.`;
      case -5:
        return `Hello ${name}, thank you reviewing my PR ${prUrl}. I am checking your comments and I will try to address them.`;
      case -10:
        return `Hello ${name}, thank you reviewing my PR ${prUrl}. I am checking your comments and I will try to address them.`;
    }
    return `Hello ${name}, I wonder if do you have time for reviewing my PR ${prUrl}. Thanks a lot.`;
  }

  function didIApprove(pr, userId) {
    for (let reviewer of pr.reviewers) {
      if (reviewer.id == userId && reviewer.vote == 10) {
        return true;
      }
    }
    return false;
  }

  const PRStatusClasses = {
    5: "reviewed-pr",
    10: "late-pr",
    15: "approved-pr",
  };

  function setPrStatus(pr, status) {
    if (status > pr.__status) {
      pr.__status = status;
      if (PRStatusClasses[status]) {
        $(`#${pr.pullRequestId}_row`).addClass(PRStatusClasses[status]);
      }
    }
  }

  function processLastUpdateDate(pr) {
    const lastMergeCommit = pr.lastMergeSourceCommit ?? pr.lastMergeCommit;
    calAPI(lastMergeCommit.url, (commit) => {
      const lastUpdateDate = new Date(commit.push.date);
      const mmnt = moment(lastUpdateDate);
      $(`#${pr.pullRequestId}_lastUpdate`).append(
        $(`<span>${mmnt.format("l")}<br>(${mmnt.fromNow()})</span>`)
      );

      if (!pr.isDraft) {
        const dateDiff = DateDiff.inDays(lastUpdateDate, new Date());
        if (dateDiff >= slaDays) {
          setPrStatus(pr, PRStatus.Late);
        }
      }
    });
  }
  function processComments(pr, userId) {
    calAPI(
      `${baseUrl}/_apis/git/repositories/${pr.repository.id}/pullRequests/${pr.pullRequestId}/threads?api-version=6.0`,
      (threads) => {
        const myComments = {
          open: 0,
          total: 0,
        };
        const allComments = {
          open: 0,
          total: 0,
        };
        threads.value.forEach((thread) => {
          thread.comments.forEach((comment) => {
            const isActiveComment = thread.status == "active";
            if (comment.commentType == "text") {
              allComments.total++;
              allComments.open += isActiveComment ? 1 : 0;
              if (comment.author.id == userId) {
                myComments.total++;
                myComments.open += isActiveComment ? 1 : 0;
              }
            }
          });
        });
        if (!pr.__isMyPr && !pr.__approvedByMe) {
          if (myComments.total > 0) {
            $(`#${pr.pullRequestId}_title`).prepend(
              $(`<span>[REVIEWED] </span>`)
            );
            setPrStatus(pr, PRStatus.Reviewed);
          }
        }
        $(`#${pr.pullRequestId}_myComments`).append(
          $(`<span>${myComments.open}/${myComments.total}</span>`)
        );
        $(`#${pr.pullRequestId}_allComments`).append(
          $(`<span>${allComments.open}/${allComments.total}</span>`)
        );
      }
    );
  }

  function processWorkItems(pr) {
    calAPI(
      `${baseUrl}/_apis/git/repositories/${pr.repository.id}/pullRequests/${pr.pullRequestId}/workitems?api-version=6.0`,
      (workItems) => {
        if (workItems.count > 0) {
          const table = $(`<ul"></ul>`);
          $(`#${pr.pullRequestId}_workItems`).append(table);
          workItems.value.forEach((workItem) => {
            calAPI(workItem.url, (workItemDetails) => {
              table.append(
                $(`<li>
                             <a href="${workItemDetails._links.html.href}" target="_blank">${workItemDetails.id}: ${workItemDetails.fields["System.Title"]}</a>
                         </li>`)
              );
            });
          });
        }
      }
    );
  }

  function processPRDetails(pr, userId) {
    if (pr.isDraft) {
      $(`#${pr.pullRequestId}_row`).addClass("draft-pr");
    }
    if (pr.__approvedByMe) {
      $(`#${pr.pullRequestId}_title`).prepend($(`<span>[APPROVED] </span>`));
      setPrStatus(pr, PRStatus.Approved);
    }
    processLastUpdateDate(pr);
    processComments(pr, userId);
    processWorkItems(pr);
  }

  function processPR(pr, userId, bodyId, groupId) {
    const prId = pr.pullRequestId;
    if (processedPrs.has(prId)) {
      return;
    }
    processedPrs.add(prId);

    const isMyPr = pr.createdBy.id == userId;
    pr.__isMyPr = isMyPr;
    if (isMyPr && groupId) {
      //if this is my PR and we are displaying it while showing a group's PR, skip this
      return;
    }
    let approvedByMe = false;
    if (!isMyPr) {
      approvedByMe = didIApprove(pr, userId);
      if (approvedByMe && !showPrsIApproved) {
        return;
      }
    }
    pr.__approvedByMe = approvedByMe;
    pr.__status = PRStatus.None;

    pr.title = `${prId}: ${pr.title}`;
    if (pr.isDraft) {
      if (!isMyPr && !showOthersDraft) {
        return;
      }
      pr.title = `[DRAFT] ${pr.title}`;
    }

    const repoUrl = `${baseUrl}/_git/${pr.repository.name}`;
    const prUrl = `${repoUrl}/pullrequest/${prId}`;
    const creationDate = moment(pr.creationDate);

    const row = $(`<tr id="${prId}_row"">
                            <td><a href="${repoUrl}" target="_blank">${
      pr.repository.name
    }</a></td>
                            <td><a id="${prId}_title" href="${prUrl}" target="_blank">${
      pr.title
    }</a></td>
                            <td><a href="sip:${
                              pr.createdBy.uniqueName
                            }"><span>${
      pr.createdBy.displayName.split(" ")[0]
    }</span><img src="${
      pr.createdBy.imageUrl
    }"  width="30" height="30"></a></td>
                            <td id="${prId}_reviewers"></td>
                            <td><span>${creationDate.format(
                              "l"
                            )}<br>(${creationDate.fromNow()})</span></td>
                            <td id="${prId}_lastUpdate"></td>
                            <td id="${prId}_myComments"></td>
                            <td id="${prId}_allComments"></td>
                            <td id="${prId}_workItems"></td>

                        </tr>`);
    $(`#${bodyId}`).append(row);

    const reviwers = $(`#${pr.pullRequestId}_reviewers`);
    const reviewersTable = $(`<table class="reviwer-table"></table>`);
    const humans = $(`<tr></tr>`);
    const groups = $(`<tr></tr>`);
    reviwers.append(reviewersTable);
    reviewersTable.append(humans);
    reviewersTable.append(groups);

    pr.reviewers.forEach((reviewer) => {
      const rth = $(`<th></th>`);
      const image = $(
        `<div class="img-reviewer"><img src="${reviewer._links.avatar.href}" title="${reviewer.displayName}"  width="30" height="30"></div>`
      );
      image.append(getApprovalState(reviewer));

      if (reviewer.isContainer) {
        rth.append(image);
        groups.append(rth);
      } else {
        if (isMyPr) {
          const sipLink = $(
            `<a  target="_blank" href="https://teams.microsoft.com/l/chat/0/0?users=${
              reviewer.uniqueName
            }&message=${getChatMessage(reviewer, prUrl)}"></a>`
          );
          sipLink.append(image);
          rth.append(sipLink);
        } else {
          rth.append(image);
        }
        humans.append(rth);
      }
    });
    processPRDetails(pr, userId);
  }

  function getPrs(url, userId, bodyId, groupId) {
    calAPI(url, (response) => {
      if (response.count > 0) {
        response.value.forEach((pr) => {
          processPR(pr, userId, bodyId, groupId);
        });
      }
    });
  }

  function getMyPrs(packageName, userId, bodyId) {
    const url = `${baseUrl}/_apis/git/repositories/${packageName}/pullrequests?api-version=6.0&searchCriteria.creatorId=${userId}`;
    getPrs(url, userId, bodyId);
  }

  function getPrsForMe(packageName, userId, bodyId) {
    const url = `${baseUrl}/_apis/git/repositories/${packageName}/pullrequests?api-version=6.0&searchCriteria.reviewerId=${userId}`;
    getPrs(url, userId, bodyId);
  }

  function getPrsForMyGroup(packageName, userId, groupId, bodyId) {
    const url = `${baseUrl}/_apis/git/repositories/${packageName}/pullrequests?api-version=6.0&searchCriteria.reviewerId=${groupId}`;
    getPrs(url, userId, bodyId, groupId);
  }

  function createPrTable(bodyId, title) {
    const div = $(`<div>
        <h2>${title}</h2>
        <table class="styled-table">
        <thead>
          <tr>
            <th>Repository</th>
            <th>Title</th>
            <th>Author</th>
            <th>Reviewers</th>
            <th>Created</th>
            <th>Updated</th>
            <th style="width:30px">My Comments (active/total)</th>
            <th style="width:30px">All Comments (active/total)</th>
            <th style="width:200px">Work Items</th>
          </tr>
        </thead>
        <tbody id="${bodyId}">
        </tbody>
      </table>
       </div>`);

    div.appendTo("body");
  }

  function renderPRsTable() {
    const idForMyPrs = "__myPrs";
    const idForPrstoMe = "__prsToMe";

    createPrTable(idForMyPrs, "Created by me");
    if (showPrsIReview) {
      createPrTable(idForPrstoMe, "Assigned to me or my teams");
    }

    calAPI(
      `${baseUrl}/_apis/git/repositories?api-version=4.1`,
      (response, textStatus, jqXHR) => {
        const userdata = jqXHR.getResponseHeader("X-VSS-UserData");
        if (userdata) {
          const userId = userdata.split(":")[0];
          const repositories = response.value;
          repositories.forEach((repo) => {
            if (!repo.isDisabled) {
              getMyPrs(repo.name, userId, idForMyPrs);
              if (showPrsIReview) {
                getPrsForMe(repo.name, userId, idForPrstoMe);
              }
            }
          });
          if (showPrsIReview) {
            calAPI(
              `https://vssps.dev.azure.com/${organization}/_apis/identities?identityIds=${userId}&queryMembership=None&api-version=6.1-preview.1`,
              (response) => {
                const subjectDescriptor = response.value[0].subjectDescriptor;
                calAPI(
                  `https://vssps.dev.azure.com/${organization}/_apis/Graph/Memberships/${subjectDescriptor}`,
                  (response) => {
                    response.value.forEach((membership) => {
                      calAPI(membership._links.container.href, (response) => {
                        repositories.forEach((repo) => {
                          if (!repo.isDisabled) {
                            getPrsForMyGroup(
                              repo.id,
                              userId,
                              response.originId,
                              idForPrstoMe
                            );
                          }
                        });
                      });
                    });
                  }
                );
              }
            );
          }
        } else {
          console.error("Unabe to get user id");
        }
      }
    );
  }

  renderPRsTable();

  GM_addStyle(`
        table, th, td {
            border: 1px solid #dddddd;
        }

		th,
		h2,
		h3 {
		  text-align: center;
		}

		a {
		  text-decoration: none;
       }

       .late-pr {
            color: red;
            font-weight: bold;
       }

       .draft-pr {
            color: gray;
            font-style: italic;
       }

       .approved-pr {
            color: green;
       }

        .reviewed-pr {
            color: orange !important;
       }

        .reviwer-table {
            border: 0px solid black;
        }

        .reviwer-table th,
        .reviwer-table td{
            border: 0px solid black;
            padding: 0px 0px;
        }

       .styled-table {
        	width: 100%;
			border-collapse: collapse;
			margin-left: auto;
			margin-right: auto;
			font-size: 0.9em;
			font-family: sans-serif;
			min-width: 400px;
			box-shadow: 0 0 20px rgba(0, 0, 0, 0.15);
		}

    	.styled-table thead tr {
		    background-color: #009879;
		    color: #ffffff;
		    text-align: left;
		}

		.styled-table tbody tr {
		    border-bottom: 1px solid #dddddd;
		}

		.styled-table tbody tr:nth-of-type(even) {
		    background-color: #f3f3f3;
		}

		.styled-table tbody tr:last-of-type {
		    border-bottom: 2px solid #009879;
		}

        .styled-table th,
        .styled-table td {
            padding: 2px 3px;
        }

        .img-reviewer {
            position: relative;
        }

        .img-reviewer > span {
            font-size: 0.9em;
            position: absolute;
            bottom: 0;
            left: 0;
        }
`);
})();
