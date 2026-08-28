// src/core/premiumViews/gradeDistribution/grade-distribution.js

const elements = {
  backButton: document.getElementById("backButton"),
  retryButton: document.getElementById("retryButton"),
  professorInitials: document.getElementById("professorInitials"),
  professorName: document.getElementById("professorName"),
  professorDepartment: document.getElementById("professorDepartment"),
  professorRank: document.getElementById("professorRank"),
  rmpLink: document.getElementById("rmpLink"),
  loadingState: document.getElementById("loadingState"),
  errorState: document.getElementById("errorState"),
  errorMessage: document.getElementById("errorMessage"),
  gradeView: document.getElementById("gradeView"),
  classScopeButton: document.getElementById("classScopeButton"),
  professorScopeButton: document.getElementById("professorScopeButton"),
  professorOverallGpa: document.getElementById("professorOverallGpa"),
  professorCourseLabel: document.getElementById("professorCourseLabel"),
  professorCourseGpa: document.getElementById("professorCourseGpa"),
  courseOverallLabel: document.getElementById("courseOverallLabel"),
  courseOverallGpa: document.getElementById("courseOverallGpa"),
  classContextMessage: document.getElementById("classContextMessage"),
  distributionSubtitle: document.getElementById("distributionSubtitle"),
  gradeChart: document.getElementById("gradeChart"),
  totalStudents: document.getElementById("totalStudents"),
  sectionCount: document.getElementById("sectionCount"),
  trendSvg: document.getElementById("trendSvg"),
  trendAxes: document.getElementById("trendAxes"),
  trendArea: document.getElementById("trendArea"),
  trendLine: document.getElementById("trendLine"),
  trendPoints: document.getElementById("trendPoints"),
  trendLabels: document.getElementById("trendLabels"),
  trendEmptyMessage: document.getElementById("trendEmptyMessage"),
  dataStatusText: document.getElementById("dataStatusText"),
  infoButton: document.getElementById("infoButton"),
  infoDialog: document.getElementById("infoDialog"),
  closeInfoButton: document.getElementById("closeInfoButton"),
};

const params = new URLSearchParams(window.location.search);
const DEBUG = params.get("debug") === "1";
const PREVIEW = params.get("preview") === "1";
const professor = {
  name: params.get("name") || "Unknown professor",
  department: params.get("department") || "Department unavailable",
  initials: params.get("initials") || "?",
  rankText: params.get("rankText") || "Ranking coming soon",
  rmpUrl: params.get("rmpUrl") || "#",
};
const currentCourseId = normalizeCourseId(params.get("courseId"));
let gradeScope = "class";
let professorGradeData = null;
let courseGradeData = null;

const PREVIEW_PROFESSOR_GRADES = Object.freeze({
  average_gpa: 3.42,
  total_students: 684,
  sections_taught: 28,
  grade_counts: { A: 274, "A-": 82, "B+": 91, B: 109, "B-": 42, "C+": 31, C: 29, "C-": 8, "D+": 4, D: 5, "D-": 1, F: 8 },
  history: [{ term: "Fall 2024", average_gpa: 3.28 }, { term: "Spring 2025", average_gpa: 3.36 }, { term: "Fall 2025", average_gpa: 3.4 }, { term: "Spring 2026", average_gpa: 3.48 }],
  courses: [{
    course_id: "CS 2400",
    course_title: "Data Structures and Advanced Programming",
    average_gpa: 3.51,
    total_students: 284,
    sections_taught: 12,
    grade_counts: { A: 112, "A-": 31, "B+": 38, B: 49, "B-": 17, "C+": 13, C: 12, "C-": 3, "D+": 2, D: 2, "D-": 0, F: 5 },
    history: [{ term: "Fall 2024", average_gpa: 3.37 }, { term: "Spring 2025", average_gpa: 3.46 }, { term: "Fall 2025", average_gpa: 3.53 }, { term: "Spring 2026", average_gpa: 3.61 }],
  }],
});
const PREVIEW_COURSE_GRADES = Object.freeze({ average_gpa: 3.12 });

