(async function () {
  const { escapeHtml, loadJson, groupByYear, renderBodyText, imageMarkup, showDataError } = DTPLab;
  const heroTopics = document.querySelector("#hero-research-topics");
  const recruitment = document.querySelector("#recruitment-content");
  const researchOverview = document.querySelector("#research-overview");
  const research = document.querySelector("#research-grid");
  const news = document.querySelector("#news-groups");
  const setText = (selector, value) => {
    const element = document.querySelector(selector);
    if (element && value) element.textContent = value;
  };
  const categoryLabels = {
    project: "Project",
    publication: "Publication",
    member: "Member",
    award: "Award",
  };

  const renderRecruitment = (data) => {
    const sections = data.sections || [];
    return `<div class="recruitment-editorial">
      <header class="recruitment-intro-panel">
        <p class="recruitment-eyebrow">${escapeHtml(data.eyebrow)}</p>
        <div class="recruitment-intro body-text">${renderBodyText(data.intro)}</div>
        <a class="recruitment-mail" href="mailto:${escapeHtml(data.contactEmail)}">${escapeHtml(data.contactEmail)} <span aria-hidden="true">↗</span></a>
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
    <div class="research-thrust-copy body-text">
      ${renderBodyText(item.description)}
      ${item.focus?.length ? `<ul class="research-focus">${item.focus.map((focus) => `<li>${escapeHtml(focus)}</li>`).join("")}</ul>` : ""}
    </div>
  </article>`).join("");

  const renderNewsTimeline = (groups) => `<div class="news-timeline">${Object.entries(groups).map(([year, items]) => `<section class="news-timeline-year">
    <header class="news-timeline-year-heading"><h3>${escapeHtml(year.trim())}</h3><span>${items.length}건</span></header>
    <div class="news-timeline-list">${items.map((item) => `<article class="news-timeline-item news-${escapeHtml(item.category)}">
      <span class="news-marker" aria-hidden="true"></span>
      <time datetime="${escapeHtml(item.date)}">${escapeHtml(item.date)}</time>
      <span class="category-label">${escapeHtml(categoryLabels[item.category] || item.category)}</span>
      <div class="news-timeline-copy body-text">${renderBodyText(item.text)}</div>
    </article>`).join("")}</div>
  </section>`).join("")}</div>`;

  try {
    const [homeData, researchData, newsData] = await Promise.all([
      loadJson("home.json"),
      loadJson("research.json"),
      loadJson("news.json"),
    ]);
    setText("#home-hero-kicker", homeData.hero.kicker);
    const heroTitle = document.querySelector("#home-hero-title");
    if (heroTitle) heroTitle.innerHTML = String(homeData.hero.title || "").split("\n").map(escapeHtml).join("<br>");
    setText("#home-hero-subtitle", homeData.hero.subtitle);
    setText("#recruitment-summary-kicker", homeData.recruitment.summaryKicker);
    setText("#recruitment-summary-title", homeData.recruitment.summaryTitle);
    setText("#research-section-kicker", researchData.section.kicker);
    setText("#research-section-title", researchData.section.title);
    setText("#news-section-kicker", newsData.section.kicker);
    setText("#news-section-title", newsData.section.title);
    heroTopics.innerHTML = researchData.research.map((item, index) => `<article class="hero-research-topic">
      <span>${String(index + 1).padStart(2, "0")}</span>
      <strong>${escapeHtml(item.title)}</strong>
    </article>`).join("");
    recruitment.innerHTML = renderRecruitment(homeData.recruitment);
    researchOverview.innerHTML = imageMarkup(researchData.overviewImage, "연구 분야 개요");
    research.innerHTML = renderResearch(researchData.research);
    const groups = groupByYear(newsData.news);
    news.innerHTML = renderNewsTimeline(groups);
  } catch (error) {
    showDataError(recruitment || research || news, error);
  }
})();
