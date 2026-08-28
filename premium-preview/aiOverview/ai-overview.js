// src/core/premiumViews/aiOverview/ai-overview.js

const elements = {
  backButton: document.getElementById("backButton"),
  retryButton: document.getElementById("retryButton"),

  professorName: document.getElementById("professorName"),
  professorDepartment: document.getElementById("professorDepartment"),
  rmpLink: document.getElementById("rmpLink"),

  loadingState: document.getElementById("loadingState"),
  errorState: document.getElementById("errorState"),
  errorMessage: document.getElementById("errorMessage"),
  summaryView: document.getElementById("summaryView"),

  overviewText: document.getElementById("overviewText"),
  sentimentBadge: document.getElementById("sentimentBadge"),
  verdictText: document.getElementById("verdictText"),
  examStyleText: document.getElementById("examStyleText"),

  prosList: document.getElementById("prosList"),
  consList: document.getElementById("consList"),
  takeawaysList: document.getElementById("takeawaysList"),

  reviewCount: document.getElementById("reviewCount"),
};

/*
 * Replace this sample object with the professor data passed from
 * your existing professor popup.
 */
const params = new URLSearchParams(window.location.search);
const PREVIEW = params.get("preview") === "1";
const PREVIEW_SUMMARY = Object.freeze({
  response: {
    overview: "Professor Ramirez is known for clear explanations, practical coding examples, and organized lectures. Students say the weekly projects take time, but prepare them well for application-based exams.",
    sentimentScore: 91,
    verdict: "Strongly Recommended",
    examStyle: "Projects, coding exams",
    pros: ["Explains complex topics clearly", "Provides useful practice material", "Returns detailed feedback quickly"],
    cons: ["Weekly projects require planning", "Attendance is important", "Exams emphasize application"],
    studentTakeaways: ["Start projects early and ask questions during office hours.", "Her examples closely match the skills used on assignments.", "Review the practice problems before each exam."],
  },
  reviewCount: 126,
});
const professor = {
  school: params.get("school") || "",
  name: params.get("name") || "Unknown professor",
  department: params.get("department") || "Department unavailable",
  initials: params.get("initials") || "?",
  rankText: params.get("rankText") || "Ranking coming soon",
  rmpUrl: params.get("rmpUrl") || "#",
};

function requestSummary() {
  if (PREVIEW) return Promise.resolve(PREVIEW_SUMMARY);

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        action: "GET_AI_SUMMARY",
        school: professor.school,
        professorName: professor.name,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (!response?.success) {
          reject(new Error(response?.error || "Unable to load AI overview."));
          return;
        }

        resolve(response);
      },
    );
  });
}

function showLoading() {
  elements.loadingState.classList.remove("hidden");
  elements.errorState.classList.add("hidden");
  elements.summaryView.classList.add("hidden");
}

function showError(message) {
  elements.loadingState.classList.add("hidden");
  elements.summaryView.classList.add("hidden");
  elements.errorState.classList.remove("hidden");

  elements.errorMessage.textContent =
    message || "The summary could not be loaded.";
}

function showSummary() {
  elements.loadingState.classList.add("hidden");
  elements.errorState.classList.add("hidden");
  elements.summaryView.classList.remove("hidden");
}

/*
 * Safely rebuilds a list using DOM nodes.
 * This avoids inserting API text through innerHTML.
 */
function renderList(listElement, items) {
  listElement.replaceChildren();

  for (const item of items) {
    const listItem = document.createElement("li");
    listItem.textContent = item;
    listElement.appendChild(listItem);
  }
}

function renderProfessorHeader() {
  elements.professorName.textContent = professor.name;
  elements.professorDepartment.textContent = professor.department;
  elements.rmpLink.href = professor.rmpUrl;
  elements.rmpLink.classList.toggle("hidden", PREVIEW || professor.rmpUrl === "#");

  document.querySelector(".professor-avatar").textContent = professor.initials;

  document.querySelector(".professor-rank").textContent = professor.rankText;
}

function renderSummary(data) {
  const summary = data.response;

  elements.overviewText.textContent =
    summary.overview ?? summary.tldrSummary ?? "No summary was returned.";

  elements.sentimentBadge.textContent = `${summary.sentimentScore ?? 0}% positive`;

  elements.verdictText.textContent = summary.verdict ?? "No verdict available";

  elements.examStyleText.textContent = summary.examStyle ?? "Not mentioned";

  renderList(elements.prosList, summary.pros ?? summary.topPros ?? []);

  renderList(elements.consList, summary.cons ?? summary.topCons ?? []);

  renderList(
    elements.takeawaysList,
    summary.studentTakeaways ?? summary.studentQuotes ?? [],
  );

  const count = data.reviewCount;

  elements.reviewCount.textContent = Number.isFinite(count)
    ? `Based on ${count} written reviews`
    : data.cached
      ? "Loaded from cached review data"
      : "Based on written reviews";

  if (PREVIEW) elements.reviewCount.textContent += " · Demo data";

  showSummary();
}

async function loadProfessorSummary() {
  showLoading();

  try {
    const data = await requestSummary();

    if (!data?.response) {
      throw new Error("The server returned an invalid summary.");
    }

    renderSummary(data);
  } catch (error) {
    console.error("AI summary error:", error);
    showError(error.message);
  }
}

elements.backButton.addEventListener("click", () => {
  window.parent.postMessage({ type: "BRONCOSORT_PREMIUM_VIEW_BACK" }, "*");
});

elements.retryButton.addEventListener("click", () => {
  loadProfessorSummary();
});

renderProfessorHeader();
loadProfessorSummary();