function normalizeCourseId(value) {
  const match = String(value || "")
    .toUpperCase()
    .match(/\b([A-Z]{2,10})\s+(\d{3,4}[A-Z]?)\b/);
  return match ? `${match[1]} ${match[2]}` : null;
}

function debug(...values) {
  if (DEBUG) console.debug("[BroncoSort Grade Graph]", ...values);
}

function renderProfessorHeader() {
  elements.professorInitials.textContent = professor.initials;
  elements.professorName.textContent = professor.name;
  elements.professorDepartment.textContent = professor.department;
  elements.professorRank.textContent = professor.rankText;
  elements.rmpLink.href = professor.rmpUrl;
  elements.rmpLink.classList.toggle("hidden", PREVIEW || professor.rmpUrl === "#");
}

function showLoading() {
  elements.loadingState.classList.remove("hidden");
  elements.errorState.classList.add("hidden");
  elements.gradeView.classList.add("hidden");
}

function showError(message) {
  elements.loadingState.classList.add("hidden");
  elements.gradeView.classList.add("hidden");
  elements.errorState.classList.remove("hidden");
  elements.errorMessage.textContent =
    message || "Grade information could not be loaded.";
}

function showGradeView() {
  elements.loadingState.classList.add("hidden");
  elements.errorState.classList.add("hidden");
  elements.gradeView.classList.remove("hidden");
}

function requestProfessorGrades() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        action: "GET_PROFESSOR_GRADE_RANKING",
        professorName: professor.name,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          debug("Professor endpoint", { success: false, runtimeError: true });
          reject(new Error("Professor grade data could not be loaded."));
          return;
        }
        if (!response?.success) {
          debug("Professor endpoint", { success: false });
          reject(new Error("Professor grade data could not be found."));
          return;
        }
        debug("Professor endpoint", {
          success: true,
          matchedProfessorName: response.matched_professor_name,
        });
        resolve(response.professor);
      },
    );
  });
}

function requestCourseGrades() {
  if (!currentCourseId) return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        action: "GET_COURSE_GRADE_RANKING",
        courseId: currentCourseId,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          debug("Course endpoint", { success: false, runtimeError: true });
          reject(new Error("Class-wide grade data is unavailable."));
          return;
        }
        if (!response?.success) {
          debug("Course endpoint", { success: false, courseId: currentCourseId });
          reject(new Error("Class-wide grade data is unavailable."));
          return;
        }
        debug("Course endpoint", { success: true, courseId: currentCourseId });
        resolve(response.course);
      },
    );
  });
}

function getProfessorCourseRecord() {
  return professorGradeData?.courses?.find(
    (course) => normalizeCourseId(course.course_id) === currentCourseId,
  );
}

function selectScopeRecord() {
  if (!professorGradeData) return null;
  if (gradeScope === "professor") return professorGradeData;
  return getProfessorCourseRecord();
}

function groupGradeCounts(rawCounts) {
  const count = (grade) => Math.max(0, Number(rawCounts?.[grade]) || 0);
  const grouped = {
    A: count("A") + count("A-"),
    B: count("B+") + count("B") + count("B-"),
    C: count("C+") + count("C") + count("C-"),
    D: count("D+") + count("D") + count("D-"),
    F: count("F"),
  };
  const total = Object.values(grouped).reduce((sum, value) => sum + value, 0);
  const percentages = Object.fromEntries(
    Object.entries(grouped).map(([grade, value]) => [
      grade,
      total ? Math.round((value / total) * 1000) / 10 : 0,
    ]),
  );
  return { percentages, total };
}

function renderDistribution(distribution) {
  elements.gradeChart.replaceChildren();
  const gradeOrder = ["A", "B", "C", "D", "F"];

  for (const grade of gradeOrder) {
    const percentage = distribution[grade] || 0;
    const column = document.createElement("div");
    column.className = "grade-column";
    const percentageLabel = document.createElement("span");
    percentageLabel.className = "grade-percentage";
    percentageLabel.textContent = `${percentage}%`;
    const barShell = document.createElement("div");
    barShell.className = "grade-bar-shell";
    const bar = document.createElement("div");
    bar.className = "grade-bar";
    bar.style.height = `${percentage === 0 ? 0 : Math.max(4, (percentage / 100) * 95)}px`;
    bar.style.animationDelay = `${gradeOrder.indexOf(grade) * 70}ms`;
    const gradeLabel = document.createElement("span");
    gradeLabel.className = "grade-label";
    gradeLabel.textContent = grade;
    barShell.appendChild(bar);
    column.append(percentageLabel, barShell, gradeLabel);
    elements.gradeChart.appendChild(column);
  }
}

