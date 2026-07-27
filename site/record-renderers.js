(function () {
  const { escapeHtml, imageMarkup, renderKeywords } = DTPLab;

  const projectCategoryLabels = { industry: "산학", rnd: "R&D", talent: "인재" };
  const projectIcons = {
    program: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2"/></svg>',
    agency: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21h18M5 21V9h14v12M3 9l9-6 9 6M9 13h6M9 17h6"/></svg>',
    period: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>',
    keyword: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m20.5 13.5-7 7a2 2 0 0 1-2.8 0L3 12.8V3h9.8l7.7 7.7a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.2"/></svg>',
  };
  const projectIconSlot = (kind) => `<span class="project-meta-icon">${projectIcons[kind]}</span>`;
  const projectMetaPart = (kind, label, value) => value
    ? `<span class="project-meta-part meta-${kind}">${projectIconSlot(kind)}<span class="sr-only">${label}: </span><span class="project-meta-value">${escapeHtml(value)}</span></span>`
    : "";

  const renderProjectCard = (project, { diagnostic = false } = {}) => {
    const period = [project.period?.start, project.period?.end].filter(Boolean).join(" – ");
    const images = diagnostic ? [] : (project.images || []).filter((image) => typeof image === "string" ? image : image?.src);
    const keywordChips = project.keywords?.length
      ? `<span class="project-meta-part meta-keyword">${projectIconSlot("keyword")}<span class="sr-only">키워드: </span><span class="project-keywords">${project.keywords.map((keyword) => `<span class="keyword">${escapeHtml(keyword)}</span>`).join("")}</span></span>`
      : "";
    const meta = `${projectMetaPart("program", "사업명 및 과제유형", project.program)}${projectMetaPart("agency", "지원 및 발주기관", project.sponsor)}${projectMetaPart("agency", "전담 및 관리기관", project.managingAgency)}${projectMetaPart("period", "연구기간", period)}${keywordChips}`;
    const body = diagnostic ? "" : `${project.description ? `<p class="project-description">${escapeHtml(project.description)}</p>` : ""}${project.details?.length ? `<section class="project-details-section"><h4>세부 연구내용</h4><ol class="project-details">${project.details.map((detail) => `<li>${escapeHtml(detail)}</li>`).join("")}</ol></section>` : ""}${images.length ? `<div class="record-gallery image-count-${images.length}">${images.map((image) => `<figure class="record-image">${imageMarkup(image, project.title)}</figure>`).join("")}</div>` : ""}`;
    return `<article class="project-card"><header class="project-head"><div><div class="chip-row"><span class="chip category-${escapeHtml(project.category)}">${projectCategoryLabels[project.category] || escapeHtml(project.category)}</span></div><h3>${escapeHtml(project.title)}</h3></div></header>${meta ? `<div class="project-meta-line">${meta}</div>` : ""}${body}</article>`;
  };

  const bindProjectGalleryRatios = (root) => {
    root?.querySelectorAll(".record-gallery img").forEach((image) => {
      const setRatio = () => {
        const ratio = image.naturalWidth && image.naturalHeight ? image.naturalWidth / image.naturalHeight : 1;
        image.closest(".record-image")?.style.setProperty("--media-ratio", String(Math.max(.72, Math.min(2.2, ratio))));
      };
      if (image.complete) setRatio();
      else image.addEventListener("load", setRatio, { once: true });
    });
  };

  const publicationTypeLabels = { journal: "Journal", conference: "Conference", patent: "Patent" };
  const publicationIcons = {
    authors: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M16 4a4 4 0 0 1 0 8M17 14a7 7 0 0 1 5 7"/></svg>',
    venue: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h10l4 4v14H5z"/><path d="M15 3v5h5M8 12h8M8 16h8"/></svg>',
    keywords: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m20.5 13.5-7 7a2 2 0 0 1-2.8 0L3 12.8V3h9.8l7.7 7.7a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.2"/></svg>',
  };

  const renderPublicationAuthor = (author) => {
    const symbols = `${author.isFirstAuthor ? '<sup class="author-symbol" title="제1저자" aria-label="제1저자">†</sup>' : ""}${author.isCorrespondingAuthor ? '<sup class="author-symbol" title="교신저자" aria-label="교신저자">*</sup>' : ""}`;
    return `<span class="author${author.isLabMember ? " lab-member" : ""}">${escapeHtml(author.name)}${symbols}</span>`;
  };

  const renderPublicationEvaluationTag = (item) => {
    const indexing = item.metrics?.indexing;
    if (!indexing) return "";
    let label = indexing;
    let className = indexing.toLowerCase();
    if (indexing === "SCIE" && item.metrics?.topPercent) {
      label = `SCIE-TOP${item.metrics.topPercent}%`;
      className = `scie-top${String(item.metrics.topPercent).replace(/[^0-9]/g, "")}`;
    } else if (indexing === "SCIE" && item.metrics?.quartile) {
      label = `SCIE-${item.metrics.quartile}`;
      className = ["Q1", "Q2"].includes(item.metrics.quartile) ? `scie-${item.metrics.quartile.toLowerCase()}` : "scie";
    }
    if (item.metrics?.metricYear) label += `, ${item.metrics.metricYear}`;
    return `<span class="publication-tag evaluation evaluation-${escapeHtml(className)}">${escapeHtml(label)}</span>`;
  };

  const patentStatusClass = (status) => ({ "등록": "patent-registered", "출원": "patent-applied", PCT: "patent-pct" })[status] || "patent-other";
  const renderPublicationTags = (item) => {
    const featureTags = [
      renderPublicationEvaluationTag(item),
      item.metrics?.award ? `<span class="publication-tag evaluation evaluation-award">${escapeHtml(item.metrics.award)}</span>` : "",
      item.patentStatus ? `<span class="publication-tag patent-status ${patentStatusClass(item.patentStatus)}">${escapeHtml(item.patentStatus)}</span>` : "",
    ].filter(Boolean);
    const fallback = `<span class="publication-tag type-${escapeHtml(item.type)}">${escapeHtml(publicationTypeLabels[item.type] || item.type)}</span>`;
    return (featureTags.length ? featureTags : [fallback]).join("");
  };

  const getPublicationLinks = (item, citations) => {
    const links = [...(item.links || [])];
    if (item.doi) links.unshift({ label: "DOI", url: `https://doi.org/${item.doi}` });
    const citation = citations.papers?.[item.id];
    if (citation?.url && !links.some((link) => link.url === citation.url)) links.push({ label: "S2", url: citation.url });
    return links;
  };

  const renderPublicationLinks = (item, citations) => {
    const links = getPublicationLinks(item, citations);
    return links.length ? `<nav class="publication-links" aria-label="외부 링크">${links.map((link) => `<a class="icon-link" href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer" title="${escapeHtml(link.label)}">${escapeHtml(link.label)}</a>`).join("")}</nav>` : "";
  };

  const renderPublicationCitation = (item, citations) => {
    const citation = citations.papers?.[item.id];
    return Number.isInteger(citation?.citationCount)
      ? `<span class="publication-citation">Cited by ${citation.citationCount}${citation.checkedAt ? `, ${escapeHtml(citation.checkedAt)}` : ""}</span>`
      : "";
  };

  const renderPublicationAuthors = (item) => item.authors?.length
    ? `<p class="authors">${item.authors.map(renderPublicationAuthor).join(", ")}</p>`
    : "";

  const renderPublicationCard = (item, { headingLevel = 4, citations = { papers: {} } } = {}) => {
    const heading = headingLevel === 3 ? "h3" : "h4";
    const authors = item.authors?.length ? `<div class="publication-detail-row publication-authors-row"><span class="publication-row-icon">${publicationIcons.authors}</span>${renderPublicationAuthors(item)}</div>` : "";
    const venueText = [item.venue, item.details, item.publishedAt].filter(Boolean).map(escapeHtml).join(", ");
    const venue = venueText ? `<span class="publication-meta-item publication-venue-item"><span class="publication-row-icon">${publicationIcons.venue}</span><span class="publication-venue">${venueText}</span></span>` : "";
    const keywords = item.keywords?.length ? `<span class="publication-meta-item publication-keywords-item"><span class="publication-row-icon">${publicationIcons.keywords}</span>${renderKeywords(item.keywords)}</span>` : "";
    return `<article class="publication-card">
      <div class="publication-top">
        <div class="publication-heading-line"><div class="publication-tags">${renderPublicationTags(item)}</div><${heading}>${escapeHtml(item.title)}</${heading}></div>
        ${renderPublicationLinks(item, citations)}
      </div>
      ${authors}
      <div class="publication-lower-row">${venue}${renderPublicationCitation(item, citations)}${keywords}</div>
    </article>`;
  };

  const seminarIcons = {
    presentation: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21l4-4 4 4M12 17v4M7 9h4M7 12h7"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>',
    speaker: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
    keyword: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m20.5 13.5-7 7a2 2 0 0 1-2.8 0L3 12.8V3h9.8l7.7 7.7a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.2"/></svg>',
  };
  const seminarMetaIcon = (kind) => `<span class="seminar-meta-icon">${seminarIcons[kind]}</span>`;
  const renderSeminarCard = (seminar, { diagnostic = false } = {}) => `<article class="seminar-card"><div class="seminar-title-row"><span class="seminar-title-icon">${seminarIcons.presentation}</span><h3 class="seminar-title">${escapeHtml(seminar.title)}</h3></div><div class="seminar-meta-row"><span class="seminar-meta-item seminar-date">${seminarMetaIcon("calendar")}<time datetime="${escapeHtml(seminar.date)}">${escapeHtml(seminar.date)}</time></span><span class="seminar-meta-item seminar-speaker">${seminarMetaIcon("speaker")}<span class="speaker">${escapeHtml(seminar.speaker)}</span></span>${seminar.keywords?.length ? `<span class="seminar-meta-item seminar-keywords">${seminarMetaIcon("keyword")}${renderKeywords(seminar.keywords)}</span>` : ""}</div>${diagnostic ? "" : `<p class="seminar-summary">${escapeHtml(seminar.summary)}</p>`}</article>`;

  DTPLab.recordRenderers = {
    bindProjectGalleryRatios,
    publicationTypeLabels,
    renderProjectCard,
    renderPublicationCard,
    renderSeminarCard,
  };
})();
