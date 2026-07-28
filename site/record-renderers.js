(function () {
  const { escapeHtml, imageMarkup, renderKeywords } = DTPLab;
  const baselineProbe = '<span class="record-meta-baseline-probe" aria-hidden="true"></span>';

  const projectCategoryLabels = { industry: "산학", rnd: "R&D", talent: "인재" };
  const projectIcons = {
    program: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2"/></svg>',
    period: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>',
    keyword: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m20.5 13.5-7 7a2 2 0 0 1-2.8 0L3 12.8V3h9.8l7.7 7.7a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.2"/></svg>',
  };
  const projectIconSlot = (kind) => `<span class="project-meta-icon record-meta-icon">${projectIcons[kind]}</span>`;
  const projectMetaPart = (kind, label, value) => value
    ? `<span class="project-meta-part record-meta-item meta-${kind}">${projectIconSlot(kind)}<span class="sr-only">${label}: </span><span class="project-meta-value record-meta-control record-meta-text">${baselineProbe}${escapeHtml(value)}</span></span>`
    : "";

  const renderProjectCard = (project, { diagnostic = false } = {}) => {
    const period = [project.period?.start, project.period?.end].filter(Boolean).join(" – ");
    const images = diagnostic ? [] : (project.images || []).filter((image) => typeof image === "string" ? image : image?.src);
    const keywordChips = project.keywords?.length
      ? `<span class="project-meta-part record-meta-item meta-keyword">${projectIconSlot("keyword")}<span class="sr-only">키워드: </span><span class="project-keywords record-meta-control record-meta-keywords">${project.keywords.map((keyword) => `<span class="keyword">${baselineProbe}<span class="keyword-label">${escapeHtml(keyword)}</span></span>`).join("")}</span></span>`
      : "";
    const meta = `${projectMetaPart("program", "사업명 및 과제유형", project.program)}${projectMetaPart("period", "연구기간", period)}${keywordChips}`;
    const body = diagnostic ? "" : `${project.description ? `<p class="project-description">${escapeHtml(project.description)}</p>` : ""}${project.details?.length ? `<section class="project-details-section"><h4>세부 연구내용</h4><ol class="project-details">${project.details.map((detail) => `<li>${escapeHtml(detail)}</li>`).join("")}</ol></section>` : ""}${images.length ? `<div class="record-gallery image-count-${images.length}">${images.map((image) => `<figure class="record-image">${imageMarkup(image, project.title)}</figure>`).join("")}</div>` : ""}`;
    return `<article class="project-card"><header class="project-head"><div><div class="chip-row"><span class="chip category-${escapeHtml(project.category)}">${projectCategoryLabels[project.category] || escapeHtml(project.category)}</span></div><h3>${escapeHtml(project.title)}</h3></div></header>${meta ? `<div class="project-meta-line record-meta-row">${meta}</div>` : ""}${body}</article>`;
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

  const publicationTagDescriptors = (item) => {
    if (item.type === "journal") {
      const metrics = item.journalMetrics || {};
      const tags = [];
      if (metrics.indexing === "SCIE") {
        const quartile = metrics.quartile && metrics.quartile !== "해당없음" ? metrics.quartile : "";
        const className = ({
          "Top-5%": "evaluation-scie-top5",
          "Top-10%": "evaluation-scie-top10",
          Q1: "evaluation-scie-q1",
          Q2: "evaluation-scie-q2",
          Q3: "evaluation-scie",
          Q4: "evaluation-scie",
        })[quartile] || "evaluation-scie";
        const label = quartile?.startsWith("Top-")
          ? `SCIE-Top ${quartile.slice(4)}`
          : quartile
            ? `SCIE-${quartile}`
            : "SCIE";
        tags.push({ label, className: `evaluation ${className}` });
      } else if (["ESCI", "KCI"].includes(metrics.indexing)) {
        tags.push({ label: metrics.indexing, className: `evaluation evaluation-${metrics.indexing.toLowerCase()}` });
      } else {
        tags.push({ label: "Journal", className: "type-journal" });
      }
      if (metrics.award) tags.push({ label: metrics.award, className: "evaluation evaluation-award" });
      return tags;
    }
    if (item.type === "conference") {
      const metrics = item.conferenceMetrics || {};
      if (metrics.conferenceType === "국내") return [{ label: "국내", className: "evaluation evaluation-kci" }];
      if (metrics.bk21 && metrics.bk21 !== "해당없음") {
        const className = { IF4: "evaluation-scie-top5", IF3: "evaluation-scie-top10", IF2: "evaluation-scie-q1", IF1: "evaluation-scie-q2" }[metrics.bk21];
        return [{ label: `BK ${metrics.bk21}`, className: `evaluation ${className}` }];
      }
      if (metrics.kiise && metrics.kiise !== "해당없음") {
        const className = metrics.kiise === "최우수" ? "evaluation-scie-top5" : "evaluation-scie-q1";
        return [{ label: `정보과학회 ${metrics.kiise}`, className: `evaluation ${className}` }];
      }
      return [{ label: "국제", className: "evaluation evaluation-kci" }];
    }
    if (item.type === "patent") {
      const metrics = item.patentMetrics || {};
      const jurisdiction = metrics.jurisdiction || "국내";
      const status = metrics.status || "출원";
      const className = { 국제: "patent-international", PCT: "patent-pct", 국내: "patent-domestic" }[jurisdiction] || "patent-domestic";
      return [{ label: `${jurisdiction} ${status}`, className: `patent-status ${className}` }];
    }
    return [{ label: publicationTypeLabels[item.type] || item.type, className: `type-${item.type}` }];
  };

  const renderPublicationTags = (item) => {
    return publicationTagDescriptors(item)
      .map((tag) => `<span class="publication-tag ${escapeHtml(tag.className)}">${escapeHtml(tag.label)}</span>`)
      .join("");
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
      ? `<span class="publication-citation record-meta-standalone">Cited by ${citation.citationCount}</span>`
      : "";
  };

  const renderPublicationAuthors = (item) => item.authors?.length
    ? `<p class="authors record-meta-control record-meta-text">${baselineProbe}${item.authors.map(renderPublicationAuthor).join(", ")}</p>`
    : "";

  const renderPublicationCard = (item, { headingLevel = 4, citations = { papers: {} } } = {}) => {
    const heading = headingLevel === 3 ? "h3" : "h4";
    const authors = item.authors?.length ? `<div class="publication-detail-row publication-authors-row record-meta-item"><span class="publication-row-icon record-meta-icon">${publicationIcons.authors}</span>${renderPublicationAuthors(item)}</div>` : "";
    const venueText = [item.venue, item.details, item.publishedAt].filter(Boolean).map(escapeHtml).join(", ");
    const venue = venueText ? `<span class="publication-meta-item publication-venue-item record-meta-item"><span class="publication-row-icon record-meta-icon">${publicationIcons.venue}</span><span class="publication-venue record-meta-control record-meta-text">${baselineProbe}${venueText}</span></span>` : "";
    const keywords = item.keywords?.length ? `<span class="publication-meta-item publication-keywords-item record-meta-item"><span class="publication-row-icon record-meta-icon">${publicationIcons.keywords}</span><span class="record-meta-control record-meta-keywords">${renderKeywords(item.keywords, { baselineProbe: true })}</span></span>` : "";
    return `<article class="publication-card">
      <div class="publication-top">
        <div class="publication-heading-line"><div class="publication-tags">${renderPublicationTags(item)}</div><${heading}>${escapeHtml(item.title)}</${heading}></div>
        ${renderPublicationLinks(item, citations)}
      </div>
      ${authors}
      <div class="publication-lower-row record-meta-row">${venue}${renderPublicationCitation(item, citations)}${keywords}</div>
    </article>`;
  };

  const seminarIcons = {
    presentation: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21l4-4 4 4M12 17v4M7 9h4M7 12h7"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>',
    speaker: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
    keyword: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m20.5 13.5-7 7a2 2 0 0 1-2.8 0L3 12.8V3h9.8l7.7 7.7a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.2"/></svg>',
  };
  const seminarMetaIcon = (kind) => `<span class="seminar-meta-icon record-meta-icon">${seminarIcons[kind]}</span>`;
  const renderSeminarCard = (seminar, { diagnostic = false } = {}) => `<article class="seminar-card"><div class="seminar-title-row"><span class="seminar-title-icon">${seminarIcons.presentation}</span><h3 class="seminar-title">${escapeHtml(seminar.title)}</h3></div><div class="seminar-meta-row record-meta-row"><span class="seminar-meta-item seminar-date record-meta-item">${seminarMetaIcon("calendar")}<time class="record-meta-control record-meta-text" datetime="${escapeHtml(seminar.date)}">${baselineProbe}${escapeHtml(seminar.date)}</time></span><span class="seminar-meta-item seminar-speaker record-meta-item">${seminarMetaIcon("speaker")}<span class="speaker record-meta-control record-meta-text">${baselineProbe}${escapeHtml(seminar.speaker)}</span></span>${seminar.keywords?.length ? `<span class="seminar-meta-item seminar-keywords record-meta-item">${seminarMetaIcon("keyword")}<span class="record-meta-control record-meta-keywords">${renderKeywords(seminar.keywords, { baselineProbe: true })}</span></span>` : ""}</div>${diagnostic ? "" : `<p class="seminar-summary">${escapeHtml(seminar.summary)}</p>`}</article>`;

  DTPLab.recordRenderers = {
    bindProjectGalleryRatios,
    publicationTagDescriptors,
    publicationTypeLabels,
    renderProjectCard,
    renderPublicationCard,
    renderSeminarCard,
  };
})();
