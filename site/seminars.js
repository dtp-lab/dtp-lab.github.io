(async function () {
  const { escapeHtml, loadJson, groupByYear, showDataError } = DTPLab;
  const { renderSeminarCard } = DTPLab.recordRenderers;
  const root = document.querySelector("#seminars-content");
  try {
    const data = await loadJson("seminars.json");
    const groups = groupByYear(data.seminars);
    root.innerHTML = Object.entries(groups).map(([year, seminars]) => `<section class="year-group"><header class="year-heading"><h2>${escapeHtml(year.trim())}</h2><span>${seminars.length}회</span></header><div class="seminar-list">${seminars.map(renderSeminarCard).join("")}</div></section>`).join("");
  } catch (error) { showDataError(root, error); }
})();