function createSvgElement(tagName, attributes = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tagName);
  Object.entries(attributes).forEach(([name, value]) => {
    element.setAttribute(name, String(value));
  });
  return element;
}

function parseTerm(term) {
  const value = String(term || "").trim();
  const match = value.match(
    /^(Fall|Spring|Summer|Winter)(?:\s+(?:Semester|Quarter))?\s+(\d{4})$/i,
  );

  if (!match) return null;

  const season = match[1].toLowerCase();
  const seasonOrder = {
    winter: 0,
    spring: 1,
    summer: 2,
    fall: 3,
  };

  return {
    season,
    seasonLabel: `${season[0].toUpperCase()}${season.slice(1)}`,
    year: Number(match[2]),
    sortValue: Number(match[2]) * 10 + seasonOrder[season],
  };
}

function compareTermsChronologically(a, b) {
  const parsedA = parseTerm(a.entry.term);
  const parsedB = parseTerm(b.entry.term);

  if (parsedA && parsedB) return parsedA.sortValue - parsedB.sortValue;
  if (parsedA) return -1;
  if (parsedB) return 1;
  return a.originalIndex - b.originalIndex;
}

function formatTermLabel(term) {
  const parsed = parseTerm(term);
  return parsed ? `${parsed.seasonLabel} ${parsed.year}` : String(term || "");
}

