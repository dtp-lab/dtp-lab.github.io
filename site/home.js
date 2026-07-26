(async function () {
  const { escapeHtml, loadJson, groupByYear, imageMarkup, showDataError } = DTPLab;
  const heroTopics = document.querySelector("#hero-research-topics");
  const recruitment = document.querySelector("#recruitment-content");
  const researchOverview = document.querySelector("#research-overview");
  const research = document.querySelector("#research-grid");
  const news = document.querySelector("#news-groups");
  try {
    const [homeData, researchData, newsData] = await Promise.all([loadJson("home.json"), loadJson("research.json"), loadJson("news.json")]);
    heroTopics.innerHTML = researchData.research.map((item, index) => `<article class="hero-research-topic"><span>${String(index + 1).padStart(2, "0")}</span><strong>${escapeHtml(item.title)}</strong></article>`).join("");
    recruitment.innerHTML = `<p class="recruitment-intro">${escapeHtml(homeData.recruitment.intro)}</p><div class="recruitment-grid">${homeData.recruitment.sections.map((section, index) => `<section class="recruitment-block accent-${(index % 5) + 1}"><h3>${escapeHtml(section.title)}</h3><ul>${section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>`).join("")}</div>`;
    researchOverview.innerHTML = imageMarkup(researchData.overviewImage, "연구 분야 개요");
    research.innerHTML = researchData.research.map((item, index) => `<article class="research-card">${imageMarkup(item.image, item.title)}<span class="index">${String(index + 1).padStart(2, "0")}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p></article>`).join("");
    const groups = groupByYear(newsData.news);
    news.innerHTML = Object.entries(groups).map(([year, items]) => `<section class="year-group news-year"><header class="year-heading"><h2>${escapeHtml(year)}</h2><span>${items.length}건</span></header><div class="news-list">${items.map((item) => `<article class="news-item news-${escapeHtml(item.category)}"><time datetime="${escapeHtml(item.date)}">${escapeHtml(item.date)}</time><span class="news-type"><span class="category-label">${escapeHtml(item.category)}</span></span><p>${escapeHtml(item.text)}</p></article>`).join("")}</div></section>`).join("");
  } catch (error) { showDataError(recruitment || research || news, error); }
})();
