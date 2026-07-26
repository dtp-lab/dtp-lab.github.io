(async function () {
  const { escapeHtml, loadJson, dateValue, imageMarkup, showDataError } = DTPLab;
  const root = document.querySelector("#projects-content");
  const buttons = [...document.querySelectorAll("[data-project-category]")];
  const categoryLabels = { industry: "산학", rnd: "R&D", talent: "인재" };
  let projects = [];
  const icons = {
    program: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2"/></svg>',
    agency: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21h18M5 21V9h14v12M3 9l9-6 9 6M9 13h6M9 17h6"/></svg>',
    period: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>',
    keyword: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m20.5 13.5-7 7a2 2 0 0 1-2.8 0L3 12.8V3h9.8l7.7 7.7a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.2"/></svg>',
  };
  const iconSlot = (kind) => `<span class="project-meta-icon">${icons[kind]}</span>`;
  const metaPart = (kind, label, value) => value ? `<span class="project-meta-part meta-${kind}">${iconSlot(kind)}<span class="sr-only">${label}: </span><span class="project-meta-value">${escapeHtml(value)}</span></span>` : "";
  const bindGalleryRatios = () => {
    root.querySelectorAll(".record-gallery img").forEach((image) => {
      const setRatio = () => {
        const ratio = image.naturalWidth && image.naturalHeight ? image.naturalWidth / image.naturalHeight : 1;
        image.closest(".record-image")?.style.setProperty("--media-ratio", String(Math.max(.72, Math.min(2.2, ratio))));
      };
      if (image.complete) setRatio();
      else image.addEventListener("load", setRatio, { once: true });
    });
  };
  const renderCard = (project) => {
    const period = [project.period?.start, project.period?.end].filter(Boolean).join(" – ");
    const images = (project.images || []).filter((image) => typeof image === "string" ? image : image?.src);
    const keywordChips = project.keywords?.length ? `<span class="project-meta-part meta-keyword">${iconSlot("keyword")}<span class="sr-only">키워드: </span><span class="project-keywords">${project.keywords.map((keyword) => `<span class="keyword">${escapeHtml(keyword)}</span>`).join("")}</span></span>` : "";
    const meta = `${metaPart("program", "사업명 및 과제유형", project.program)}${metaPart("agency", "지원 및 발주기관", project.sponsor)}${metaPart("agency", "전담 및 관리기관", project.managingAgency)}${metaPart("period", "연구기간", period)}${keywordChips}`;
    return `<article class="project-card"><header class="project-head"><div><div class="chip-row"><span class="chip category-${escapeHtml(project.category)}">${categoryLabels[project.category] || escapeHtml(project.category)}</span></div><h3>${escapeHtml(project.title)}</h3></div></header>${meta ? `<div class="project-meta-line">${meta}</div>` : ""}${project.description ? `<p class="project-description">${escapeHtml(project.description)}</p>` : ""}${project.details?.length ? `<section class="project-details-section"><h4>세부 연구내용</h4><ol class="project-details">${project.details.map((detail) => `<li>${escapeHtml(detail)}</li>`).join("")}</ol></section>` : ""}${images.length ? `<div class="record-gallery image-count-${images.length}">${images.map((image) => `<figure class="record-image">${imageMarkup(image, project.title)}</figure>`).join("")}</div>` : ""}</article>`;
  };
  const render = (category = "all") => {
    const filtered = category === "all" ? projects : projects.filter((project) => project.category === category);
    const current = filtered.filter((project) => project.status === "current").sort((a, b) => dateValue(b.period?.start) - dateValue(a.period?.start));
    const completed = filtered.filter((project) => project.status === "completed").sort((a, b) => dateValue(b.period?.end) - dateValue(a.period?.end));
    const section = (title, items) => `<section class="project-section"><header class="year-heading"><h2>${title}</h2><span>${items.length}건</span></header>${items.length ? items.map(renderCard).join("") : '<p class="empty-state">해당 카테고리의 프로젝트가 없습니다.</p>'}</section>`;
    root.innerHTML = section("Current Projects", current) + section("Completed Projects", completed);
    bindGalleryRatios();
  };
  try { const data = await loadJson("projects.json"); projects = data.projects || []; render(); } catch (error) { showDataError(root, error); }
  buttons.forEach((button) => button.addEventListener("click", () => { buttons.forEach((item) => { item.classList.toggle("active", item === button); item.setAttribute("aria-pressed", String(item === button)); }); render(button.dataset.projectCategory); }));
})();