function renderTrend(history) {
  const chartHeight = 240;
  const margins = { top: 40, right: 16, bottom: 44, left: 38 };
  const chartWidth = Math.max(
    260,
    Math.round(elements.trendSvg.parentElement?.clientWidth || 0),
  );
  const plotWidth = chartWidth - margins.left - margins.right;
  const plotHeight = chartHeight - margins.top - margins.bottom;

  elements.trendSvg.setAttribute(
    "viewBox",
    `0 0 ${chartWidth} ${chartHeight}`,
  );
  elements.trendAxes.replaceChildren();
  elements.trendPoints.replaceChildren();
  elements.trendLabels.replaceChildren();
  const trends = (Array.isArray(history) ? history : [])
    .map((entry, originalIndex) => ({ entry, originalIndex }))
    .filter(({ entry }) => Number.isFinite(Number(entry.average_gpa)))
    .sort(compareTermsChronologically)
    .slice(-5)
    .map(({ entry }) => entry);
  elements.trendEmptyMessage.classList.toggle("hidden", trends.length > 0);

  for (let tick = 0; tick <= 4; tick += 1) {
    const y = margins.top + plotHeight - (tick / 4) * plotHeight;
    const gridLine = createSvgElement("line", {
      class: "trend-grid-line",
      x1: margins.left,
      x2: chartWidth - margins.right,
      y1: y,
      y2: y,
    });
    const tickLabel = createSvgElement("text", {
      class: "axis-label y-axis-label",
      x: margins.left - 8,
      y: tick === 4 ? y - 6 : y + 4,
    });
    tickLabel.textContent = tick.toFixed(1);
    elements.trendAxes.append(gridLine, tickLabel);
  }

  if (!trends.length) {
    elements.trendLine.setAttribute("points", "");
    elements.trendArea.setAttribute("d", "");
    return;
  }

  const points = trends.map((entry, index) => {
    const value = Math.min(4, Math.max(0, Number(entry.average_gpa)));
    return {
      x:
        trends.length === 1
          ? margins.left + plotWidth / 2
          : margins.left + (index / (trends.length - 1)) * plotWidth,
      y: margins.top + plotHeight - (value / 4) * plotHeight,
      value,
      term: entry.term,
    };
  });
  elements.trendLine.setAttribute(
    "points",
    points.map((point) => `${point.x},${point.y}`).join(" "),
  );
  const firstPoint = points[0];
  const lastPoint = points.at(-1);
  elements.trendArea.setAttribute(
    "d",
    [
      `M ${firstPoint.x} ${margins.top + plotHeight}`,
      `L ${firstPoint.x} ${firstPoint.y}`,
      ...points.slice(1).map((point) => `L ${point.x} ${point.y}`),
      `L ${lastPoint.x} ${margins.top + plotHeight}`,
      "Z",
    ].join(" "),
  );
  points.forEach((point) => {
    const formattedGpa = point.value.toFixed(2);
    const dotRadius = 4;
    const circle = createSvgElement("circle", {
      class: "trend-point",
      cx: point.x,
      cy: point.y,
      r: dotRadius,
      tabindex: 0,
      role: "img",
      "aria-label": `${point.term}. Average GPA: ${formattedGpa}`,
    });
    const tooltip = createSvgElement("title");
    tooltip.textContent = `${point.term}\nAverage GPA: ${formattedGpa}`;
    circle.appendChild(tooltip);
    const labelGap = 8;
    const labelHeight = 14;
    const plotTop = 0;
    const minimumLabelTop = plotTop + 2;
    let labelBottomY = point.y - dotRadius - labelGap;
    let labelCenterY = labelBottomY - labelHeight / 2;
    let labelTop = labelCenterY - labelHeight / 2;

    if (labelTop < minimumLabelTop) {
      const downwardShift = minimumLabelTop - labelTop;
      labelBottomY += downwardShift;
      labelCenterY += downwardShift;
      labelTop += downwardShift;
    }

    const estimatedTextWidth = Math.max(24, formattedGpa.length * 6.2);
    const horizontalPadding = 4;
    const backgroundWidth = estimatedTextWidth + horizontalPadding * 2;
    const halfBackgroundWidth = backgroundWidth / 2;
    const plotLeft = margins.left;
    const plotRight = chartWidth - margins.right;
    let labelX = point.x;

    if (labelX - halfBackgroundWidth < plotLeft) {
      labelX = plotLeft + halfBackgroundWidth;
    } else if (labelX + halfBackgroundWidth > plotRight) {
      labelX = plotRight - halfBackgroundWidth;
    }

    const labelGroup = createSvgElement("g", {
      class: "point-value-group",
    });
    const labelBackground = createSvgElement("rect", {
      class: "point-value-background",
      x: labelX - halfBackgroundWidth,
      y: labelTop,
      width: backgroundWidth,
      height: labelHeight,
      rx: 3,
    });
    const valueLabel = createSvgElement("text", {
      class: "point-value-label",
      x: labelX,
      y: labelBottomY,
      "dominant-baseline": "auto",
    });
    valueLabel.textContent = formattedGpa;
    labelGroup.append(labelBackground, valueLabel);
    elements.trendPoints.append(circle, labelGroup);
  });
  elements.trendLabels.style.gridTemplateColumns = `repeat(${trends.length}, 1fr)`;
  trends.forEach((entry) => {
    const label = document.createElement("span");
    label.className = "trend-term-label axis-label x-axis-label";
    label.textContent = formatTermLabel(entry.term);
    label.title = entry.term;
    elements.trendLabels.appendChild(label);
  });
}

function formatGpa(value) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(2) : "N/A";
}

function renderGpaComparison() {
  const professorCourse = getProfessorCourseRecord();
  const hasClassContext = Boolean(currentCourseId);
  const courseLabel = hasClassContext ? currentCourseId : "Class";

  elements.professorOverallGpa.textContent = formatGpa(
    professorGradeData?.average_gpa,
  );
  elements.professorCourseLabel.textContent = `Prof in ${courseLabel}`;
  elements.professorCourseGpa.textContent = formatGpa(
    professorCourse?.average_gpa,
  );
  elements.courseOverallLabel.textContent = `${courseLabel} Overall`;
  elements.courseOverallGpa.textContent = formatGpa(
    courseGradeData?.average_gpa,
  );
  elements.classContextMessage.classList.toggle(
    "hidden",
    hasClassContext && Boolean(professorCourse) && Boolean(courseGradeData),
  );
  debug("Grade Graph context", {
    professorName: professor.name,
    courseId: currentCourseId,
    matchedProfessorCourseId: professorCourse?.course_id || null,
  });
}

