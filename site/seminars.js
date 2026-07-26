(async function () {
  const { escapeHtml, loadJson, groupByYear, renderKeywords, showDataError } = DTPLab;
  const root = document.querySelector("#seminars-content");
  try {
    const data = await loadJson("seminars.json");
    const groups = groupByYear(data.seminars);
    const presentationIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21l4-4 4 4M12 17v4M7 9h4M7 12h7"/></svg>';
    const calendarIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>';
    const speakerIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>';
    const keywordIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m20.5 13.5-7 7a2 2 0 0 1-2.8 0L3 12.8V3h9.8l7.7 7.7a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.2"/></svg>';
    root.innerHTML = Object.entries(groups).map(([year, seminars]) => `<section class="year-group"><header class="year-heading"><h2>${escapeHtml(year.trim())}</h2><span>${seminars.length}회</span></header><div class="seminar-list">${seminars.map((seminar) => `<article class="seminar-card"><div class="seminar-title-row"><span class="seminar-title-icon">${presentationIcon}</span><h3 class="seminar-title">${escapeHtml(seminar.title)}</h3></div><div class="seminar-meta-row"><span class="seminar-meta-item seminar-date">${calendarIcon}<time datetime="${escapeHtml(seminar.date)}">${escapeHtml(seminar.date)}</time></span><span class="seminar-meta-item seminar-speaker">${speakerIcon}<span class="speaker">${escapeHtml(seminar.speaker)}</span></span>${seminar.keywords?.length ? `<span class="seminar-meta-item seminar-keywords">${keywordIcon}${renderKeywords(seminar.keywords)}</span>` : ""}</div><p class="seminar-summary">${escapeHtml(seminar.summary)}</p></article>`).join("")}</div></section>`).join("");
  } catch (error) { showDataError(root, error); }
})();
