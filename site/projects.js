(async function () {
  const { loadJson, dateValue, showDataError } = DTPLab;
  const { bindProjectGalleryRatios, renderProjectCard } = DTPLab.recordRenderers;
  const root = document.querySelector("#projects-content");
  const buttons = [...document.querySelectorAll("[data-project-category]")];
  let projects = [];
  const render = (category = "all") => {
    const filtered = category === "all" ? projects : projects.filter((project) => project.category === category);
    const current = filtered.filter((project) => project.status === "current").sort((a, b) => dateValue(b.period?.start) - dateValue(a.period?.start));
    const completed = filtered.filter((project) => project.status === "completed").sort((a, b) => dateValue(b.period?.end) - dateValue(a.period?.end));
    const section = (title, items) => `<section class="project-section"><header class="year-heading"><h2>${title}</h2><span>${items.length}건</span></header>${items.length ? items.map(renderProjectCard).join("") : '<p class="empty-state">해당 카테고리의 프로젝트가 없습니다.</p>'}</section>`;
    root.innerHTML = section("Current Projects", current) + section("Completed Projects", completed);
    bindProjectGalleryRatios(root);
  };
  try { const data = await loadJson("projects.json"); projects = data.projects || []; render(); } catch (error) { showDataError(root, error); }
  buttons.forEach((button) => button.addEventListener("click", () => { buttons.forEach((item) => { item.classList.toggle("active", item === button); item.setAttribute("aria-pressed", String(item === button)); }); render(button.dataset.projectCategory); }));
})();