function updateScopeButtons() {
  const isClass = gradeScope === "class";
  elements.classScopeButton.classList.toggle("active", isClass);
  elements.classScopeButton.setAttribute("aria-pressed", String(isClass));
  elements.professorScopeButton.classList.toggle("active", !isClass);
  elements.professorScopeButton.setAttribute("aria-pressed", String(!isClass));
}

function renderUnavailableScope(message) {
  showGradeView();
  renderDistribution({ A: 0, B: 0, C: 0, D: 0, F: 0 });
  renderTrend([]);
  elements.distributionSubtitle.textContent = message;
  elements.totalStudents.textContent = "0";
  elements.sectionCount.textContent = "0";
  elements.dataStatusText.textContent = "Data unavailable";
  updateScopeButtons();
  showGradeView();
}

function renderSelectedScope() {
  debug("Selected scope", gradeScope);
  const record = selectScopeRecord();
  if (!record) {
    renderUnavailableScope(
      gradeScope === "class"
        ? "Grade data for this course was not found."
        : "Professor grade data was not found.",
    );
    return;
  }

  const { percentages, total } = groupGradeCounts(record.grade_counts);
  if (!total) {
    renderUnavailableScope(
      "No graded student records are available for this selection.",
    );
    return;
  }

  showGradeView();
  renderDistribution(percentages);
  renderTrend(record.history);
  elements.distributionSubtitle.textContent =
    gradeScope === "class" && record.course_title
      ? `${record.course_title} · ${total.toLocaleString()} graded students`
      : `Based on ${total.toLocaleString()} graded students`;
  elements.totalStudents.textContent = (Number(record.total_students) || 0).toLocaleString();
  elements.sectionCount.textContent = (Number(record.sections_taught) || 0).toLocaleString();
  elements.dataStatusText.textContent = "Live data";
  updateScopeButtons();
  showGradeView();
}

async function loadGradeData() {
  showLoading();
  try {
    if (PREVIEW) {
      professorGradeData = PREVIEW_PROFESSOR_GRADES;
      courseGradeData = PREVIEW_COURSE_GRADES;
      renderGpaComparison();
      renderSelectedScope();
      elements.dataStatusText.textContent = "Demo data";
      return;
    }

    const [professorResult, courseResult] = await Promise.allSettled([
      requestProfessorGrades(),
      requestCourseGrades(),
    ]);

    if (professorResult.status === "rejected") {
      throw professorResult.reason;
    }

    professorGradeData = professorResult.value;
    courseGradeData =
      courseResult.status === "fulfilled" ? courseResult.value : null;

    if (courseResult.status === "rejected") {
      debug("Course endpoint unavailable");
    }

    if (!professorGradeData) {
      throw new Error("Professor grade data was not found.");
    }
    renderGpaComparison();
    renderSelectedScope();
  } catch (error) {
    debug("Grade Graph load failed", error?.message);
    showError(error?.message || "Grade data could not be loaded.");
  }
}

elements.classScopeButton.addEventListener("click", () => {
  gradeScope = "class";
  renderSelectedScope();
});
elements.professorScopeButton.addEventListener("click", () => {
  gradeScope = "professor";
  renderSelectedScope();
});
elements.backButton.addEventListener("click", () => {
  window.parent.postMessage({ type: "BRONCOSORT_PREMIUM_VIEW_BACK" }, "*");
});
elements.retryButton.addEventListener("click", loadGradeData);
elements.infoButton.addEventListener("click", () => elements.infoDialog.showModal());
elements.closeInfoButton.addEventListener("click", () => elements.infoDialog.close());
elements.infoDialog.addEventListener("click", (event) => {
  if (event.target === elements.infoDialog) elements.infoDialog.close();
});

if (typeof ResizeObserver === "function") {
  new ResizeObserver(() => {
    const record = selectScopeRecord();
    if (record && !elements.gradeView.classList.contains("hidden")) {
      renderTrend(record.history);
    }
  }).observe(elements.trendSvg.parentElement);
}

renderProfessorHeader();
loadGradeData();
