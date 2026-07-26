(async function () {
  const { escapeHtml, loadJson, groupByYear, imageMarkup, showDataError } = DTPLab;
  const heroTopics = document.querySelector("#hero-research-topics");
  const recruitment = document.querySelector("#recruitment-content");
  const researchOverview = document.querySelector("#research-overview");
  const research = document.querySelector("#research-grid");
  const news = document.querySelector("#news-groups");
  const newsLayoutButtons = [...document.querySelectorAll("[data-news-layout]")];
  const categoryLabels = {
    project: "Project",
    publication: "Publication",
    member: "People",
    award: "Award",
  };

  const renderRecruitment = (data) => {
    const sections = data.sections || [];
    return `<div class="recruitment-editorial">
      <header class="recruitment-intro-panel">
        <p class="recruitment-eyebrow">Graduate & Undergraduate Researcher</p>
        <p class="recruitment-intro">${escapeHtml(data.intro)}</p>
        <a class="recruitment-mail" href="mailto:wonsukkim@pusan.ac.kr">wonsukkim@pusan.ac.kr <span aria-hidden="true">↗</span></a>
      </header>
      <div class="recruitment-list">${sections.map((section, index) => `<section class="recruitment-row">
        <span class="recruitment-number">${String(index + 1).padStart(2, "0")}</span>
        <h3>${escapeHtml(section.title)}</h3>
        <ul>${section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </section>`).join("")}</div>
    </div>`;
  };

  const renderResearch = (items) => items.map((item, index) => `<article class="research-thrust">
    <div class="research-thrust-heading">
      <p class="research-thrust-label">${escapeHtml(item.label || `Direction ${String(index + 1).padStart(2, "0")}`)}</p>
      <h3>${escapeHtml(item.title)}</h3>
      ${item.subtitle ? `<p class="research-thrust-subtitle">${escapeHtml(item.subtitle)}</p>` : ""}
    </div>
    <figure class="research-thrust-visual">${imageMarkup(item.image, item.title)}</figure>
    <div class="research-thrust-copy">
      <p>${escapeHtml(item.description)}</p>
      ${item.focus?.length ? `<ul class="research-focus">${item.focus.map((focus) => `<li>${escapeHtml(focus)}</li>`).join("")}</ul>` : ""}
    </div>
  </article>`).join("");

  const renderNewsTimeline = (groups) => `<div class="news-timeline">${Object.entries(groups).map(([year, items]) => `<section class="news-timeline-year">
    <header class="news-year-rail"><h3>${escapeHtml(year.trim())}</h3><span>${items.length}</span></header>
    <div class="news-timeline-list">${items.map((item) => `<article class="news-timeline-item news-${escapeHtml(item.category)}">
      <span class="news-marker" aria-hidden="true"></span>
      <div class="news-timeline-meta"><time datetime="${escapeHtml(item.date)}">${escapeHtml(item.date)}</time><span class="category-label">${escapeHtml(categoryLabels[item.category] || item.category)}</span></div>
      <p>${escapeHtml(item.text)}</p>
    </article>`).join("")}</div>
  </section>`).join("")}</div>`;

  const renderNewsLegacy = (groups) => `<div class="news-legacy">${Object.entries(groups).map(([year, items]) => `<section class="year-group news-year">
    <header class="year-heading"><h3>${escapeHtml(year.trim())}</h3><span>${items.length}건</span></header>
    <div class="news-list">${items.map((item) => `<article class="news-item news-${escapeHtml(item.category)}">
      <time datetime="${escapeHtml(item.date)}">${escapeHtml(item.date)}</time>
      <span class="news-type"><span class="category-label">${escapeHtml(item.category)}</span></span>
      <p>${escapeHtml(item.text)}</p>
    </article>`).join("")}</div>
  </section>`).join("")}</div>`;

  const setNewsLayout = (layout) => {
    news.dataset.layout = layout;
    news.querySelector(".news-timeline")?.toggleAttribute("hidden", layout !== "timeline");
    news.querySelector(".news-legacy")?.toggleAttribute("hidden", layout !== "legacy");
    newsLayoutButtons.forEach((button) => {
      const active = button.dataset.newsLayout === layout;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  };

  try {
    const [homeData, researchData, newsData] = await Promise.all([
      loadJson("home.json"),
      loadJson("research.json"),
      loadJson("news.json"),
    ]);
    heroTopics.innerHTML = researchData.research.map((item, index) => `<article class="hero-research-topic">
      <span>${String(index + 1).padStart(2, "0")}</span>
      <strong>${escapeHtml(item.title)}</strong>
    </article>`).join("");
    recruitment.innerHTML = renderRecruitment(homeData.recruitment);
    researchOverview.innerHTML = imageMarkup(researchData.overviewImage, "연구 분야 개요");
    research.innerHTML = renderResearch(researchData.research);
    const groups = groupByYear(newsData.news);
    news.innerHTML = renderNewsTimeline(groups) + renderNewsLegacy(groups);
    setNewsLayout("timeline");
  } catch (error) {
    showDataError(recruitment || research || news, error);
  }

  newsLayoutButtons.forEach((button) => button.addEventListener("click", () => setNewsLayout(button.dataset.newsLayout)));
})();
